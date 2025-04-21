import path from "path";
import * as fs from "fs/promises";

export type FrameworkType = "react" | "vue" | "svelte" | "angular" | "unknown";

export class FrameworkDetector {
  private readonly FRAMEWORK_EXTENSIONS: Record<FrameworkType, string[]> = {
    react: [".jsx", ".tsx"],
    vue: [".vue"],
    svelte: [".svelte"],
    angular: [".component.ts", ".component.html"],
    unknown: [".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte"],
  };

  public async detect(projectPath: string): Promise<FrameworkType> {
    try {
      // First check if the path itself indicates a framework
      if (projectPath.includes("react")) {
        return "react";
      } else if (projectPath.includes("vue")) {
        return "vue";
      } else if (projectPath.includes("svelte")) {
        return "svelte";
      } else if (projectPath.includes("angular")) {
        return "angular";
      }

      // Then check package.json
      const packageJsonPath = path.join(projectPath, "package.json");
      const raw = await fs.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(raw);

      // Check for workspaces
      if (packageJson.workspaces) {
        const workspaces = Array.isArray(packageJson.workspaces)
          ? packageJson.workspaces
          : packageJson.workspaces.packages || [];

        // Check each workspace for framework dependencies
        for (const workspace of workspaces) {
          const workspacePath = path.join(projectPath, workspace);
          try {
            const workspacePackageJsonPath = path.join(
              workspacePath,
              "package.json"
            );
            const workspaceRaw = await fs.readFile(
              workspacePackageJsonPath,
              "utf-8"
            );
            const workspacePackageJson = JSON.parse(workspaceRaw);

            const workspaceDependencies = {
              ...(workspacePackageJson.dependencies || {}),
              ...(workspacePackageJson.devDependencies || {}),
            };

            // Check for framework-specific dependencies in workspace
            if (
              workspaceDependencies.react ||
              workspaceDependencies["react-dom"]
            )
              return "react";
            if (workspaceDependencies.vue) return "vue";
            if (workspaceDependencies.svelte) return "svelte";
            if (workspaceDependencies["@angular/core"]) return "angular";
          } catch (error) {
            // Skip if workspace package.json doesn't exist or can't be read
            continue;
          }
        }
      }

      const dependencies = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {}),
      };

      // Check for framework-specific dependencies in root package.json
      if (dependencies.react || dependencies["react-dom"]) return "react";
      if (dependencies.vue) return "vue";
      if (dependencies.svelte) return "svelte";
      if (dependencies["@angular/core"]) return "angular";

      // Check for framework-specific files
      const files = await fs.readdir(projectPath);
      for (const file of files) {
        if (file.endsWith(".jsx") || file.endsWith(".tsx")) {
          return "react";
        } else if (file.endsWith(".vue")) {
          return "vue";
        } else if (file.endsWith(".svelte")) {
          return "svelte";
        } else if (
          file.endsWith(".component.ts") ||
          file.endsWith(".component.html")
        ) {
          return "angular";
        }
      }

      return "unknown";
    } catch (error) {
      console.error(`Error detecting framework in ${projectPath}:`, error);
      return "unknown";
    }
  }

  public getExtensions(framework: FrameworkType): string[] {
    return (
      this.FRAMEWORK_EXTENSIONS[framework] || this.FRAMEWORK_EXTENSIONS.unknown
    );
  }
}
