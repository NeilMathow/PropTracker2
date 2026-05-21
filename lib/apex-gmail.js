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
// Subject: "Apex Trader Platform: Payment Receipt" or "Apex Trader Funding: Payment Receipt"
// Extracts: total, accountSize, accountId, invoiceNumber, paymentReference
export function parseBilling(emails) {
  return emails.map((e) => {
    // Total $14.70 or Total $35.00
    const totalMatch = e.body.match(/Total\s+\$\s*([\d,]+\.?\d{0,2})/i);
    // Account size from product line e.g. "25K 4 Contracts" or "100K"
    const sizeMatch = e.body.match(/(\d+)K\s+(?:\d+\s+Contracts|\w)/i);
    // Account ID e.g. APEX-27541-106
    const accountIdMatch = e.body.match(/Account[:\s]+([A-Z]+-\d+-\d+)/i);
    // Invoice number
    const invoiceMatch = e.body.match(/Invoice\s+#([A-Z0-9]+)/i);
    // Payment reference
    const referenceMatch = e.body.match(/Payment Reference[:\s]+(\d+)/i);

    const total = totalMatch ? parseFloat(totalMatch[1].replace(/,/g, "")) : null;
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
// Subject: "Rithmic Reset being Activated" or "Tradovate Reset being Activated"
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
// Subject: "Your Tradovate account is Setup For Apex Trader Funding"
//       or "Your Rithmic account is Setup For Apex Trader Funding"
export function parsePasses(emails) {
  return emails.map((e) => {
    const accountIdMatch = e.body.match(/Account[:\s]+([A-Z]+-\d+-\d+)/i);
    return {
      ...e,
      accountId: accountIdMatch?.[1] || null,
    };
  });
}
