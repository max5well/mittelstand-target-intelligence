export const pipelineStatuses = [
  "new",
  "reviewed",
  "shortlisted",
  "outreach_planned",
  "contacted",
  "in_conversation",
  "nda",
  "diligence",
  "loi",
  "passed",
  "archived",
] as const;

export type PipelineStatus = (typeof pipelineStatuses)[number];

export type OwnershipCategory =
  | "Family-owned"
  | "Founder/individual-owned"
  | "Owner-managed"
  | "Corporate/strategic-owned"
  | "Holding-company-owned"
  | "PE-backed or financial-sponsor-owned"
  | "Publicly listed"
  | "State/municipal-owned"
  | "Foundation/cooperative/nonprofit"
  | "Joint venture/mixed"
  | "Widely held"
  | "Unknown";

export type Company = {
  id: string;
  openregisterCompanyId: string;
  name: string;
  legalForm: string;
  city: string;
  state: string;
  postcode: string;
  industryCode: string;
  industry: string;
  website: string | null;
  employees: number | null;
  employeeYear: number | null;
  apolloEmployees: number | null;
  revenueCents: number | null;
  ebitdaCents: number | null;
  fiscalYear: number | null;
  ownership: OwnershipCategory;
  ownershipConfidence: number;
  ownershipMethod:
    | "openregister_flag"
    | "rules"
    | "ai_with_evidence"
    | "manual";
  ownerSummary: string;
  status: PipelineStatus;
  score: number | null;
  favorite: boolean;
  hydration: string[];
  latitude: number | null;
  longitude: number | null;
  updatedAt: string;
  sourceType: "reported" | "estimated";
  fictional: true;
};

export type Job = {
  id: string;
  company: string;
  provider: string;
  type: string;
  status:
    | "queued"
    | "running"
    | "succeeded"
    | "failed"
    | "retry_wait"
    | "cancelled";
  credits: number;
  duration: string;
  updatedAt: string;
  error?: string;
};
