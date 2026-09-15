export type JnpProfile = {
  portalCandidateId: string;
  /** Primary JNP resume row id when known. */
  resumeId?: string | number;
  /** Filename from jnp_resume_files when known. */
  resumeFileName?: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  secondaryTitle?: string;
  previousTitles: string[];
  resumeTitles: string[];
  skills: string[];
  location: string;
  preferredLocation?: string;
  experienceYears: number;
  availability: string;
  noticePeriod?: string;
  linkedIn?: string;
  citizenship?: string;
  workAuthorization?: string;
  willingToRelocate?: string;
  employmentType?: string;
  currentRate?: string;
  expectedRate?: string;
  /** ISO date string when known; usually unset from JNP. */
  visaExpiry?: string | null;
  timezone?: string;
};

export type JnpCaller = {
  requesterUserId: string;
};

export type JnpAuthResult = {
  requesterUserId: string;
  adminUserId?: string;
  email?: string;
  plan?: string;
  packageEndDate?: string | null;
  adapter: "live" | "stub";
};

export type JnpResumeBytes = {
  fileName: string;
  contentType: string;
  body: ArrayBuffer;
};

export interface JobsNProfilesAdapter {
  authenticate(caller: JnpCaller): Promise<JnpAuthResult>;
  fetchProfile(portalCandidateId: string, caller: JnpCaller): Promise<JnpProfile | null>;
  listUpdatedProfiles(): Promise<JnpProfile[]>;
  /** Proxy the resume from /bs/resumes/{userId}/{resumeId}/{fileName}. Do not persist bytes. */
  fetchResumeFile?(input: {
    userId: string;
    resumeId: string;
    fileName: string;
  }): Promise<JnpResumeBytes | null>;
  /** Stream/download primary resume file by JNP resume id. Returns null if unavailable. */
  previewResume?(resumeId: string, caller: JnpCaller): Promise<JnpResumeBytes | null>;
}

export type VioTalkCallRequest = {
  personId: string;
  phone: string;
  userId: string;
};

export type VioTalkCallResult = {
  callId: string;
  durationSeconds: number;
  recordingRef: string;
  transcriptRef: string;
  aiSummary: string;
  proposedFollowUp: string;
};

export interface VioTalkAdapter {
  placeCall(req: VioTalkCallRequest): Promise<VioTalkCallResult>;
  getAgentNumber(vioTalkUserId: string): Promise<string | null>;
}

export type OutlookSendRequest = {
  fromMailbox: string;
  to: string | string[];
  cc?: string[];
  subject: string;
  body: string;
  /** When true, `body` is already HTML and must not be escaped again. */
  bodyIsHtml?: boolean;
  attachments?: { name: string; contentType?: string; contentBytes?: string }[];
};

export type OutlookSendResult = {
  messageId: string;
  internetMessageId?: string;
};

export type OutlookMessage = {
  messageId: string;
  internetMessageId?: string;
  conversationId?: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  sentAt: string;
  bodyPreview?: string;
  folder: "inbox" | "sent";
  hasAttachments?: boolean;
  matched?: boolean;
};

export interface OutlookAdapter {
  configured: boolean;
  sendAsUser(req: OutlookSendRequest): Promise<OutlookSendResult>;
  listRecent(
    mailbox: string,
    opts?: { folder?: "inbox" | "sent"; top?: number },
  ): Promise<OutlookMessage[]>;
}

export type TeamsMeetingRequest = {
  fromMailbox: string;
  subject: string;
  body?: string;
  startsAt: string;
  endsAt: string;
  attendees: string[];
  timezone?: string;
};

export type TeamsMeetingResult = {
  graphEventId: string;
  joinUrl: string;
  webLink?: string;
};

export interface TeamsAdapter {
  configured: boolean;
  scheduleMeeting(req: TeamsMeetingRequest): Promise<TeamsMeetingResult>;
}
