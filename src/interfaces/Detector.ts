export interface DetectionResult {
  rootPath: string;
  isMonorepo: boolean;
}

export interface Detector {
  /**
   * Determines whether the project at `projectPath` is a monorepo
   */
  detect(projectPath: string): Promise<DetectionResult>;
}
