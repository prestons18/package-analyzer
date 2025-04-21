import {
  MetadataExtractor,
  PackageMetadataDetails,
  FrameworkInfo,
  UtilityLibrary,
} from "../interfaces/MetadataExtractor";
import * as fs from "fs/promises";

export class PackageMetadataExtractor implements MetadataExtractor {
  // Framework detection patterns
  private readonly FRAMEWORK_PATTERNS = {
    react: /^react$/,
    vue: /^vue$/,
    svelte: /^svelte$/,
    angular: /^@angular\/core$/,
    next: /^next$/,
    nuxt: /^nuxt$/,
    remix: /^@remix-run\/react$/,
    gatsby: /^gatsby$/,
    astro: /^astro$/,
  };

  // Utility library patterns by category
  private readonly UTILITY_PATTERNS = {
    styling: {
      tailwindcss: /^tailwindcss$/,
      "styled-components": /^styled-components$/,
      emotion: /^@emotion\/react$/,
      sass: /^sass$/,
      less: /^less$/,
      postcss: /^postcss$/,
    },
    utility: {
      clsx: /^clsx$/,
      classnames: /^classnames$/,
    },
    "state-management": {
      redux: /^redux$/,
      mobx: /^mobx$/,
      zustand: /^zustand$/,
      recoil: /^recoil$/,
      jotai: /^jotai$/,
    },
  };

  async extract(packageJsonPath: string): Promise<PackageMetadataDetails> {
    const raw = await fs.readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(raw);

    // Combine dependencies and devDependencies for detection
    const allDependencies = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {}),
    };

    // Detect framework
    const framework = this.detectFramework(allDependencies);

    // Detect utility libraries
    const utilityLibraries = this.detectUtilityLibraries(allDependencies);

    return {
      dependencies: packageJson.dependencies || {},
      devDependencies: packageJson.devDependencies || {},
      scripts: packageJson.scripts || {},
      version: packageJson.version || "0.0.0",
      framework,
      utilityLibraries,
    };
  }

  private detectFramework(
    dependencies: Record<string, string>
  ): FrameworkInfo | undefined {
    for (const [frameworkName, pattern] of Object.entries(
      this.FRAMEWORK_PATTERNS
    )) {
      for (const [depName, version] of Object.entries(dependencies)) {
        if (pattern.test(depName)) {
          return {
            name: frameworkName,
            version,
            isPrimary: true,
          };
        }
      }
    }
    return undefined;
  }

  private detectUtilityLibraries(
    dependencies: Record<string, string>
  ): UtilityLibrary[] {
    const detected: UtilityLibrary[] = [];

    for (const [category, patterns] of Object.entries(this.UTILITY_PATTERNS)) {
      for (const [libName, pattern] of Object.entries(patterns)) {
        for (const [depName, version] of Object.entries(dependencies)) {
          if (pattern.test(depName)) {
            detected.push({
              name: libName,
              version,
              category: category as
                | "styling"
                | "utility"
                | "state-management"
                | "other",
            });
          }
        }
      }
    }

    return detected;
  }
}
