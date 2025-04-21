import { Detector, DetectionResult } from "../interfaces/Detector";
import * as fs from "fs/promises";
import * as path from "path";

export class MonorepoDetector implements Detector {
  private readonly MONOREPO_INDICATORS = [
    "lerna.json",
    "pnpm-workspace.yaml",
    "rush.json",
    "nx.json",
    "turbo.json",
  ];

  async detect(projectPath: string): Promise<DetectionResult> {
    try {
      // Check for monorepo configuration files
      const hasMonorepoConfig = await this.checkMonorepoConfigs(projectPath);
      if (hasMonorepoConfig) {
        return { rootPath: projectPath, isMonorepo: true };
      }

      // Check package.json for workspaces
      const pkgJson = path.join(projectPath, "package.json");
      const data = await fs.readFile(pkgJson, "utf-8");
      const pkg = JSON.parse(data);

      // Check for workspaces field
      if (pkg.workspaces) {
        const workspaces = Array.isArray(pkg.workspaces)
          ? pkg.workspaces
          : pkg.workspaces.packages || [];

        // Filter out wildcard patterns and check if there are actual workspace paths
        const actualWorkspaces = workspaces.filter(
          (workspace: string) => !workspace.includes("*")
        );

        if (actualWorkspaces.length > 0) {
          return { rootPath: projectPath, isMonorepo: true };
        }
      }

      // Check for multiple package.json files in subdirectories
      const hasMultiplePackages = await this.checkMultiplePackages(projectPath);
      if (hasMultiplePackages) {
        return { rootPath: projectPath, isMonorepo: true };
      }

      return { rootPath: projectPath, isMonorepo: false };
    } catch (error) {
      console.error("Error detecting monorepo:", error);
      return { rootPath: projectPath, isMonorepo: false };
    }
  }

  private async checkMonorepoConfigs(projectPath: string): Promise<boolean> {
    try {
      const files = await fs.readdir(projectPath);
      return this.MONOREPO_INDICATORS.some((indicator) =>
        files.includes(indicator)
      );
    } catch {
      return false;
    }
  }

  private async checkMultiplePackages(projectPath: string): Promise<boolean> {
    try {
      const packageJsonCount = await this.countPackageJsonFiles(projectPath);
      return packageJsonCount > 1;
    } catch {
      return false;
    }
  }

  private async countPackageJsonFiles(dir: string): Promise<number> {
    let count = 0;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          count += await this.countPackageJsonFiles(path.join(dir, entry.name));
        } else if (entry.name === "package.json") {
          count++;
        }
      }
    } catch (error) {
      console.error(`Error counting package.json files in ${dir}:`, error);
    }
    return count;
  }
}
