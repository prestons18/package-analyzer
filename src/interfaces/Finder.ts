import { ComponentMetadata } from "./ComponentMetadata";

export interface FoundComponent {
  path: string;
  framework: string;
  metadata?: ComponentMetadata;
}

export interface Finder {
  /**
   * Finds component directories within `projectPath`.
   */
  find(projectPath: string): Promise<FoundComponent[]>;
}
