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
      'subject:"Payout Sent!" from:hermanojak10@gmail.com',
      1
    );

    const email = result.emails[0];
    if (!email) return Response.json({ error: "No emails found" });

    return Response.json({
      subject: email.subject,
      bodyLength: email.body.length,
      bodySample: email.body.substring(0, 1000),
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
