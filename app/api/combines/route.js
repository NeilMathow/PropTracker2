import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { getGmailAuth, fetchEmails, parseCombines } from "../../../lib/gmail";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) return Response.json({ error: "Not authenticated" }, { status: 401 });

    const gmail = await getGmailAuth(session.accessToken);
    const pageToken = req.nextUrl.searchParams.get("pageToken");

    const result = await fetchEmails(
      gmail,
      'subject:("Trading Combine Passed" OR "You\'ve Passed") from:(account@info.topstep.com OR noreply@topstep.com)',
      100,
      pageToken
    );

    const emails = parseCombines(result.emails).map(({ body, ...e }) => e);

    return Response.json({
      emails,
      resultSizeEstimate: result.resultSizeEstimate,
      nextPageToken: result.nextPageToken,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
