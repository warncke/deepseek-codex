#!/usr/bin/env node
import { DeepseekCodexApp } from './DeepseekCodexApp.js';
import { AppConfig } from './AppConfig.js';

const config = new AppConfig(process.argv);
const app = new DeepseekCodexApp(config);

try {
  await app.initialize();
  await app.run();
} catch (err) {
  console.error('Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
}
