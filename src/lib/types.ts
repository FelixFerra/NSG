export type Employee = {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string;
  job_title: string | null;
  department: string | null;
  country: string | null;
  created_at: string;
};

export type Client = {
  id: string;
  name: string;
  country: string | null;
  sector: string | null;
  account_owner_id: string | null;
};

export type Context = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  keywords: string[];
};

export type SourceType =
  | "outlook"
  | "gmail"
  | "teams"
  | "slack"
  | "sharepoint"
  | "onedrive"
  | "google_drive"
  | "confluence"
  | "manual";

export type DataSource = {
  id: string;
  employee_id: string;
  provider: Exclude<SourceType, "manual">;
  status: "connected" | "disconnected" | "syncing" | "error";
  connected_at: string | null;
  last_synced_at: string | null;
};

export type Info = {
  id: string;
  title: string;
  content: string;
  source_type: SourceType;
  source_label: string | null;
  source_url: string | null;
  employee_id: string | null;
  client_id: string | null;
  context_id: string | null;
  country: string | null;
  status: "active" | "draft" | "archived" | "rejected";
  is_official: boolean;
  is_signed: boolean;
  superseded_by: string | null;
  valid_until: string | null;
  source_updated_at: string;
};

export type InfoWithRelations = Info & {
  owner: Pick<Employee, "id" | "full_name" | "job_title" | "email"> | null;
  client: Pick<Client, "id" | "name" | "country"> | null;
  context: Pick<Context, "id" | "label" | "slug"> | null;
};

export type Conflict = {
  id: string;
  context_id: string | null;
  original_info_id: string;
  challenger_info_id: string;
  assignee_id: string | null;
  status: "pending" | "accepted" | "rejected" | "obsolete";
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type ExpertiseScore = {
  employee_id: string;
  context_id: string;
  score: number;
};

export type Notification = {
  id: string;
  recipient_id: string;
  sender_id: string | null;
  kind: "review_request" | "handoff" | "resolution";
  conflict_id: string | null;
  client_id: string | null;
  context_id: string | null;
  message: string;
  read_at: string | null;
  created_at: string;
};
