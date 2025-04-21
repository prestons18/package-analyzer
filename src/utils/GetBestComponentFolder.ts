import { PackageMetadata } from "src/core/types";
import path from "path";

/**
 * Determines the best component folder based on the discovered components
 * @param metadata The package metadata containing component information
 * @returns The path to the most common component folder, or null if no components found
 */
export function getBestComponentFolder(
  metadata: PackageMetadata
): string | null {
  if (!metadata.components || metadata.components.length === 0) {
    return null;
  }

  // Count occurrences of each component folder
  const folderCounts = new Map<string, number>();
  metadata.components.forEach((component) => {
    const folder = path.dirname(component.path);
    folderCounts.set(folder, (folderCounts.get(folder) || 0) + 1);
  });

  // Find the folder with the most components
  let bestFolder: string | null = null;
  let maxCount = 0;

  folderCounts.forEach((count, folder) => {
    if (count > maxCount) {
      maxCount = count;
      bestFolder = folder;
    }
  });

  if (bestFolder) {
    const parentFolder = path.dirname(bestFolder);
    const parentFolderName = path.basename(parentFolder);
    // Only go up a level if the parent is a components or ui directory
    if (parentFolderName === "components" || parentFolderName === "ui") {
      return parentFolder;
    }
    return bestFolder;
  }

  return null;
}
