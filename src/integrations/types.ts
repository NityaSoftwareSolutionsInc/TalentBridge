export type JnpProfile = {
  portalCandidateId: string;
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

export interface JobsNProfilesAdapter {
  fetchProfile(portalCandidateId: string): Promise<JnpProfile | null>;
  listUpdatedProfiles(): Promise<JnpProfile[]>;
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
  to: string;
  subject: string;
  body: string;
  attachments: { name: string }[];
};

export type OutlookMessage = {
  messageId: string;
  from: string;
  to: string[];
  subject: string;
  sentAt: string;
  matched: boolean;
};

export interface OutlookAdapter {
  sendAsUser(req: OutlookSendRequest): Promise<{ messageId: string }>;
  listUnmatched(): Promise<OutlookMessage[]>;
}
