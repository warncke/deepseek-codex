import { AppConfig } from "./AppConfig.js";
import { DeepseekCodexApp } from "./DeepseekCodexApp.js";

async function main(): Promise<void> {
  const config = new AppConfig(process.argv);

  if (process.version) {
    const version = process.version.slice(1);
    const major = parseInt(version.split(".")[0], 10);
    if (major < 24) {
      console.warn(`Warning: Node.js ≥ 24.15.0 LTS is recommended (current: ${process.version})`);
    }
  }

  const app = new DeepseekCodexApp(config);

  try {
    await app.initialize();
    await app.run();
  } catch (err) {
    if (err instanceof Error) {
      console.error(`Error: ${err.message}`);
    } else {
      console.error("An unexpected error occurred:", err);
    }
    process.exit(1);
  }
}

main();
