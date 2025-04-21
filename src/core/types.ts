import { FoundComponent } from "../interfaces/Finder";
import { PackageMetadataDetails } from "../interfaces/MetadataExtractor";

export interface FrameworkInfo {
  name: string;
  version: string;
  isPrimary: boolean;
}

export interface ToolInfo {
  name: string;
  version: string;
  category: string;
}

export interface PackageMetadata {
  monorepo: boolean;
  packageJson: any;
  components: FoundComponent[];
  metadata: PackageMetadataDetails;
  detectedFrameworks: FrameworkInfo[];
  usedTools: ToolInfo[];
  componentCount: number;
  extensions?: Record<string, any>;
  workspaces?: Array<{
    name: string;
    path: string;
    packageJson?: any;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    scripts: Record<string, string>;
    version: string;
    framework?: {
      name: string;
      version: string;
    };
    utilityLibraries: Array<{
      name: string;
      version: string;
      category: string;
    }>;
  }>;

  /**
   * Determines the best component folder based on the discovered components
   * @returns The path to the most common component folder, or null if no components found
   */
  getBestComponentFolder(): string | null;
}
