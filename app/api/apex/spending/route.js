export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getGmailAuth, fetchEmails, parseBilling, parseResets } from "../../../../lib/apex-gmail";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) return Response.json({ error: "Not authenticated" }, { status: 401 });

    const gmail = await getGmailAuth(session.accessToken);
    const pageToken = req.nextUrl.searchParams.get("pageToken");

    const [platformResult, fundingResult, rithmicResetResult, tradovateResetResult] = await Promise.all([
      fetchEmails(gmail, 'subject:"Apex Trader Platform: Payment Receipt" from:noreply@apextraderfunding.com', 100, pageToken),
      fetchEmails(gmail, 'subject:"Apex Trader Funding: Payment Receipt" from:noreply@atf.com', 100, pageToken),
      fetchEmails(gmail, 'subject:"Rithmic Reset being Activated" from:noreply@atf.com', 100, pageToken),
      fetchEmails(gmail, 'subject:"Tradovate Reset being Activated" from:noreply@atf.com', 100, pageToken),
    ]);

    const allBillingEmails = [...platformResult.emails, ...fundingResult.emails];
    const billings = parseBilling(allBillingEmails).map(({ body, ...e }) => e);

    const allResetEmails = [...rithmicResetResult.emails, ...tradovateResetResult.emails];

    const resets = parseResets(allResetEmails).map(({ body, ...e }) => {
      const resetDate = new Date(e.date);
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

      return {
        ...e,
        amount: closest?.amount || null,
        accountSize: closest?.accountSize || null,
        isReset: true,
      };
    });

    const allEmails = [...billings, ...resets]
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const total = allEmails.reduce((sum, e) => sum + (e.amount || 0), 0);

    return Response.json({ emails: allEmails, total });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
