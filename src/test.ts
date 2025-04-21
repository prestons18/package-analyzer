import { PackageAnalyzer } from "./core/PackageAnalyzer";
import { MonorepoDetector } from "./detectors/MonorepoDetector";
import { ComponentFinder } from "./finders/ComponentFinder";
import path from "path";
import chalk from "chalk";

const analyzer = new PackageAnalyzer(
  path.join(process.cwd(), "headlessui"),
  new MonorepoDetector(),
  new ComponentFinder()
);

async function extractMetadata() {
  try {
    console.log(chalk.blue("\n=== Package Analysis Started ==="));
    console.time("Analysis Duration");

    const conciseMetadata = await analyzer.analyze(false);

    console.log(chalk.green("\n=== Raw Metadata JSON ==="));
    console.log(JSON.stringify(conciseMetadata, null, 2));

    console.timeEnd("Analysis Duration");
    console.log(chalk.blue("\n=== Analysis Complete ==="));
  } catch (error) {
    console.error(chalk.red("\nError during analysis:"), error);
    process.exit(1);
  }
}

// Run the analysis
extractMetadata();
