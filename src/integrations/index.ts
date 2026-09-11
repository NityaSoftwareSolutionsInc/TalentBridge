import { createJobsNProfilesAdapter } from "./jobsNProfiles";
import { outlookStub } from "./outlook";
import { vioTalkStub } from "./vioTalk";

export const integrations = {
  jobsNProfiles: createJobsNProfilesAdapter(),
  vioTalk: vioTalkStub,
  outlook: outlookStub,
};
