import type { DataSource, SourceType } from "./types";

export type Connector = {
  id: DataSource["provider"];
  name: string;
  vendor: string;
  kind: "Messagerie" | "Chat" | "Documents" | "Wiki";
  description: string;
  /** Poids de fiabilité de la source dans le score de confiance (0-15). */
  reliability: number;
};

export const CONNECTORS: Connector[] = [
  { id: "sharepoint",   name: "SharePoint",   vendor: "Microsoft", kind: "Documents",  description: "Bibliothèques de documents officiels et notes légales.", reliability: 15 },
  { id: "confluence",   name: "Confluence",   vendor: "Atlassian", kind: "Wiki",       description: "Base de connaissances et procédures internes.",          reliability: 13 },
  { id: "onedrive",     name: "OneDrive",     vendor: "Microsoft", kind: "Documents",  description: "Fichiers personnels et partagés des employés.",          reliability: 8 },
  { id: "google_drive", name: "Google Drive", vendor: "Google",    kind: "Documents",  description: "Documents, tableurs et PDF partagés.",                   reliability: 8 },
  { id: "outlook",      name: "Outlook",      vendor: "Microsoft", kind: "Messagerie", description: "E-mails échangés avec les clients et les experts.",      reliability: 6 },
  { id: "gmail",        name: "Gmail",        vendor: "Google",    kind: "Messagerie", description: "E-mails échangés avec les clients et les experts.",      reliability: 6 },
  { id: "teams",        name: "Teams",        vendor: "Microsoft", kind: "Chat",       description: "Canaux et conversations d'équipe.",                     reliability: 3 },
  { id: "slack",        name: "Slack",        vendor: "Slack",     kind: "Chat",       description: "Canaux et messages directs.",                           reliability: 3 },
];

export const CONNECTOR_IDS = CONNECTORS.map((c) => c.id);

export const SOURCE_TYPES: SourceType[] = [...CONNECTOR_IDS, "manual"];

export function isConnectorId(value: unknown): value is Connector["id"] {
  return typeof value === "string" && (CONNECTOR_IDS as string[]).includes(value);
}

export function isSourceType(value: unknown): value is SourceType {
  return typeof value === "string" && (SOURCE_TYPES as string[]).includes(value);
}

export function sourceName(type: SourceType) {
  return type === "manual" ? "Saisie manuelle" : (CONNECTORS.find((c) => c.id === type)?.name ?? type);
}

export function sourceReliability(type: SourceType) {
  return type === "manual" ? 5 : (CONNECTORS.find((c) => c.id === type)?.reliability ?? 0);
}
