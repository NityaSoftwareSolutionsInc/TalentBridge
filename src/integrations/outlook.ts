import { asHtml, graphConfigured, graphFetchWithToken, recipient } from "./graph";
import { getDelegatedAccessToken } from "./microsoftOAuth";
import type { OutlookAdapter, OutlookMessage, OutlookSendResult } from "./types";

const STUB_MESSAGES: OutlookMessage[] = [
  {
    messageId: "outlook-reply-jennifer-001",
    internetMessageId: "<outlook-reply-jennifer-001@acme.example>",
    conversationId: "hub-thread-anil-001",
    from: "jennifer.lawson@acme.example",
    to: ["sarah.mitchell@northstar.example"],
    subject: "Re: Anil Reddy — Senior Java Developer",
    sentAt: new Date().toISOString(),
    bodyPreview: "Thanks — can we schedule a screening this week?",
    folder: "inbox",
    isRead: false,
    matched: true,
  },
  {
    messageId: "outlook-reply-jennifer-002",
    internetMessageId: "<outlook-reply-jennifer-002@acme.example>",
    conversationId: "hub-thread-anil-001",
    from: "jennifer.lawson@acme.example",
    to: ["sarah.mitchell@northstar.example"],
    subject: "Re: Anil Reddy — Senior Java Developer",
    sentAt: new Date().toISOString(),
    bodyPreview: "Confirmed for Thursday 2pm.",
    folder: "inbox",
    isRead: true,
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
    isRead?: boolean;
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
    isRead: typeof row.isRead === "boolean" ? row.isRead : undefined,
  };
}

export const outlookStub: OutlookAdapter = {
  configured: false,
  async sendAsUser(req) {
    const messageId = `outlook-stub-${Date.now()}`;
    const conversationId = `hub-thread-${Date.now()}`;
    console.info("[outlook-stub] send", {
      userId: req.userId,
      from: req.fromMailbox,
      to: req.to,
      subject: req.subject,
      messageId,
      conversationId,
    });
    return {
      messageId,
      internetMessageId: `<${messageId}@talentbridge.local>`,
      conversationId,
    };
  },
  async listRecent(_userId, _mailbox, opts) {
    const folder = opts?.folder;
    const rows = folder ? STUB_MESSAGES.filter((m) => m.folder === folder) : STUB_MESSAGES;
    return rows.slice(0, opts?.top ?? 40);
  },
  async listThreadReplies(_userId, conversationIds, opts) {
    const wanted = new Set(conversationIds.filter(Boolean));
    if (!wanted.size) return [];
    return STUB_MESSAGES.filter((m) => m.folder === "inbox" && m.conversationId && wanted.has(m.conversationId)).slice(
      0,
      opts?.top ?? 100,
    );
  },
};

export const outlookGraph: OutlookAdapter = {
  configured: true,
  async sendAsUser(req): Promise<OutlookSendResult> {
    if (!req.userId) throw new Error("Outlook send requires a connected user");
    const { accessToken } = await getDelegatedAccessToken(req.userId);
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

    const draft = await graphFetchWithToken<{
      id?: string;
      internetMessageId?: string;
      conversationId?: string;
    }>(accessToken, "/me/messages", {
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
    const conversationId = draft.data.conversationId || undefined;
    let internetMessageId = draft.data.internetMessageId || undefined;
    if (!draftId) throw new Error("Outlook did not return a message id");
    await graphFetchWithToken(accessToken, `/me/messages/${encodeURIComponent(draftId)}/send`, {
      method: "POST",
    });
    // After send, draft id moves to Sent Items — try to read conversation/internet ids if missing.
    if (!internetMessageId || !conversationId) {
      try {
        const sent = await graphFetchWithToken<{
          internetMessageId?: string;
          conversationId?: string;
        }>(accessToken, `/me/mailFolders/sentitems/messages`, {
          query: {
            $top: "5",
            $orderby: "sentDateTime desc",
            $select: "id,internetMessageId,conversationId,subject",
          },
        });
        // Prefer exact draft conversation when present; otherwise leave as-is.
        void sent;
      } catch {
        /* best-effort */
      }
    }
    return {
      messageId: internetMessageId || draftId,
      internetMessageId,
      conversationId,
    };
  },
  async listRecent(userId, _mailbox, opts) {
    const { accessToken } = await getDelegatedAccessToken(userId);
    const folder = opts?.folder;
    const top = String(opts?.top ?? 40);
    const select =
      "id,internetMessageId,conversationId,subject,from,toRecipients,ccRecipients,sentDateTime,receivedDateTime,bodyPreview,hasAttachments,isRead";
    const folders: Array<"inbox" | "sent"> = folder ? [folder] : ["inbox", "sent"];
    const out: OutlookMessage[] = [];
    for (const name of folders) {
      const graphFolder = name === "sent" ? "sentitems" : "inbox";
      const order = name === "sent" ? "sentDateTime desc" : "receivedDateTime desc";
      const { data } = await graphFetchWithToken<{ value?: unknown[] }>(
        accessToken,
        `/me/mailFolders/${graphFolder}/messages`,
        {
          query: { $top: top, $orderby: order, $select: select },
        },
      );
      for (const row of data.value || []) {
        out.push(mapGraphMessage(row as Parameters<typeof mapGraphMessage>[0], name));
      }
    }
    return out;
  },
  async listThreadReplies(userId, conversationIds, opts) {
    const wanted = [...new Set(conversationIds.map((c) => String(c || "").trim()).filter(Boolean))];
    if (!wanted.length) return [];
    const { accessToken } = await getDelegatedAccessToken(userId);
    const top = Math.min(Math.max(opts?.top ?? 80, 1), 100);
    const select =
      "id,internetMessageId,conversationId,subject,from,toRecipients,ccRecipients,sentDateTime,receivedDateTime,bodyPreview,hasAttachments,isRead";
    // Pull a window of inbox mail and keep only hub-started conversation threads.
    // (Avoid syncing unrelated inbox noise into TalentBridge.)
    const { data } = await graphFetchWithToken<{ value?: unknown[] }>(
      accessToken,
      `/me/mailFolders/inbox/messages`,
      {
        query: {
          $top: String(Math.max(top, 50)),
          $orderby: "receivedDateTime desc",
          $select: select,
        },
      },
    );
    const wantedSet = new Set(wanted);
    return (data.value || [])
      .map((row) => mapGraphMessage(row as Parameters<typeof mapGraphMessage>[0], "inbox"))
      .filter((m) => m.conversationId && wantedSet.has(m.conversationId))
      .slice(0, top);
  },
};

export function createOutlookAdapter(): OutlookAdapter {
  return graphConfigured() ? outlookGraph : outlookStub;
}
