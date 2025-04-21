import path from "path";
import * as fs from "fs/promises";
import {
  FrameworkDetector,
  FrameworkType,
} from "../detectors/FrameworkDetector";
import { FoundComponent } from "../interfaces/Finder";
import { ComponentMetadataExtractor } from "../extractors/ComponentMetadataExtractor";
import * as glob from "glob";

export class ComponentFinder {
  private readonly frameworkDetector = new FrameworkDetector();
  private readonly metadataExtractor = new ComponentMetadataExtractor();
  private readonly fileCache = new Map<string, boolean>();
  private readonly dirCache = new Map<string, boolean>();

  // File patterns to exclude
  private readonly EXCLUDE_PATTERNS = [
    /.stories\./,
    /.stories$/,
    /.test\./,
    /.spec\./,
    /.e2e\./,
    /.config\./,
    /.setup\./,
    /.mock\./,
    /.fixture\./,
    /.d.ts$/,
  ];

  // Directories to ignore (consolidated categories)
  private readonly IGNORE_DIRS = [
    // Build & distribution
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".next",
    "out",
    // Version control & config
    ".git",
    ".github",
    ".vscode",
    ".idea",
    // Testing & documentation
    "examples",
    "stories",
    "test",
    "tests",
    "__tests__",
    "__mocks__",
    "cypress",
    "e2e",
    "docs",
    "documentation",
    // Development tools
    "tools",
    "scripts",
    "utils",
    "helpers",
    "hooks",
    "playground",
    "playgrounds",
    "sandbox",
    "demo",
    "internal",
    // Package management
    "lerna.json",
    "pnpm-workspace.yaml",
    "yarn.lock",
    "package-lock.json",
    // Assets & resources
    "assets",
    "static",
    "media",
    "images",
    "icons",
    "fonts",
    "styles",
    "themes",
    "locales",
    "i18n",
    "translations",
  ];

  // Path patterns to ignore (consolidated from original)
  private readonly IGNORE_PATH_PATTERNS = [
    /\/(playgrounds|examples|test-utils|__tests__|stories|hooks|utils|helpers|test|tests|demo|sandbox|docs)\//,
    /\/(documentation|assets|static|media|images|icons|fonts|styles|themes|locales|i18n|translations|config)\//,
    /\/(scripts|tools|public|build|dist|coverage|\.next|out|node_modules|\.git|\.github|\.vscode|\.idea|internal)\//,
    /\/(lerna\.json|pnpm-workspace\.yaml|yarn\.lock|package-lock\.json)$/,
  ];

  public async find(projectPath: string): Promise<FoundComponent[]> {
    const components: FoundComponent[] = [];

    try {
      // Check if monorepo and process accordingly
      const isMonorepo = await this.isMonorepo(projectPath);

      if (isMonorepo) {
        const workspaces = await this.getWorkspaces(projectPath);
        console.log(`Found ${workspaces.length} workspaces in monorepo`);

        // Process each workspace in parallel
        const workspaceResults = await Promise.all(
          workspaces
            .filter((workspace) => workspace && typeof workspace === "string")
            .map(async (workspace) => {
              // Skip non-component directories
              if (/\/(playground|examples|demo|sandbox)/.test(workspace)) {
                console.log(`Skipping non-component directory: ${workspace}`);
                return [];
              }

              try {
                // Skip if workspace doesn't exist or can't be accessed
                try {
                  await fs.access(workspace);
                } catch {
                  console.warn(
                    `Workspace doesn't exist or can't be accessed: ${workspace}`
                  );
                  return [];
                }

                const workspaceFramework = await this.frameworkDetector.detect(
                  workspace
                );
                if (!workspaceFramework) {
                  console.warn(
                    `Could not detect framework for workspace: ${workspace}`
                  );
                  return [];
                }

                const workspaceComponents: FoundComponent[] = [];

                // Process with priority if it has components folder
                await this.traverseDirectory(
                  workspace,
                  workspaceComponents,
                  workspaceFramework
                );

                return workspaceComponents;
              } catch (error) {
                console.error(
                  `Error processing workspace ${workspace}:`,
                  error
                );
                return [];
              }
            })
        );

        // Flatten results
        workspaceResults.forEach((result) => {
          if (result && Array.isArray(result)) {
            components.push(...result);
          }
        });
      } else {
        // For non-monorepo projects
        const framework = await this.frameworkDetector.detect(projectPath);
        await this.traverseDirectory(projectPath, components, framework);
      }

      return this.sortComponentsByPriority(components);
    } catch (error) {
      console.error("Error finding components:", error);
      return [];
    }
  }

  private sortComponentsByPriority(
    components: FoundComponent[]
  ): FoundComponent[] {
    if (!components || components.length === 0) return [];

    // Group by framework and sort within groups
    const sortByPath = (a: FoundComponent, b: FoundComponent) => {
      // Ensure we have valid paths before using localeCompare
      if (!a || !a.path) return -1;
      if (!b || !b.path) return 1;
      return a.path.localeCompare(b.path);
    };

    const reactComponents = components
      .filter((c) => c?.framework === "react")
      .sort(sortByPath);
    const vueComponents = components
      .filter((c) => c?.framework === "vue")
      .sort(sortByPath);
    const otherComponents = components
      .filter((c) => c && c.framework !== "react" && c.framework !== "vue")
      .sort(sortByPath);

    return [...reactComponents, ...vueComponents, ...otherComponents];
  }

  private async traverseDirectory(
    dirPath: string,
    components: FoundComponent[],
    framework: FrameworkType
  ): Promise<void> {
    if (!dirPath || !components || !framework) {
      console.warn("Missing required parameters for traversing directory");
      return;
    }

    try {
      // Ensure directory exists and is accessible
      try {
        await fs.access(dirPath);
      } catch {
        return; // Skip if directory doesn't exist or can't be accessed
      }

      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      await Promise.all(
        entries.map(async (entry) => {
          if (!entry || !entry.name) return;

          const fullPath = path.join(dirPath, entry.name);

          // Skip if path should be ignored
          if (this.shouldIgnorePath(fullPath)) return;

          if (entry.isDirectory()) {
            // Skip ignored directories
            if (this.shouldIgnoreDirectory(entry.name)) return;

            // Process components directory directly or traverse deeper
            if (/^components$/i.test(entry.name)) {
              await this.processComponentsDirectory(
                fullPath,
                components,
                framework
              );
            } else {
              await this.traverseDirectory(fullPath, components, framework);
            }
            return;
          }

          // Process component files
          if (entry.isFile() && this.isComponentFile(entry.name, framework)) {
            try {
              const component = await this.processComponentFile(
                fullPath,
                framework
              );
              if (component) components.push(component);
            } catch (error) {
              console.error(
                `Error processing component file ${fullPath}:`,
                error
              );
            }
          }
        })
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error(`Error traversing directory ${dirPath}:`, error);
      }
    }
  }

  private shouldIgnoreDirectory(dirName: string): boolean {
    // Check cache first
    if (this.dirCache.has(dirName)) return this.dirCache.get(dirName)!;

    const shouldIgnore = this.IGNORE_DIRS.includes(dirName.toLowerCase());
    this.dirCache.set(dirName, shouldIgnore);
    return shouldIgnore;
  }

  private shouldIgnorePath(fullPath: string): boolean {
    return this.IGNORE_PATH_PATTERNS.some((pattern) => pattern.test(fullPath));
  }

  private isComponentFile(fileName: string, framework: FrameworkType): boolean {
    // Check cache first
    const cacheKey = `${fileName}:${framework}`;
    if (this.fileCache.has(cacheKey)) return this.fileCache.get(cacheKey)!;

    const extensions = this.frameworkDetector.getExtensions(framework);
    const hasComponentExtension = extensions.some((ext) =>
      fileName.endsWith(ext)
    );
    const isNotExcluded = !this.EXCLUDE_PATTERNS.some((pattern) =>
      pattern.test(fileName)
    );

    const isComponent = hasComponentExtension && isNotExcluded;
    this.fileCache.set(cacheKey, isComponent);
    return isComponent;
  }

  private async processComponentFile(
    filePath: string,
    framework: FrameworkType
  ): Promise<FoundComponent | null> {
    try {
      if (!filePath || !framework) {
        console.warn(
          `Missing required parameters for processing file: ${filePath}`
        );
        return null;
      }

      const metadata = await this.metadataExtractor.extract(
        filePath,
        framework
      );
      return {
        path: filePath,
        framework,
        metadata: metadata || {},
      };
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
      return null;
    }
  }

  private async isMonorepo(projectPath: string): Promise<boolean> {
    try {
      const packageJsonPath = path.join(projectPath, "package.json");
      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, "utf-8")
      );
      return !!packageJson.workspaces;
    } catch {
      return false;
    }
  }

  private async getWorkspaces(projectPath: string): Promise<string[]> {
    try {
      const packageJsonPath = path.join(projectPath, "package.json");
      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, "utf-8")
      );

      // Get workspace patterns
      let workspacePatterns: string[] = [];
      if (Array.isArray(packageJson.workspaces)) {
        workspacePatterns = packageJson.workspaces;
      } else if (packageJson.workspaces?.packages) {
        workspacePatterns = packageJson.workspaces.packages;
      }

      // Resolve workspace paths
      const workspacePaths: string[] = [];

      // Process each pattern
      for (const pattern of workspacePatterns) {
        if (pattern.includes("*")) {
          try {
            const matches = glob.sync(pattern, {
              cwd: projectPath,
              absolute: true,
              ignore: ["**/node_modules/**", "**/dist/**", "**/build/**"],
            });
            workspacePaths.push(...matches);
          } catch (error) {
            console.error(`Error resolving glob pattern ${pattern}:`, error);
          }
        } else {
          const workspacePath = path.join(projectPath, pattern);
          try {
            await fs.access(workspacePath);
            workspacePaths.push(workspacePath);
          } catch {
            console.warn(`Workspace path does not exist: ${workspacePath}`);
          }
        }
      }

      // If no workspaces found, check common paths
      if (workspacePaths.length === 0) {
        for (const dir of ["packages", "apps", "src"]) {
          const commonPath = path.join(projectPath, dir);
          try {
            const stats = await fs.stat(commonPath);
            if (stats.isDirectory()) {
              workspacePaths.push(commonPath);

              // For packages dir, add all subdirectories as workspaces
              if (dir === "packages") {
                const entries = await fs.readdir(commonPath, {
                  withFileTypes: true,
                });
                for (const entry of entries) {
                  if (entry.isDirectory()) {
                    workspacePaths.push(path.join(commonPath, entry.name));
                  }
                }
              }
            }
          } catch {}
        }
      }

      return workspacePaths;
    } catch (error) {
      console.error("Error getting workspaces:", error);
      return [];
    }
  }

  private async processComponentsDirectory(
    dirPath: string,
    components: FoundComponent[],
    framework: FrameworkType
  ): Promise<void> {
    // This is nearly identical to traverseDirectory but focused on component folders
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      await Promise.all(
        entries.map(async (entry) => {
          const fullPath = path.join(dirPath, entry.name);

          if (this.shouldIgnorePath(fullPath)) return;

          if (entry.isDirectory()) {
            if (this.shouldIgnoreDirectory(entry.name)) return;
            await this.processComponentsDirectory(
              fullPath,
              components,
              framework
            );
            return;
          }

          if (this.isComponentFile(entry.name, framework)) {
            try {
              const component = await this.processComponentFile(
                fullPath,
                framework
              );
              if (component) components.push(component);
            } catch (error) {
              console.error(
                `Error processing component file ${fullPath}:`,
                error
              );
            }
          }
        })
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
