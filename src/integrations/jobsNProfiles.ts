import type { JobsNProfilesAdapter, JnpProfile } from "./types";

const FIXTURES: JnpProfile[] = [
  {
    portalCandidateId: "JNP-104582",
    name: "Anil Reddy",
    email: "anil.reddy@example.com",
    phone: "+1-415-555-0182",
    title: "Senior Java Developer",
    previousTitles: ["Java Engineer", "Backend Java Developer"],
    resumeTitles: ["Senior Java Developer", "Spring Boot Engineer"],
    skills: ["Java", "Spring Boot", "AWS", "Microservices"],
    location: "Austin, TX",
    experienceYears: 8,
    availability: "2 weeks",
  },
  {
    portalCandidateId: "JNP-204901",
    name: "Maya Chen",
    email: "maya.chen@example.com",
    phone: "+1-206-555-0144",
    title: "DevOps Engineer",
    previousTitles: ["SRE", "Platform Engineer"],
    resumeTitles: ["DevOps Engineer", "Cloud Engineer"],
    skills: ["Kubernetes", "Terraform", "AWS", "CI/CD"],
    location: "Seattle, WA",
    experienceYears: 6,
    availability: "Immediate",
  },
];

export const jobsNProfilesStub: JobsNProfilesAdapter = {
  async fetchProfile(portalCandidateId) {
    return FIXTURES.find((p) => p.portalCandidateId === portalCandidateId) ?? null;
  },
  async listUpdatedProfiles() {
    return FIXTURES;
  },
};
