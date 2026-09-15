import { NextResponse } from "next/server";
import { OwnershipRequestType, WrapUpOutcome } from "@prisma/client";
import { getSession } from "@/lib/auth";
import {
  addNote,
  addPersonFile,
  adminCreateUser,
  adminResolveException,
  adminSendPasswordEmail,
  adminSetJnpAccount,
  adminSetJnpEnabled,
  adminSetPassword,
  adminSetRecordingPolicy,
  adminUpdateUser,
  adminUpsertJnpMap,
  adminUpsertMailboxMap,
  adminUpsertVioTalkMap,
  changeStage,
  createOrganization,
  createPerson,
  createRequirement,
  decideOwnership,
  exportDashboard,
  ingestOutlookMail,
  placeCall,
  requestOwnership,
  scheduleMeeting,
  sendEmail,
  submitProfile,
  syncJnp,
  toggleDnc,
  updatePerson,
  upsertEmailSignature,
  deleteEmailSignature,
  setDefaultEmailSignature,
  viewCallArtifact,
  viewCommercial,
  wrapUp,
} from "@/lib/queries";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as { action: string; [k: string]: unknown };
    switch (body.action) {
      case "wrap_up":
        return NextResponse.json(
          await wrapUp(session, {
            activityId: body.activityId as string | undefined,
            personId: String(body.personId),
            outcome: body.outcome as WrapUpOutcome,
            nextActionTitle: body.nextActionTitle as string | undefined,
            dueAt: body.dueAt as string | undefined,
            requirementId: body.requirementId as string | undefined,
          }),
        );
      case "call":
        return NextResponse.json(await placeCall(session, String(body.personId)));
      case "submit":
        return NextResponse.json(
          await submitProfile(session, {
            candidateId: String(body.candidateId),
            requirementId: String(body.requirementId),
            clientPersonId: String(body.clientPersonId),
            message: String(body.message || ""),
            resumeName: String(body.resumeName || ""),
          }),
        );
      case "send_email":
        return NextResponse.json(
          await sendEmail(session, {
            personId: String(body.personId),
            subject: String(body.subject || ""),
            body: String(body.body || ""),
            to: body.to as string | undefined,
            cc: body.cc as string | undefined,
            includeSignature: body.includeSignature !== false,
            signatureId: body.signatureId as string | undefined,
          }),
        );
      case "upsert_email_signature":
        return NextResponse.json(
          await upsertEmailSignature(session, {
            id: body.id as string | undefined,
            userId: body.userId as string | undefined,
            name: body.name as string | undefined,
            body: body.body as string | undefined,
            isDefault: body.isDefault as boolean | undefined,
          }),
        );
      case "set_default_email_signature":
        return NextResponse.json(
          await setDefaultEmailSignature(session, {
            id: String(body.id || ""),
            userId: body.userId as string | undefined,
          }),
        );
      case "delete_email_signature":
        return NextResponse.json(
          await deleteEmailSignature(session, {
            id: String(body.id || ""),
            userId: body.userId as string | undefined,
          }),
        );
      case "schedule_meeting":
        return NextResponse.json(
          await scheduleMeeting(session, {
            personId: String(body.personId),
            title: body.title as string | undefined,
            startsAt: String(body.startsAt || ""),
            endsAt: String(body.endsAt || ""),
            body: body.body as string | undefined,
            extraAttendees: body.extraAttendees as string | undefined,
            teams: body.teams !== false,
            requirementId: body.requirementId ? String(body.requirementId) : undefined,
            asInterview: Boolean(body.asInterview),
          }),
        );
      case "ingest_outlook":
        return NextResponse.json(await ingestOutlookMail(session));
      case "stage":
        return NextResponse.json(await changeStage(session, String(body.personId), String(body.stage)));
      case "ownership_request":
        return NextResponse.json(
          await requestOwnership(
            session,
            String(body.personId),
            body.type as OwnershipRequestType,
            String(body.note || ""),
          ),
        );
      case "ownership_decide":
        return NextResponse.json(await decideOwnership(session, String(body.requestId), Boolean(body.accept)));
      case "jnp_sync":
        return NextResponse.json(await syncJnp(session, String(body.portalCandidateId)));
      case "add_person_file":
        return NextResponse.json(
          await addPersonFile(session, {
            personId: body.personId as string | undefined,
            organizationId: body.organizationId as string | undefined,
            name: String(body.name || ""),
            kind: body.kind as string | undefined,
          }),
        );
      case "create_person":
        return NextResponse.json(
          await createPerson(session, {
            name: String(body.name),
            kind: body.kind as "candidate" | "client_person" | "vendor_person",
            email: body.email as string | undefined,
            phone: body.phone as string | undefined,
            title: body.title as string | undefined,
            secondaryTitle: body.secondaryTitle as string | undefined,
            location: body.location as string | undefined,
            linkedIn: body.linkedIn as string | undefined,
            availability: body.availability as string | undefined,
            experienceYears: body.experienceYears as string | number | undefined,
            skills: body.skills as string | string[] | undefined,
            citizenship: body.citizenship as string | undefined,
            workAuthorization: body.workAuthorization as string | undefined,
            visaExpiry: body.visaExpiry as string | undefined,
            willingToRelocate: body.willingToRelocate as string | undefined,
            preferredLocation: body.preferredLocation as string | undefined,
            noticePeriod: body.noticePeriod as string | undefined,
            employmentType: body.employmentType as string | undefined,
            currentRate: body.currentRate as string | undefined,
            expectedRate: body.expectedRate as string | undefined,
            timezone: body.timezone as string | undefined,
            resumeName: body.resumeName as string | undefined,
          }),
        );
      case "update_person":
        return NextResponse.json(
          await updatePerson(session, String(body.personId), {
            name: body.name as string | undefined,
            title: body.title as string | undefined,
            secondaryTitle: body.secondaryTitle as string | undefined,
            email: body.email as string | undefined,
            phone: body.phone as string | undefined,
            location: body.location as string | undefined,
            linkedIn: body.linkedIn as string | undefined,
            availability: body.availability as string | undefined,
            experienceYears: body.experienceYears as string | number | undefined,
            skills: body.skills as string | string[] | undefined,
            citizenship: body.citizenship as string | undefined,
            workAuthorization: body.workAuthorization as string | undefined,
            visaExpiry: body.visaExpiry as string | undefined,
            willingToRelocate: body.willingToRelocate as string | undefined,
            preferredLocation: body.preferredLocation as string | undefined,
            noticePeriod: body.noticePeriod as string | undefined,
            employmentType: body.employmentType as string | undefined,
            currentRate: body.currentRate as string | undefined,
            expectedRate: body.expectedRate as string | undefined,
            timezone: body.timezone as string | undefined,
          }),
        );
      case "create_organization":
        return NextResponse.json(
          await createOrganization(session, {
            name: String(body.name),
            role: body.role as "client" | "vendor",
            industry: body.industry as string | undefined,
            location: body.location as string | undefined,
          }),
        );
      case "create_requirement":
        return NextResponse.json(
          await createRequirement(session, {
            organizationId: String(body.organizationId),
            title: String(body.title),
            skills: String(body.skills || "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            location: String(body.location || ""),
            hiringManagerId: body.hiringManagerId ? String(body.hiringManagerId) : undefined,
            assignedRecruiterIds: Array.isArray(body.assignedRecruiterIds)
              ? (body.assignedRecruiterIds as string[])
              : [],
          }),
        );
      case "note":
        return NextResponse.json(
          await addNote(
            session,
            String(body.personId),
            String(body.body || ""),
            (body.visibility as "shared" | "internal") || "shared",
          ),
        );
      case "dnc":
        return NextResponse.json(await toggleDnc(session, String(body.personId), Boolean(body.on)));
      case "view_call_artifact":
        return NextResponse.json(
          await viewCallArtifact(
            session,
            String(body.activityId || ""),
            body.kind === "transcript" ? "transcript" : "recording",
          ),
        );
      case "view_commercial":
        return NextResponse.json(
          await viewCommercial(session, body.kind === "po" ? "po" : "msa", String(body.id || "")),
        );
      case "export_dashboard":
        return NextResponse.json(await exportDashboard(session));
      case "admin_create_user":
        return NextResponse.json(
          await adminCreateUser(session, {
            name: String(body.name || ""),
            email: String(body.email || ""),
            title: body.title as string | undefined,
            role: body.role,
            enabled: body.enabled as boolean | undefined,
            extraPermissions: body.extraPermissions,
            origin: req.headers.get("origin"),
          }),
        );
      case "admin_update_user":
        return NextResponse.json(
          await adminUpdateUser(session, {
            userId: String(body.userId || ""),
            name: body.name as string | undefined,
            title: body.title as string | undefined,
            enabled: body.enabled as boolean | undefined,
            role: body.role,
            extraPermissions: body.extraPermissions,
          }),
        );
      case "admin_send_password_email":
        return NextResponse.json(
          await adminSendPasswordEmail(session, {
            userId: String(body.userId || ""),
            kind: body.kind,
            origin: req.headers.get("origin"),
          }),
        );
      case "admin_set_password":
        return NextResponse.json(
          await adminSetPassword(session, {
            userId: String(body.userId || ""),
            password: String(body.password || ""),
          }),
        );
      case "admin_upsert_viotalk_map":
        return NextResponse.json(
          await adminUpsertVioTalkMap(session, {
            userId: String(body.userId || ""),
            vioTalkUserId: body.vioTalkUserId as string | undefined,
            assignedNumber: body.assignedNumber as string | undefined,
            clear: Boolean(body.clear),
          }),
        );
      case "admin_upsert_mailbox_map":
        return NextResponse.json(
          await adminUpsertMailboxMap(session, {
            userId: String(body.userId || ""),
            mailbox: body.mailbox as string | undefined,
            clear: Boolean(body.clear),
          }),
        );
      case "admin_upsert_jnp_map":
        return NextResponse.json(
          await adminUpsertJnpMap(session, {
            userId: String(body.userId || ""),
            jnpUserId: body.jnpUserId as string | undefined,
            clear: Boolean(body.clear),
          }),
        );
      case "admin_set_jnp_account":
        return NextResponse.json(
          await adminSetJnpAccount(session, String(body.jnpAccountUserId || ""), { clear: Boolean(body.clear) }),
        );
      case "admin_set_jnp_enabled":
        return NextResponse.json(
          await adminSetJnpEnabled(session, String(body.userId || ""), Boolean(body.enabled)),
        );
      case "admin_resolve_exception":
        return NextResponse.json(await adminResolveException(session, String(body.exceptionId || "")));
      case "admin_set_recording_policy":
        return NextResponse.json(await adminSetRecordingPolicy(session, Boolean(body.allowed)));
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Action failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
