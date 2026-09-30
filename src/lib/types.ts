export type Employee = {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string;
  job_title: string | null;
  department: string | null;
  country: string | null;
  expertise: string[];
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
  status: "active" | "draft" | "archived";
  valid_until: string | null;
  source_updated_at: string;
};

export type InfoWithRelations = Info & {
  owner: Pick<Employee, "id" | "full_name" | "job_title" | "email"> | null;
  client: Pick<Client, "id" | "name" | "country"> | null;
  context: Pick<Context, "id" | "label" | "slug"> | null;
};
