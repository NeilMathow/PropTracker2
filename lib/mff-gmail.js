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

// Parse purchase receipts
// Subject: "Your Tradovate Account Purchase Receipt"
// Extracts: accountId, purchasePrice, purchaseDate, accountSize
export function parsePurchases(emails) {
  return emails.map((e) => {
    const accountIdMatch = e.body.match(/Account ID[:\s]+([A-Z0-9-]+)/i);
    const purchasePriceMatch = e.body.match(/Purchase Price[:\s]+([\d.]+)/i);
    const purchaseDateMatch = e.body.match(/Purchase Date[:\s]+([\d\-: ]+)/i);
    const accountSizeMatch = e.body.match(/Tradovate\s+([\d.]+)\s+account/i);

    return {
      ...e,
      accountId: accountIdMatch?.[1] || null,
      purchasePrice: purchasePriceMatch ? parseFloat(purchasePriceMatch[1]) : null,
      amount: purchasePriceMatch ? parseFloat(purchasePriceMatch[1]) : null,
      purchaseDate: purchaseDateMatch?.[1]?.trim() || null,
      accountSize: accountSizeMatch ? parseFloat(accountSizeMatch[1]) : null,
    };
  });
}

// Parse passed evaluations
// Subject: "You Passed Your Evaluation!"
// Extracts: accountId
export function parsePasses(emails) {
  return emails.map((e) => {
    const accountIdMatch = e.body.match(/Account ID[:\s]+([A-Z0-9-]+)/i);
    return {
      ...e,
      accountId: accountIdMatch?.[1] || null,
    };
  });
}

// Parse breach notifications
// Subject: "Breach Detected"
// Extracts: accountId, reason
export function parseBreaches(emails) {
  return emails.map((e) => {
    const accountIdMatch = e.body.match(/Account ID[:\s]+([A-Z0-9-]+)/i);
    const reasonMatch = e.body.match(/Reason[:\s]+(.+)/i);
    return {
      ...e,
      accountId: accountIdMatch?.[1] || null,
      reason: reasonMatch?.[1]?.trim() || null,
    };
  });
}
