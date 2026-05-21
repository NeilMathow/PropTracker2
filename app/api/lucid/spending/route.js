import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getGmailAuth, fetchEmails, parsePurchases } from "../../../../lib/lucid-gmail";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) return Response.json({ error: "Not authenticated" }, { status: 401 });

    const gmail = await getGmailAuth(session.accessToken);
    const pageToken = req.nextUrl.searchParams.get("pageToken");

    const result = await fetchEmails(
      gmail,
      'subject:"Lucid Trading - Order Processing" from:support@lucidtrading.com',
      100,
      pageToken
    );

    // Map total -> amount so dashboard calendar/spending uses the right field
    const emails = parsePurchases(result.emails).map(({ body, ...e }) => ({
      ...e,
      amount: e.total,
    }));

    const grandTotal = emails.reduce((sum, e) => sum + (e.amount || 0), 0);

    return Response.json({
      emails,
      total: grandTotal,
      resultSizeEstimate: result.resultSizeEstimate,
      nextPageToken: result.nextPageToken,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
