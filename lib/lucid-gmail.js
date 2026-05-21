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

export function parsePurchases(emails) {
  return emails.map((e) => {
    const orderNumberMatch = e.body.match(/Order number[:\s]+(\d+)/i);
    const orderDateMatch = e.body.match(/Order date[:\s]+([A-Za-z]+ \d+,? \d{4})/i);
    const productMatch = e.body.match(/Lucid(?:Flex|Pro)\s+(\d+)K/i);
    const productNameMatch = e.body.match(/(Lucid(?:Flex|Pro)\s+\d+K[^\n<]*)/i);
    const productIdMatch = e.body.match(/Product ID\(s\)[:\s]+(\d+)/i);

    // Body has spaces after $ like "$ 84.00" — match Total: $ amount, take last occurrence to skip Subtotal
    const allTotals = [...e.body.matchAll(/Total:\s*\$\s*([\d,]+\.?\d{0,2})/gi)];
    const totalMatch = allTotals.length > 0 ? allTotals[allTotals.length - 1] : null;

    const accountSize = productMatch ? parseInt(productMatch[1]) * 1000 : null;
    const total = totalMatch ? parseFloat(totalMatch[1].replace(/,/g, "")) : null;

    return {
      ...e,
      orderNumber: orderNumberMatch?.[1] || null,
      orderDate: orderDateMatch?.[1] || null,
      productName: productNameMatch?.[1]?.trim() || null,
      accountSize,
      total,
      productId: productIdMatch?.[1] || null,
    };
  });
}

export function parsePasses(emails) {
  return emails.map((e) => {
    const accountIdMatch = e.body.match(/Account ID\(s\)[:\s]+([A-Z0-9]+)/i);
    return {
      ...e,
      accountId: accountIdMatch?.[1] || null,
    };
  });
}
