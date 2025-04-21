import { Detector } from "../interfaces/Detector";
import { Finder, FoundComponent } from "../interfaces/Finder";
import { Formatter } from "../interfaces/Formatter";
import path from "path";

export class ComponentScanner {
  constructor(
    private detector: Detector,
    private finder: Finder,
    private formatter: Formatter
  ) {}

  /**
   * Scan a project for component folders
   */
  async scan(projectPath: string): Promise<any> {
    const detection = await this.detector.detect(projectPath);
    if (!detection.isMonorepo) {
      const comps = await this.finder.find(projectPath);
      return this.formatter.format(comps);
    }

    const pkg = await import(path.join(projectPath, "package.json"));
    const roots: string[] = Array.isArray(pkg.workspaces) ? pkg.workspaces : [];
    let all: FoundComponent[] = [];
    for (const ws of roots) {
      const fullPath = path.join(projectPath, ws);
      const comps = await this.finder.find(fullPath);
      all = all.concat(comps);
    }
    return this.formatter.format(all);
  }
}
