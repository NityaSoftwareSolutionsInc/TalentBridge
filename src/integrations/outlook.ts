import { asHtml, graphConfigured, graphFetch, recipient, userPath } from "./graph";
import type { OutlookAdapter, OutlookMessage, OutlookSendRequest, OutlookSendResult } from "./types";

const STUB_MESSAGES: OutlookMessage[] = [
  {
    messageId: "outlook-unmatched-001",
    internetMessageId: "<outlook-unmatched-001@northstar.example>",
    from: "james.dalton@northstar.example",
    to: ["unknown.hiring@example.com"],
    subject: "Profile for review — no TalentBridge requirement selected",
    sentAt: new Date().toISOString(),
    bodyPreview: "Please review the attached profile. Requirement was not selected in TalentBridge.",
    folder: "sent",
    matched: false,
  },
  {
    messageId: "outlook-inbox-jennifer-001",
    internetMessageId: "<outlook-inbox-jennifer-001@acme.example>",
    from: "jennifer.lawson@acme.example",
    to: ["sarah.mitchell@northstar.example"],
    subject: "Re: Anil Reddy — Senior Java Developer",
    sentAt: new Date().toISOString(),
    bodyPreview: "Thanks — can we schedule a screening this week?",
    folder: "inbox",
    matched: true,
  },
];

function toList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).map((s) => s.trim()).filter(Boolean);
}

function addressOf(entry: { emailAddress?: { address?: string } } | undefined): string {
  return String(entry?.emailAddress?.address || "").trim();
}

function mapGraphMessage(
  row: {
    id?: string;
    internetMessageId?: string;
    conversationId?: string;
    subject?: string;
    from?: { emailAddress?: { address?: string } };
    toRecipients?: { emailAddress?: { address?: string } }[];
    ccRecipients?: { emailAddress?: { address?: string } }[];
    sentDateTime?: string;
    receivedDateTime?: string;
    bodyPreview?: string;
    hasAttachments?: boolean;
  },
  folder: "inbox" | "sent",
): OutlookMessage {
  return {
    messageId: String(row.id || ""),
    internetMessageId: row.internetMessageId || undefined,
    conversationId: row.conversationId || undefined,
    from: addressOf(row.from),
    to: (row.toRecipients || []).map(addressOf).filter(Boolean),
    cc: (row.ccRecipients || []).map(addressOf).filter(Boolean),
    subject: String(row.subject || ""),
    sentAt: String(row.sentDateTime || row.receivedDateTime || new Date().toISOString()),
    bodyPreview: String(row.bodyPreview || ""),
    folder,
    hasAttachments: Boolean(row.hasAttachments),
  };
}

export const outlookStub: OutlookAdapter = {
  configured: false,
  async sendAsUser(req) {
    const messageId = `outlook-stub-${Date.now()}`;
    console.info("[outlook-stub] send", {
      from: req.fromMailbox,
      to: req.to,
      subject: req.subject,
      messageId,
    });
    return { messageId, internetMessageId: `<${messageId}@talentbridge.local>` };
  },
  async listRecent(_mailbox, opts) {
    const folder = opts?.folder;
    const rows = folder ? STUB_MESSAGES.filter((m) => m.folder === folder) : STUB_MESSAGES;
    return rows.slice(0, opts?.top ?? 40);
  },
};

export const outlookGraph: OutlookAdapter = {
  configured: true,
  async sendAsUser(req): Promise<OutlookSendResult> {
    const mailbox = req.fromMailbox.trim();
    if (!mailbox) throw new Error("No mailbox mapped for Outlook send");
    const to = toList(req.to);
    if (!to.length) throw new Error("At least one recipient is required");
    const names = (req.attachments || []).map((a) => a.name).filter(Boolean);
    const attachmentNote = names.length ? `Attachments referenced from TalentBridge: ${names.join(", ")}` : "";
    const htmlContent = req.bodyIsHtml
      ? attachmentNote
        ? `${req.body}<div style="margin-top:12px;font-size:12px;color:#64748b;">${attachmentNote}</div>`
        : req.body
      : asHtml(attachmentNote ? `${req.body}\n\n${attachmentNote}` : req.body);
    const attachments = (req.attachments || [])
      .filter((a) => a.contentBytes)
      .map((a) => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: a.name,
        contentType: a.contentType || "application/octet-stream",
        contentBytes: a.contentBytes,
      }));

    const draft = await graphFetch<{ id?: string; internetMessageId?: string }>(`${userPath(mailbox)}/messages`, {
      method: "POST",
      body: {
        subject: req.subject,
        body: { contentType: "HTML", content: htmlContent },
        toRecipients: to.map(recipient),
        ccRecipients: toList(req.cc).map(recipient),
        ...(attachments.length ? { attachments } : {}),
      },
    });
    const draftId = String(draft.data.id || "");
    const internetMessageId = draft.data.internetMessageId || undefined;
    if (!draftId) throw new Error("Outlook did not return a message id");
    await graphFetch(`${userPath(mailbox)}/messages/${encodeURIComponent(draftId)}/send`, { method: "POST" });
    return { messageId: internetMessageId || draftId, internetMessageId };
  },
  async listRecent(mailbox, opts) {
    const folder = opts?.folder;
    const top = String(opts?.top ?? 40);
    const select =
      "id,internetMessageId,conversationId,subject,from,toRecipients,ccRecipients,sentDateTime,receivedDateTime,bodyPreview,hasAttachments";
    const folders: Array<"inbox" | "sent"> = folder ? [folder] : ["inbox", "sent"];
    const out: OutlookMessage[] = [];
    for (const name of folders) {
      const graphFolder = name === "sent" ? "sentitems" : "inbox";
      const order = name === "sent" ? "sentDateTime desc" : "receivedDateTime desc";
      const { data } = await graphFetch<{ value?: unknown[] }>(
        `${userPath(mailbox)}/mailFolders/${graphFolder}/messages`,
        { query: { $top: top, $orderby: order, $select: select } },
      );
      for (const row of data.value || []) {
        out.push(mapGraphMessage(row as Parameters<typeof mapGraphMessage>[0], name));
      }
    }
    return out;
  },
};

export function createOutlookAdapter(): OutlookAdapter {
  return graphConfigured() ? outlookGraph : outlookStub;
}
