import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabase(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": options.prefer || "return=representation",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  return res.json().catch(() => null);
}

// GET — load all journals for this user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return Response.json({ error: "Not authenticated" }, { status: 401 });

    const email = session.user.email;
    const data = await supabase(`/journals?user_email=eq.${encodeURIComponent(email)}&select=date,entries`);

    // Convert array of rows to { [date]: entries[] } map
    const journals = {};
    (data || []).forEach(row => { journals[row.date] = row.entries; });
    return Response.json(journals);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// POST — upsert all journals for this user
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return Response.json({ error: "Not authenticated" }, { status: 401 });

    const email = session.user.email;
    const journals = await req.json(); // { [date]: entries[] }

    // Build upsert rows
    const rows = Object.entries(journals).map(([date, entries]) => ({
      user_email: email,
      date,
      entries,
      updated_at: new Date().toISOString(),
    }));

    if (rows.length === 0) {
      // Delete all journals for this user if empty
      await supabase(`/journals?user_email=eq.${encodeURIComponent(email)}`, {
        method: "DELETE",
        prefer: "return=minimal",
      });
    } else {
      await supabase("/journals", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: JSON.stringify(rows),
      });

      // Delete any dates that no longer exist
      const dates = Object.keys(journals);
      await supabase(
        `/journals?user_email=eq.${encodeURIComponent(email)}&date=not.in.(${dates.map(d => `"${d}"`).join(",")})`,
        { method: "DELETE", prefer: "return=minimal" }
      );
    }

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
