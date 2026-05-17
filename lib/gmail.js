import { google } from "googleapis";

export async function getGmailAuth(accessToken) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
}

const stripHtml = (html) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const extractBody = (parts) => {
  let htmlFallback = null;
  for (const part of parts || []) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      return Buffer.from(part.body.data, "base64").toString("utf-8");
    }
    if (part.mimeType === "text/html" && part.body?.data) {
      htmlFallback = stripHtml(Buffer.from(part.body.data, "base64").toString("utf-8"));
    }
    if (part.parts) {
      const result = extractBody(part.parts);
      if (result) return result;
    }
  }
  return htmlFallback;
};

export async function fetchEmails(gmail, query, maxResults = 100, pageToken = null) {
  const response = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
    pageToken: pageToken || undefined,
  });

  const emails = [];
  const seenMessageIds = new Set();
  const seenThreadIds = new Set();

  for (const msg of response.data.messages || []) {
    const full = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
      format: "full",
    });

    const threadId = full.data.threadId;

    // If we haven't seen this thread, fetch ALL messages in it
    if (!seenThreadIds.has(threadId)) {
      seenThreadIds.add(threadId);

      const thread = await gmail.users.threads.get({
        userId: "me",
        id: threadId,
        format: "full",
      });

      for (const threadMsg of thread.data.messages || []) {
        if (seenMessageIds.has(threadMsg.id)) continue;
        seenMessageIds.add(threadMsg.id);

        const headers = threadMsg.payload.headers;
        const date = headers.find((h) => h.name === "Date")?.value;
        const subject = headers.find((h) => h.name === "Subject")?.value;
        const from = headers.find((h) => h.name === "From")?.value || "";

        if (!from.includes("topstep.com")) continue;

        let body = "";
        if (threadMsg.payload.parts) {
          body = extractBody(threadMsg.payload.parts) || "";
        } else if (threadMsg.payload.body?.data) {
          const raw = Buffer.from(threadMsg.payload.body.data, "base64").toString("utf-8");
          body = raw.includes("<") ? stripHtml(raw) : raw;
        }

        emails.push({ id: threadMsg.id, date, subject, body });
      }
    }
  }

  return {
    emails,
    resultSizeEstimate: response.data.resultSizeEstimate || 0,
    nextPageToken: response.data.nextPageToken,
  };
}

// Parse combines
export function parseCombines(emails) {
  return emails.map((e) => {
    const sizeMatch = e.body.match(/\$(\d{2,3}(?:,\d{3})*(?:\.\d{2})?)/);
    const size = sizeMatch ? sizeMatch[1] : null;
    const type = e.body.toLowerCase().includes("express") ? "Express" : "Standard";
    return { ...e, size, type };
  });
}

function extractSpendingAmount(body) {
  const patterns = [
    /been charged \$?(\d+(?:,\d+)?(?:\.\d{2})?)/i,
    /charged \$(\d+(?:,\d+)?(?:\.\d{2})?)/i,
    /charged (\d+(?:\.\d{2})?)/i,
    /activation fee of \$(\d+(?:,\d+)?(?:\.\d{2})?)/i,
    /fee of \$(\d+(?:,\d+)?(?:\.\d{2})?)/i,
    /payment of \$(\d+(?:,\d+)?(?:\.\d{2})?)/i,
    /payment of (\d+(?:\.\d{2})?)/i,
    /total[^\$\d]*\$?(\d+(?:,\d+)?(?:\.\d{2})?)/i,
    /amount[^\$\d]*\$?(\d+(?:,\d+)?(?:\.\d{2})?)/i,
    /\$(\d+(?:,\d+)?(?:\.\d{2})?)/,
  ];

  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) return parseFloat(match[1].replace(/,/g, ""));
  }
  return null;
}

function extractSpendingAccount(body) {
  const match = body.match(/([A-Z0-9]+-V\d+-\d+-\d+)/);
  return match ? match[1] : null;
}

export function parseSpending(credentialsEmails, resetEmails, startedEmails, activationEmails = [], violationEmails = []) {
  // Regular purchases - credentials and started emails
  const purchaseEmails = [...credentialsEmails, ...startedEmails, ...violationEmails].map((e) => ({
    ...e,
    amount: extractSpendingAmount(e.body),
    account: extractSpendingAccount(e.body),
    isReset: false,
    isEstimate: false,
  }));

  // Activation fee emails - read actual amount from email
  const activations = activationEmails.map((e) => ({
    ...e,
    amount: extractSpendingAmount(e.body),
    account: extractSpendingAccount(e.body),
    isReset: false,
    isEstimate: false,
  }));

  // Sort all purchases by date for reset lookup
  const allPurchases = [...purchaseEmails, ...activations].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  // Resets copy price + account from closest previous purchase
  const resets = resetEmails.map((e) => {
    const resetDate = new Date(e.date);
    let prevPurchase = null;
    for (const p of allPurchases) {
      if (new Date(p.date) <= resetDate) prevPurchase = p;
      else break;
    }
    return {
      ...e,
      amount: prevPurchase?.amount || null,
      account: prevPurchase?.account || null,
      isReset: true,
      isEstimate: !prevPurchase,
    };
  });

  return [...purchaseEmails, ...activations, ...resets].filter((e) => e.amount && e.amount > 0).sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );
}

function extractAccount(body) {
  const match = body.match(/([A-Z0-9]+-V\d+-\d+-\d+)/);
  return match ? match[1] : null;
}

function extractAmount(body) {
  const patterns = [
    /payout of \$(\d+(?:,\d+)?(?:\.\d{2})?)/i,
    /in the amount of \$(\d+(?:,\d+)?(?:\.\d{2})?)/i,
    /amount of \$(\d+(?:,\d+)?(?:\.\d{2})?)/i,
    /approved.*\$(\d+(?:,\d+)?(?:\.\d{2})?)/i,
    /\$(\d+(?:,\d+)?(?:\.\d{2})?)/,
  ];

  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) return parseFloat(match[1].replace(/,/g, ""));
  }
  return null;
}

export function parsePayouts(processingEmails, approvedEmails, receivedEmails) {
  const results = [];

  for (const e of receivedEmails) {
    const account = extractAccount(e.body);
    const amount = extractAmount(e.body);
    results.push({ ...e, account, amount });
  }

  const sortedApproved = [...approvedEmails].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );
  const usedApproved = new Set();

  for (const e of processingEmails) {
    const processedDate = new Date(e.date);
    const account = extractAccount(e.body);

    let matchedApproved = null;
    let smallestDiff = Infinity;

    for (let i = 0; i < sortedApproved.length; i++) {
      if (usedApproved.has(i)) continue;
      const approvedDate = new Date(sortedApproved[i].date);
      const diff = approvedDate - processedDate;
      if (diff >= 0 && diff < smallestDiff) {
        smallestDiff = diff;
        matchedApproved = { email: sortedApproved[i], index: i };
      }
    }

    let amount = null;
    if (matchedApproved) {
      usedApproved.add(matchedApproved.index);
      amount = extractAmount(matchedApproved.email.body);
    }

    results.push({ ...e, account, amount });
  }

  return results.sort((a, b) => new Date(b.date) - new Date(a.date));
}
