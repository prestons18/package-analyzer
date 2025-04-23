// Core exports
export { ComponentFinder } from "./finders/ComponentFinder";
export { MonorepoDetector } from "./detectors/MonorepoDetector";
export { FrameworkDetector } from "./detectors/FrameworkDetector";
export { PackageAnalyzer } from "./core/PackageAnalyzer";
export { ComponentScanner } from "./core/ComponentScanner";
export { getBestComponentFolder } from "./utils/GetBestComponentFolder";

// Core types
export type { FrameworkInfo, ToolInfo, PackageMetadata } from "./core/types";
export type {
  FrameworkInfo as FrameworkInfoExt,
  UtilityLibrary,
  PackageMetadataDetails,
} from "./interfaces/MetadataExtractor";
export type { FoundComponent } from "./interfaces/Finder";
export type {
  ComponentMetadata,
  ExportType,
} from "./interfaces/ComponentMetadata";
export type { DetectionResult } from "./interfaces/Detector";

// Interface types (for type checking only)
export type { MetadataExtractor } from "./interfaces/MetadataExtractor";
export type { Finder } from "./interfaces/Finder";
export type { Formatter } from "./interfaces/Formatter";
export type { Detector } from "./interfaces/Detector";
