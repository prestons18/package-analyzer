export type ExportType = "default" | "named" | "both";

export interface ComponentMetadata {
  path: string;
  framework: string;
  size?: number;
  lastModified: Date;
  exportType: ExportType;
}
