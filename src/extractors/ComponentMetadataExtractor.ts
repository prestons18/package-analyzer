import * as fs from "fs/promises";
import { FrameworkType } from "../detectors/FrameworkDetector";

export class ComponentMetadataExtractor {
  /**
   * Extract metadata from a component file
   */
  public async extract(
    filePath: string,
    framework: FrameworkType
  ): Promise<any> {
    try {
      const content = await fs.readFile(filePath, "utf-8");

      // Extract basic metadata
      const metadata: any = {
        name: this.extractComponentName(filePath, framework),
        framework,
        size: content.length,
        lines: content.split("\n").length,
      };

      // Extract imports
      metadata.imports = this.extractImports(content);

      // Extract exports
      metadata.exports = this.extractExports(content);

      // Extract hooks (for React)
      if (framework === "react") {
        metadata.hooks = this.extractHooks(content);
      }

      return metadata;
    } catch (error) {
      console.error(`Error extracting metadata from ${filePath}:`, error);
      return {
        name: this.extractComponentName(filePath, framework),
        framework,
        error: "Failed to extract metadata",
      };
    }
  }

  private extractComponentName(
    filePath: string,
    framework: FrameworkType
  ): string {
    const fileName = filePath.split("/").pop() || "";
    const baseName = fileName.split(".")[0];

    // For React components, capitalize the first letter
    if (framework === "react") {
      return baseName.charAt(0).toUpperCase() + baseName.slice(1);
    }

    return baseName;
  }

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex =
      /import\s+(?:{[^}]*}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  private extractExports(content: string): string[] {
    const exports: string[] = [];
    const exportRegex =
      /export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g;

    let match;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    return exports;
  }

  private extractHooks(content: string): string[] {
    const hooks: string[] = [];
    const hookRegex = /(?:function|const)\s+use[A-Z][a-zA-Z0-9]*/g;

    let match;
    while ((match = hookRegex.exec(content)) !== null) {
      hooks.push(match[0].split(/\s+/).pop() || "");
    }

    return hooks;
  }
}
