import { asHtml, graphConfigured, graphFetch, recipient, userPath } from "./graph";
import type { TeamsAdapter, TeamsMeetingRequest, TeamsMeetingResult } from "./types";

function attendeeList(req: TeamsMeetingRequest): string[] {
  return [...new Set(req.attendees.map((a) => a.trim().toLowerCase()).filter(Boolean))];
}

export const teamsStub: TeamsAdapter = {
  configured: false,
  async scheduleMeeting(req): Promise<TeamsMeetingResult> {
    const graphEventId = `teams-stub-${Date.now()}`;
    const joinUrl = `https://teams.microsoft.com/l/meetup-join/talentbridge-stub/${graphEventId}`;
    console.info("[teams-stub] schedule", {
      from: req.fromMailbox,
      subject: req.subject,
      startsAt: req.startsAt,
      attendees: attendeeList(req),
      graphEventId,
    });
    return { graphEventId, joinUrl, webLink: joinUrl };
  },
};

export const teamsGraph: TeamsAdapter = {
  configured: true,
  async scheduleMeeting(req): Promise<TeamsMeetingResult> {
    const mailbox = req.fromMailbox.trim();
    if (!mailbox) throw new Error("No mailbox mapped for Teams scheduling");
    const startsAt = new Date(req.startsAt);
    const endsAt = new Date(req.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new Error("Meeting start and end times are required");
    }
    if (endsAt <= startsAt) throw new Error("Meeting end must be after start");
    const tz = req.timezone || "UTC";
    const { data } = await graphFetch<{
      id?: string;
      webLink?: string;
      onlineMeeting?: { joinUrl?: string };
    }>(`${userPath(mailbox)}/events`, {
      method: "POST",
      body: {
        subject: req.subject,
        body: { contentType: "HTML", content: asHtml(req.body || "") },
        start: { dateTime: startsAt.toISOString().replace("Z", ""), timeZone: tz },
        end: { dateTime: endsAt.toISOString().replace("Z", ""), timeZone: tz },
        attendees: attendeeList(req).map((address) => ({
          ...recipient(address),
          type: "required",
        })),
        isOnlineMeeting: true,
        onlineMeetingProvider: "teamsForBusiness",
        location: { displayName: "Microsoft Teams Meeting" },
      },
    });
    const graphEventId = String(data.id || "");
    const joinUrl = String(data.onlineMeeting?.joinUrl || data.webLink || "");
    if (!graphEventId) throw new Error("Teams did not return a calendar event id");
    return { graphEventId, joinUrl, webLink: data.webLink };
  },
};

export function createTeamsAdapter(): TeamsAdapter {
  return graphConfigured() ? teamsGraph : teamsStub;
}
