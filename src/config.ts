import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import type { AgentId } from "./agents.js";

export interface OrchestratorConfig {
  version: number;
  agentId: AgentId;
  globalSkillsDir: string;
  externalSkillsDir: string;
  updatedAt: string;
}

const APP_HOME = path.join(os.homedir(), ".agent-orchestrator");
const CONFIG_PATH = path.join(APP_HOME, "config.json");

export function getAppHome(): string {
  return APP_HOME;
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function loadConfig(): OrchestratorConfig | null {
  if (!fs.existsSync(CONFIG_PATH)) {
    return null;
  }

  return fs.readJsonSync(CONFIG_PATH) as OrchestratorConfig;
}

export function saveConfig(config: OrchestratorConfig): void {
  fs.ensureDirSync(APP_HOME);
  fs.writeJsonSync(CONFIG_PATH, config, { spaces: 2 });
}

export function requireConfig(): OrchestratorConfig {
  const config = loadConfig();

  if (!config) {
    throw new Error(
      "Configuration not found. Run `master-skill init` before using this command.",
    );
  }

  return config;
}
