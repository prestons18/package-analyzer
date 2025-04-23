import path from "path";
import * as fs from "fs/promises";
import { Detector } from "../interfaces/Detector";
import { Finder } from "../interfaces/Finder";
import { PackageMetadataDetails } from "../interfaces/MetadataExtractor";
import { PackageMetadata } from "./types";
import { getBestComponentFolder } from "../utils";

export class PackageAnalyzer {
  private readonly packageJsonCache: Map<string, any> = new Map();
  private readonly metadataCache: Map<string, PackageMetadataDetails> =
    new Map();

  constructor(
    private readonly projectPath: string,
    private readonly detector: Detector,
    private readonly finder: Finder
  ) {}

  /**
   * Analyze the project: detect monorepo, read package.json, find components
   * @param verbose If true, includes detailed information. If false, provides a more concise output.
   */
  public async analyze(verbose: boolean = false): Promise<PackageMetadata> {
    const metadata: PackageMetadata = {
      monorepo: false,
      packageJson: {},
      components: [],
      metadata: {
        dependencies: {},
        devDependencies: {},
        scripts: {},
        version: "0.0.0",
        framework: undefined,
        utilityLibraries: [],
      },
      detectedFrameworks: [],
      usedTools: [],
      componentCount: 0,
      extensions: {},
      workspaces: [],
      getBestComponentFolder: function () {
        return getBestComponentFolder(this);
      },
    };

    try {
      console.log(`Analyzing project at: ${this.projectPath}`);

      // Run these operations in parallel for better performance
      const [monorepoDetection, packageJson, components] = await Promise.all([
        this.detector.detect(this.projectPath).catch((error) => {
          console.error("Error detecting monorepo:", error);
          return { rootPath: this.projectPath, isMonorepo: false };
        }),
        this.readPackageJson().catch((error) => {
          console.error("Error reading package.json:", error);
          return {};
        }),
        this.finder.find(this.projectPath).catch((error) => {
          console.error("Error finding components:", error);
          return [];
        }),
      ]);

      metadata.monorepo = monorepoDetection.isMonorepo;
      metadata.componentCount = components.length;

      if (metadata.monorepo) {
        console.log("Detected monorepo structure");
      }

      // Extract and process metadata
      if (packageJson && Object.keys(packageJson).length > 0) {
        console.log(
          `Processing package.json: ${packageJson.name || "unnamed package"}`
        );

        if (verbose) {
          metadata.packageJson = packageJson;
          metadata.components = components;
        } else {
          // In non-verbose mode, only include essential package.json fields
          metadata.packageJson = {
            name: packageJson.name,
            version: packageJson.version,
            description: packageJson.description,
            main: packageJson.main,
            types: packageJson.types,
          };

          // In non-verbose mode, only include component paths and frameworks
          metadata.components = components.map((component) => ({
            path: component.path,
            framework: component.framework,
          }));
        }

        // Get root metadata
        try {
          metadata.metadata = await this.extractMetadata(packageJson);
          console.log("Successfully extracted root metadata");
        } catch (error) {
          console.error("Error extracting root metadata:", error);
        }

        // If this is a monorepo, collect metadata from workspace packages
        if (metadata.monorepo && packageJson.workspaces) {
          console.log("Processing workspace packages...");
          const workspaces = Array.isArray(packageJson.workspaces)
            ? packageJson.workspaces
            : packageJson.workspaces.packages || [];

          // Filter out wildcard patterns and get actual workspace paths
          const actualWorkspaces = workspaces.filter(
            (workspace: string) => !workspace.includes("*")
          );

          console.log(`Found ${actualWorkspaces.length} workspace packages`);

          // Collect metadata from each workspace
          const workspaceMetadataPromises = actualWorkspaces.map(
            async (workspace: string) => {
              const workspacePath = path.join(this.projectPath, workspace);
              try {
                console.log(`Processing workspace: ${workspace}`);
                const workspacePackageJsonPath = path.join(
                  workspacePath,
                  "package.json"
                );
                const workspaceRaw = await fs.readFile(
                  workspacePackageJsonPath,
                  "utf-8"
                );
                const workspacePackageJson = JSON.parse(workspaceRaw);

                // Extract metadata from workspace package.json
                const workspaceMetadata = await this.extractMetadata(
                  workspacePackageJson,
                  workspacePath
                );

                // Add workspace name and path to metadata
                return {
                  name: workspacePackageJson.name,
                  path: workspace,
                  packageJson: workspacePackageJson,
                  metadata: workspaceMetadata,
                };
              } catch (error) {
                console.error(
                  `Error processing workspace ${workspace}:`,
                  error
                );
                return null;
              }
            }
          );

          const workspaceMetadataResults = await Promise.all(
            workspaceMetadataPromises
          );

          // Create a workspaces field in the metadata
          metadata.workspaces = workspaceMetadataResults
            .filter(
              (
                result
              ): result is {
                name: string;
                path: string;
                packageJson: any;
                metadata: PackageMetadataDetails;
              } => result !== null
            )
            .map((result) => ({
              name: result.name,
              path: result.path,
              packageJson: result.packageJson,
              dependencies: result.metadata.dependencies,
              devDependencies: result.metadata.devDependencies,
              scripts: result.metadata.scripts,
              version: result.metadata.version,
              framework: result.metadata.framework,
              utilityLibraries: result.metadata.utilityLibraries,
            }));

          console.log(
            `Successfully processed ${metadata.workspaces.length} workspaces`
          );

          // Merge workspace metadata into root metadata
          workspaceMetadataResults.forEach((workspaceMetadata) => {
            if (workspaceMetadata) {
              // Merge dependencies
              metadata.metadata.dependencies = {
                ...metadata.metadata.dependencies,
                ...workspaceMetadata.metadata.dependencies,
              };
              metadata.metadata.devDependencies = {
                ...metadata.metadata.devDependencies,
                ...workspaceMetadata.metadata.devDependencies,
              };

              // Merge scripts
              metadata.metadata.scripts = {
                ...metadata.metadata.scripts,
                ...workspaceMetadata.metadata.scripts,
              };

              // Merge utility libraries
              metadata.metadata.utilityLibraries = [
                ...metadata.metadata.utilityLibraries,
                ...workspaceMetadata.metadata.utilityLibraries,
              ];

              // If workspace has a framework and root doesn't, use workspace's framework
              if (
                !metadata.metadata.framework &&
                workspaceMetadata.metadata.framework
              ) {
                metadata.metadata.framework =
                  workspaceMetadata.metadata.framework;
              }
            }
          });
        }

        try {
          this.processMetadataForStandardizedFields(metadata, verbose);
          console.log("Successfully processed standardized fields");
        } catch (error) {
          console.error("Error processing standardized fields:", error);
        }
      } else {
        console.warn("No package.json found or package.json is empty");
      }
    } catch (error) {
      console.error("Error during package analysis:", error);
      // Return partial results if available
    }

    return metadata;
  }

  /**
   * Read and cache package.json
   */
  private async readPackageJson(): Promise<any> {
    const packageJsonPath = path.join(this.projectPath, "package.json");

    // Check cache first
    if (this.packageJsonCache.has(packageJsonPath)) {
      return this.packageJsonCache.get(packageJsonPath);
    }

    try {
      const raw = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(raw);
      this.packageJsonCache.set(packageJsonPath, packageJson);
      return packageJson;
    } catch (error) {
      console.error(`Error reading package.json: ${error}`);
      return {};
    }
  }

  /**
   * Extract and cache metadata from package.json
   */
  private async extractMetadata(
    packageJson: any,
    packagePath?: string
  ): Promise<PackageMetadataDetails> {
    console.log("fixes linter errors lol changeme:", packagePath);
    const cacheKey = JSON.stringify(packageJson);

    // Check cache first
    if (this.metadataCache.has(cacheKey)) {
      return this.metadataCache.get(cacheKey)!;
    }

    const metadata: PackageMetadataDetails = {
      dependencies: packageJson.dependencies || {},
      devDependencies: packageJson.devDependencies || {},
      scripts: packageJson.scripts || {},
      version: packageJson.version || "0.0.0",
      framework: undefined,
      utilityLibraries: [],
    };

    // Extract framework information
    if (packageJson.dependencies) {
      const frameworkDeps = Object.entries(packageJson.dependencies).filter(
        ([name]) =>
          name.includes("react") ||
          name.includes("vue") ||
          name.includes("angular") ||
          name.includes("svelte")
      );

      if (frameworkDeps.length > 0) {
        const [name, version] = frameworkDeps[0];
        metadata.framework = {
          name,
          version: (version as string).replace(/[\^~]/, ""),
          isPrimary: name.includes("react"),
        };
      }
    }

    // Extract utility libraries
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    for (const [name, version] of Object.entries(allDeps)) {
      const cleanVersion = (version as string).replace(/[\^~]/, "");

      // Categorize utility libraries
      let category: "styling" | "utility" | "state-management" | "other" =
        "other";

      if (
        name.includes("styled") ||
        name.includes("css") ||
        name.includes("sass") ||
        name.includes("less")
      ) {
        category = "styling";
      } else if (
        name.includes("redux") ||
        name.includes("mobx") ||
        name.includes("recoil") ||
        name.includes("zustand")
      ) {
        category = "state-management";
      } else if (
        name.includes("lodash") ||
        name.includes("date-fns") ||
        name.includes("axios")
      ) {
        category = "utility";
      }

      metadata.utilityLibraries.push({
        name,
        version: cleanVersion,
        category,
      });
    }

    // Cache the result
    this.metadataCache.set(cacheKey, metadata);
    return metadata;
  }

  /**
   * Process the extracted metadata to populate standardized fields
   * @param verbose If true, includes detailed information. If false, provides a more concise output.
   */
  private processMetadataForStandardizedFields(
    metadata: PackageMetadata,
    verbose: boolean
  ): void {
    console.log("fixes linter errors changeme", verbose);
    // Process detected frameworks
    if (metadata.metadata.framework) {
      metadata.detectedFrameworks.push(metadata.metadata.framework);
    }

    // Process used tools
    const allDeps = {
      ...metadata.metadata.dependencies,
      ...metadata.metadata.devDependencies,
    };

    for (const [name, version] of Object.entries(allDeps)) {
      if (
        name.includes("webpack") ||
        name.includes("vite") ||
        name.includes("babel") ||
        name.includes("eslint") ||
        name.includes("prettier") ||
        name.includes("jest") ||
        name.includes("typescript")
      ) {
        metadata.usedTools.push({
          name,
          version: version.replace(/[\^~]/, ""),
          category: this.categorizeTool(name),
        });
      }
    }

    // Process file extensions
    if (metadata.components.length > 0) {
      const extensions = new Set<string>();
      metadata.components.forEach((component) => {
        const ext = path.extname(component.path).toLowerCase();
        if (ext) {
          extensions.add(ext);
        }
      });
      metadata.extensions = Object.fromEntries(
        Array.from(extensions).map((ext) => [ext, true])
      );
    }
  }

  private categorizeTool(name: string): string {
    if (name.includes("webpack") || name.includes("vite")) return "bundler";
    if (name.includes("babel")) return "transpiler";
    if (name.includes("eslint")) return "linter";
    if (name.includes("prettier")) return "formatter";
    if (name.includes("jest") || name.includes("mocha")) return "testing";
    if (name.includes("typescript")) return "language";
    return "other";
  }
}
