import { google } from "googleapis";

export async function getGmailAuth(accessToken) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
}

export async function fetchEmails(gmail, query, maxResults = 100, pageToken = null) {
  const response = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
    pageToken: pageToken || undefined,
  });

  const emails = [];
  for (const msg of response.data.messages || []) {
    const full = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
      format: "full",
    });

    const headers = full.data.payload.headers;
    const date = headers.find((h) => h.name === "Date")?.value;
    const subject = headers.find((h) => h.name === "Subject")?.value;

    let body = "";

    const extractParts = (payload) => {
      if (payload.parts) {
        for (const part of payload.parts) {
          extractParts(part);
        }
      }
      if (payload.mimeType === "text/plain" && payload.body?.data) {
        body += Buffer.from(payload.body.data, "base64").toString("utf-8");
      }
      if (payload.mimeType === "text/html" && payload.body?.data) {
        const html = Buffer.from(payload.body.data, "base64").toString("utf-8");
        body += html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
      }
    };

    extractParts(full.data.payload);

    if (!body && full.data.payload.body?.data) {
      body = Buffer.from(full.data.payload.body.data, "base64").toString("utf-8");
    }

    emails.push({ id: msg.id, date, subject, body });
  }

  return {
    emails,
    resultSizeEstimate: response.data.resultSizeEstimate || 0,
    nextPageToken: response.data.nextPageToken,
  };
}

// Parse billing emails
export function parseBilling(emails) {
  return emails.map((e) => {
    // Take last "Total $X" to skip Subtotal
    const allTotals = [...e.body.matchAll(/(?<![a-zA-Z])Total\s+\$\s*([\d,]+\.?\d{0,2})/gi)];
    const totalMatch = allTotals.length > 0 ? allTotals[allTotals.length - 1] : null;

    const paymentMatch = e.body.match(/Payment Amount[:\s]+([\d.]+)\s+USD/i);
    const sizeMatch = e.body.match(/(\d+)K\s+(?:\d+\s+Contracts|\w)/i);
    const accountIdMatch = e.body.match(/Account[:\s]+([A-Z]+-\d+-\d+)/i);
    const invoiceMatch = e.body.match(/Invoice\s+#([A-Z0-9]+)/i);
    const referenceMatch = e.body.match(/Payment Reference[:\s]+(\d+)/i);

    const total = totalMatch
      ? parseFloat(totalMatch[1].replace(/,/g, ""))
      : paymentMatch
      ? parseFloat(paymentMatch[1])
      : null;

    const accountSize = sizeMatch ? parseInt(sizeMatch[1]) * 1000 : null;

    return {
      ...e,
      amount: total,
      total,
      accountSize,
      accountId: accountIdMatch?.[1] || null,
      invoiceNumber: invoiceMatch?.[1] || null,
      paymentReference: referenceMatch?.[1] || null,
      isReset: false,
    };
  });
}

// Parse reset emails
export function parseResets(emails) {
  return emails.map((e) => {
    const accountIdMatch = e.body.match(/Account[:\s]+([A-Z]+-\d+-\d+)/i);
    return {
      ...e,
      accountId: accountIdMatch?.[1] || null,
      isReset: true,
    };
  });
}

// Parse pass emails
// Subject contains "Activation Steps for Your Performance Funded Account"
// Also extract account ID from subject line e.g. "Passed APEX-514371-25 Activation Steps..."
export function parsePasses(emails) {
  return emails.map((e) => {
    // Try to get account ID from subject first
    const subjectAccountMatch = e.subject?.match(/([A-Z]+-\d+-\d+)/i);
    // Also try body
    const bodyAccountMatch = e.body.match(/Account[:\s]+([A-Z]+-\d+-\d+)/i);
    const accountId = subjectAccountMatch?.[1] || bodyAccountMatch?.[1] || null;

    return {
      ...e,
      accountId,
    };
  });
}
