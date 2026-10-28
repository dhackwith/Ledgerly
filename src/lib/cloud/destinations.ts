// Where an export can go. "Real" destinations work fully in the browser.
// "Simulated" ones walk through the real flow (connect, configure, background job)
// without contacting the service, and the UI labels them as simulated.

export type IntegrationId = "google-sheets" | "google-drive" | "dropbox" | "onedrive" | "slack";
export type DestinationId = "download" | "clipboard" | "link" | "email" | IntegrationId;

export type Glyph = "download" | "clipboard" | "link" | "mail" | "grid" | "triangle" | "box" | "cloud" | "hash";

export interface DestinationDef {
  id: DestinationId;
  name: string;
  description: string;
  /** Tile background. Text on it is always white. */
  color: string;
  glyph: Glyph;
  simulated: boolean;
  /** Needs a connected account first. */
  integration: boolean;
  /** Accepts CSV/JSON files (as opposed to a link, table or message). */
  takesFile: boolean;
  /** Can be the target of an automation. */
  schedulable: boolean;
  /** What the background job says while delivering, e.g. "Uploading to Dropbox". */
  verb: string;
  /** Scopes shown on the simulated consent screen. */
  scopes?: string[];
}

export const DESTINATIONS: Record<DestinationId, DestinationDef> = {
  download: {
    id: "download",
    name: "Download",
    description: "Save a CSV or JSON file to this device",
    color: "#334155",
    glyph: "download",
    simulated: false,
    integration: false,
    takesFile: true,
    schedulable: false,
    verb: "Saving file",
  },
  clipboard: {
    id: "clipboard",
    name: "Copy as table",
    description: "Paste straight into Sheets, Excel or Numbers",
    color: "#0f766e",
    glyph: "clipboard",
    simulated: false,
    integration: false,
    takesFile: false,
    schedulable: false,
    verb: "Copying",
  },
  link: {
    id: "link",
    name: "Share link",
    description: "A private link and QR code, optionally password-protected",
    color: "#2648e0",
    glyph: "link",
    simulated: false,
    integration: false,
    takesFile: false,
    schedulable: false,
    verb: "Creating link",
  },
  email: {
    id: "email",
    name: "Email",
    description: "Send the report with a file attached",
    color: "#7c3aed",
    glyph: "mail",
    simulated: true,
    integration: false,
    takesFile: true,
    schedulable: true,
    verb: "Sending email",
  },
  "google-sheets": {
    id: "google-sheets",
    name: "Google Sheets",
    description: "Write each table to a tab, with optional live sync",
    color: "#188038",
    glyph: "grid",
    simulated: true,
    integration: true,
    takesFile: false,
    schedulable: true,
    verb: "Writing to Google Sheets",
    scopes: ["Create spreadsheets", "Edit spreadsheets that Ledgerly created"],
  },
  "google-drive": {
    id: "google-drive",
    name: "Google Drive",
    description: "Save files to a folder in your Drive",
    color: "#1a73e8",
    glyph: "triangle",
    simulated: true,
    integration: true,
    takesFile: true,
    schedulable: true,
    verb: "Uploading to Google Drive",
    scopes: ["See and add files that Ledgerly creates in your Drive"],
  },
  dropbox: {
    id: "dropbox",
    name: "Dropbox",
    description: "Save files to an app folder in Dropbox",
    color: "#0061fe",
    glyph: "box",
    simulated: true,
    integration: true,
    takesFile: true,
    schedulable: true,
    verb: "Uploading to Dropbox",
    scopes: ["Write files to Apps/Ledgerly", "Read files in Apps/Ledgerly"],
  },
  onedrive: {
    id: "onedrive",
    name: "OneDrive",
    description: "Save files to OneDrive",
    color: "#0364b8",
    glyph: "cloud",
    simulated: true,
    integration: true,
    takesFile: true,
    schedulable: true,
    verb: "Uploading to OneDrive",
    scopes: ["Read and write files in Apps/Ledgerly"],
  },
  slack: {
    id: "slack",
    name: "Slack",
    description: "Post a summary to a channel",
    color: "#611f69",
    glyph: "hash",
    simulated: true,
    integration: true,
    takesFile: false,
    schedulable: true,
    verb: "Posting to Slack",
    scopes: ["Post messages to channels you choose"],
  },
};

export const INTEGRATIONS: IntegrationId[] = ["google-sheets", "google-drive", "dropbox", "onedrive", "slack"];
export const DESTINATION_ORDER: DestinationId[] = ["download", "clipboard", "link", "email", ...INTEGRATIONS];

export const DEFAULT_FOLDER: Record<IntegrationId, string> = {
  "google-sheets": "Ledgerly",
  "google-drive": "My Drive/Ledgerly",
  dropbox: "/Apps/Ledgerly",
  onedrive: "/Apps/Ledgerly",
  slack: "#finance",
};
