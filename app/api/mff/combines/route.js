import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import {
  getGmailAuth,
  fetchEmails,
  parsePurchases,
  parsePasses,
  parseBreaches,
} from "../../../../lib/mff-gmail";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) return Response.json({ error: "Not authenticated" }, { status: 401 });

    const gmail = await getGmailAuth(session.accessToken);

    // Fetch all email types in parallel including both purchase receipt subjects
    const [tradovateResult, dxfeedResult, passResult, breachResult] = await Promise.all([
      fetchEmails(gmail, 'subject:"Your Tradovate Account Purchase Receipt" from:support@myfundedfutures.com', 100),
      fetchEmails(gmail, 'subject:"Your DXFeed Account Purchase Receipt" from:support@myfundedfutures.com', 100),
      fetchEmails(gmail, 'subject:"You Passed Your Evaluation!" from:support@myfundedfutures.com', 100),
      fetchEmails(gmail, 'subject:"Breach Detected" from:support@myfundedfutures.com', 100),
    ]);

    const allPurchaseEmails = [...tradovateResult.emails, ...dxfeedResult.emails];
    const purchases = parsePurchases(allPurchaseEmails);
    const passes = parsePasses(passResult.emails);
    const breaches = parseBreaches(breachResult.emails);

    const passedIds = new Set(passes.map((p) => p.accountId).filter(Boolean));
    const breachMap = Object.fromEntries(
      breaches.filter((b) => b.accountId).map((b) => [b.accountId, b.reason])
    );

    const combines = purchases.map(({ body, ...e }) => {
      let status = "Active";
      let breachReason = null;

      if (e.accountId && passedIds.has(e.accountId)) {
        status = "Passed";
      } else if (e.accountId && breachMap[e.accountId]) {
        status = "Breached";
        breachReason = breachMap[e.accountId];
      }

      return { ...e, status, breachReason };
    });

    return Response.json({ emails: combines });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
