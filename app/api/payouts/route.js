import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { getGmailAuth, fetchEmails, parsePayouts } from "../../../lib/gmail";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) return Response.json({ error: "Not authenticated" }, { status: 401 });

    const gmail = await getGmailAuth(session.accessToken);

    const [processingResult, approvedResult, receivedResult] = await Promise.all([
      fetchEmails(
        gmail,
        'subject:"Your payout is being processed" from:(account@info.topstep.com OR noreply@topstep.com)',
        100
      ),
      fetchEmails(
        gmail,
        'subject:"Your payout has been approved" from:(account@info.topstep.com OR noreply@topstep.com)',
        100
      ),
      fetchEmails(
        gmail,
        'subject:"Your payout request has been received" from:(account@info.topstep.com OR noreply@topstep.com)',
        100
      ),
    ]);

    const emails = parsePayouts(
      processingResult.emails,
      approvedResult.emails,
      receivedResult.emails
    ).map(({ body, ...e }) => e);

    return Response.json({ emails });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
