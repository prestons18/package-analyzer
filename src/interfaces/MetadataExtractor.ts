export interface FrameworkInfo {
  name: string;
  version: string;
  isPrimary: boolean;
}

export interface UtilityLibrary {
  name: string;
  version: string;
  category: "styling" | "utility" | "state-management" | "other";
}

export interface PackageMetadataDetails {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  version: string;
  framework?: FrameworkInfo;
  utilityLibraries: UtilityLibrary[];
}

export interface MetadataExtractor {
  /**
   * Extracts essential metadata from a package.json file
   */
  extract(packageJsonPath: string): Promise<PackageMetadataDetails>;
}
