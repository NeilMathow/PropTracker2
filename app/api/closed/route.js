import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { getGmailAuth, fetchEmails } from "../../../lib/gmail";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) return Response.json({ error: "Not authenticated" }, { status: 401 });

    const gmail = await getGmailAuth(session.accessToken);

    const result = await fetchEmails(
      gmail,
      'subject:"Trading Combine: Rule Violation Notice" from:(account@info.topstep.com OR noreply@topstep.com)',
      500
    );

    const emails = result.emails
      .map(({ body, ...e }) => e)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return Response.json({ emails });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
