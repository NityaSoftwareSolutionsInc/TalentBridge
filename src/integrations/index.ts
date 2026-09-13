import { createJobsNProfilesAdapter } from "./jobsNProfiles";
import { createOutlookAdapter } from "./outlook";
import { createTeamsAdapter } from "./teams";
import { vioTalkStub } from "./vioTalk";

export const integrations = {
  jobsNProfiles: createJobsNProfilesAdapter(),
  vioTalk: vioTalkStub,
  outlook: createOutlookAdapter(),
  teams: createTeamsAdapter(),
};
