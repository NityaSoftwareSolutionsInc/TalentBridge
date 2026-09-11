import type { JobsNProfilesAdapter, JnpProfile } from "./types";
import { jobsNProfilesHttp, jnpHttpConfigured } from "./jobsNProfilesHttp";

const FIXTURES: JnpProfile[] = [
  {
    portalCandidateId: "JNP-104582",
    name: "Anil Reddy",
    email: "anil.reddy@example.com",
    phone: "+1-415-555-0182",
    title: "Senior Java Developer",
    secondaryTitle: "Java Engineer",
    previousTitles: ["Java Engineer", "Backend Java Developer"],
    resumeTitles: ["Senior Java Developer", "Spring Boot Engineer"],
    skills: ["Java", "Spring Boot", "AWS", "Microservices"],
    location: "Austin, TX",
    preferredLocation: "Austin, TX",
    experienceYears: 8,
    availability: "Available",
    noticePeriod: "2 weeks",
    linkedIn: "https://linkedin.com/in/anil-reddy",
    citizenship: "India",
    workAuthorization: "H-1B",
    willingToRelocate: "Yes",
    employmentType: "W2, C2C",
    currentRate: "$75/hr",
    expectedRate: "$85/hr",
    timezone: "",
    visaExpiry: null,
  },
  {
    portalCandidateId: "JNP-204901",
    name: "Maya Chen",
    email: "maya.chen@example.com",
    phone: "+1-206-555-0144",
    title: "DevOps Engineer",
    secondaryTitle: "SRE",
    previousTitles: ["SRE", "Platform Engineer"],
    resumeTitles: ["DevOps Engineer", "Cloud Engineer"],
    skills: ["Kubernetes", "Terraform", "AWS", "CI/CD"],
    location: "Seattle, WA",
    preferredLocation: "Seattle, WA",
    experienceYears: 6,
    availability: "Available",
    noticePeriod: "Immediate",
    linkedIn: "",
    citizenship: "United States",
    workAuthorization: "US Citizen",
    willingToRelocate: "No",
    employmentType: "W2",
    currentRate: "$80/hr",
    expectedRate: "$90/hr",
    timezone: "",
    visaExpiry: null,
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

/** Prefer live JNP HTTP when env is set; otherwise fixture stub for local POC. */
export function createJobsNProfilesAdapter(): JobsNProfilesAdapter {
  return jnpHttpConfigured() ? jobsNProfilesHttp : jobsNProfilesStub;
}
