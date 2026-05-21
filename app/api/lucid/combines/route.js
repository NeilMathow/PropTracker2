import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getGmailAuth, fetchEmails, parsePurchases, parsePasses } from "../../../../lib/lucid-gmail";

const PASS_WINDOW_DAYS = 30;

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) return Response.json({ error: "Not authenticated" }, { status: 401 });

    const gmail = await getGmailAuth(session.accessToken);

    const [purchaseResult, passResult] = await Promise.all([
      fetchEmails(gmail, 'subject:"Lucid Trading - Order Processing" from:support@lucidtrading.com', 100),
      fetchEmails(gmail, 'subject:"Funded Account Activation Complete" from:admin@lucidtrading.com', 100),
    ]);

    const purchases = parsePurchases(purchaseResult.emails);
    const passes = parsePasses(passResult.emails);

    // For each pass, find the closest purchase that came before it (within 30 days)
    const matchedPurchaseIds = new Set();
    const passMatches = {};

    for (const pass of passes) {
      const passDate = new Date(pass.date);
      let closest = null;
      let closestDiff = Infinity;

      for (const purchase of purchases) {
        const purchaseDate = new Date(purchase.date);
        const diffMs = passDate - purchaseDate;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (diffDays >= 0 && diffDays <= PASS_WINDOW_DAYS && diffMs < closestDiff) {
          closest = purchase;
          closestDiff = diffMs;
        }
      }

      if (closest) {
        matchedPurchaseIds.add(closest.id);
        passMatches[closest.id] = {
          accountId: pass.accountId,
          passDate: pass.date,
        };
      }
    }

    // Default is Closed — only Passed if matched to a funded email
    const combines = purchases.map(({ body, ...e }) => {
      let status = "Closed";
      let accountId = null;
      let passDate = null;

      if (matchedPurchaseIds.has(e.id)) {
        status = "Passed";
        accountId = passMatches[e.id].accountId;
        passDate = passMatches[e.id].passDate;
      }

      return { ...e, status, accountId, passDate };
    });

    return Response.json({ emails: combines });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
