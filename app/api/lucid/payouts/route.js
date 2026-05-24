export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getGmailAuth, fetchEmails } from "../../../../lib/lucid-gmail";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) return Response.json({ error: "Not authenticated" }, { status: 401 });

    const gmail = await getGmailAuth(session.accessToken);

    const result = await fetchEmails(
      gmail,
      'subject:"Payout Sent!" from:admin@lucidtrading.com',
      100
    );

    const emails = result.emails.map(({ body, ...e }) => {
      // "Payment Amount\n\n$757.31" — allow newlines between label and value
      const amountMatch = body.match(/Payment Amount[\s\S]{0,20}\$([\d,]+\.?\d{0,2})/i);
      // "Date Processed\n\n5/22/2026 5:40 PM"
      const processedDateMatch = body.match(/Date Processed[\s\S]{0,20}([\d]{1,2}\/[\d]{1,2}\/[\d]{4}\s+[\d]{1,2}:[\d]{2}\s*[APM]+)/i);

      const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : null;

      return {
        ...e,
        amount,
        processedDate: processedDateMatch?.[1]?.trim() || null,
      };
    });

    const total = emails.reduce((sum, e) => sum + (e.amount || 0), 0);

    return Response.json({ emails, total });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
