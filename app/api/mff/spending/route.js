import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getGmailAuth, fetchEmails, parsePurchases } from "../../../../lib/mff-gmail";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) return Response.json({ error: "Not authenticated" }, { status: 401 });

    const gmail = await getGmailAuth(session.accessToken);
    const pageToken = req.nextUrl.searchParams.get("pageToken");

    const [tradovateResult, dxfeedResult] = await Promise.all([
      fetchEmails(gmail, 'subject:"Your Tradovate Account Purchase Receipt" from:support@myfundedfutures.com', 100, pageToken),
      fetchEmails(gmail, 'subject:"Your DXFeed Account Purchase Receipt" from:support@myfundedfutures.com', 100, pageToken),
    ]);

    const allEmails = [...tradovateResult.emails, ...dxfeedResult.emails];
    const emails = parsePurchases(allEmails).map(({ body, ...e }) => e);

    emails.sort((a, b) => new Date(b.date) - new Date(a.date));

    const total = emails.reduce((sum, e) => sum + (e.purchasePrice || 0), 0);

    return Response.json({
      emails,
      total,
      resultSizeEstimate: tradovateResult.resultSizeEstimate + dxfeedResult.resultSizeEstimate,
      nextPageToken: tradovateResult.nextPageToken || dxfeedResult.nextPageToken,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
