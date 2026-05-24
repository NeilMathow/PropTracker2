export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getGmailAuth, fetchEmails, parseBilling, parseResets, parsePasses } from "../../../../lib/apex-gmail";

const PASS_WINDOW_DAYS = 30;

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) return Response.json({ error: "Not authenticated" }, { status: 401 });

    const gmail = await getGmailAuth(session.accessToken);

    const [platformResult, fundingResult, rithmicResetResult, tradovateResetResult, passResult] = await Promise.all([
      fetchEmails(gmail, 'subject:"Apex Trader Platform: Payment Receipt" from:noreply@apextraderfunding.com', 100),
      fetchEmails(gmail, 'subject:"Apex Trader Funding: Payment Receipt" from:noreply@atf.com', 100),
      fetchEmails(gmail, 'subject:"Rithmic Reset being Activated" from:noreply@atf.com', 100),
      fetchEmails(gmail, 'subject:"Tradovate Reset being Activated" from:noreply@atf.com', 100),
      fetchEmails(gmail, 'subject:"Activation Steps for Your Performance Funded Account"', 100),
    ]);

    const allBillingEmails = [...platformResult.emails, ...fundingResult.emails];
    const billings = parseBilling(allBillingEmails).filter(b => !b.isReset);

    const allResetEmails = [...rithmicResetResult.emails, ...tradovateResetResult.emails];
    const resets = parseResets(allResetEmails);

    const passes = parsePasses(passResult.emails);

    billings.sort((a, b) => new Date(a.date) - new Date(b.date));

    const matchedBillingIds = new Set();
    const passMatches = {};

    for (const pass of passes) {
      const passDate = new Date(pass.date);
      let closest = null;
      let closestDiff = Infinity;

      for (const billing of billings) {
        const billingDate = new Date(billing.date);
        const diffMs = passDate - billingDate;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (diffDays >= 0 && diffDays <= PASS_WINDOW_DAYS && diffMs < closestDiff) {
          closest = billing;
          closestDiff = diffMs;
        }
      }

      if (closest) {
        matchedBillingIds.add(closest.id);
        passMatches[closest.id] = { passDate: pass.date, accountId: pass.accountId };
      }
    }

    const resetMatches = {};
    for (const reset of resets) {
      const resetDate = new Date(reset.date);
      let closest = null;
      let closestDiff = Infinity;

      for (const billing of billings) {
        const billingDate = new Date(billing.date);
        const diffMs = resetDate - billingDate;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (diffDays >= 0 && diffDays <= 60 && diffMs < closestDiff) {
          closest = billing;
          closestDiff = diffMs;
        }
      }

      if (closest) {
        resetMatches[reset.id] = { amount: closest.amount, accountSize: closest.accountSize };
      }
    }

    const combines = billings.map(({ body, ...e }) => {
      const status = matchedBillingIds.has(e.id) ? "Passed" : "Closed";
      const passDate = passMatches[e.id]?.passDate || null;
      const accountId = passMatches[e.id]?.accountId || e.accountId || null;
      return { ...e, status, passDate, accountId };
    });

    const resetCombines = resets.map(({ body, ...e }) => {
      const match = resetMatches[e.id] || {};
      return {
        ...e,
        amount: match.amount || null,
        accountSize: match.accountSize || null,
        status: "Closed",
        isReset: true,
        passDate: null,
      };
    });

    const allCombines = [...combines, ...resetCombines]
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return Response.json({ emails: allCombines });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
