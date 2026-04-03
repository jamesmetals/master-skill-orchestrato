import path from "node:path";
import fs from "fs-extra";
import { execa } from "execa";
import type { AgentId } from "./agents.js";
import { ensureCommands, getUvToolRunPrefix } from "./tools.js";

export type FrameworkId = "bmad" | "spec-kit" | "antigravity-kit";

export interface FrameworkDefinition {
  id: FrameworkId;
  label: string;
  description: string;
  detect: (cwd: string) => boolean;
  getInstallCommand: (cwd: string, agentId: AgentId) => Promise<string>;
  validate: () => Promise<void>;
}

function getSpecKitAiFlag(agentId: AgentId): string {
  switch (agentId) {
    case "codex":
      return "--ai codex";
    case "claude":
      return "--ai claude";
    case "antigravity":
    case "gemini":
      return "--ai gemini";
    case "copilot":
      return "--ai copilot";
    default:
      return "";
  }
}

const specKitScriptFlag =
  process.platform === "win32" ? "--script ps" : "--script sh";

export const FRAMEWORKS: FrameworkDefinition[] = [
  {
    id: "bmad",
    label: "BMad Method",
    description: "Agile AI-driven development with guided roles and workflows.",
    detect: (cwd) =>
      [
        path.join(cwd, "_bmad"),
        path.join(cwd, "_bmad-output"),
        path.join(cwd, ".claude", "skills", "bmad-help"),
        path.join(cwd, ".agents", "skills", "bmad-help"),
      ].some((candidate) => fs.existsSync(candidate)),
    getInstallCommand: async () => "npx bmad-method install",
    validate: async () => {
      await ensureCommands(["node", "npx"]);
    },
  },
  {
    id: "spec-kit",
    label: "Spec Kit",
    description: "Spec-driven development bootstrap for AI-assisted projects.",
    detect: (cwd) =>
      [
        path.join(cwd, "specs"),
        path.join(cwd, "memory"),
        path.join(cwd, ".github", "prompts"),
        path.join(cwd, ".agents", "commands"),
      ].some((candidate) => fs.existsSync(candidate)),
    getInstallCommand: async (_cwd, agentId) => {
      const uvPrefix = await getUvToolRunPrefix();

      if (!uvPrefix) {
        throw new Error(
          "Missing required tool: uv. Install it first, for example with `master-skill bootstrap --framework spec-kit`.",
        );
      }

      return [
        `${uvPrefix} --from git+https://github.com/github/spec-kit.git specify init .`,
        getSpecKitAiFlag(agentId),
        specKitScriptFlag,
        "--ignore-agent-tools",
      ]
        .filter(Boolean)
        .join(" ");
    },
    validate: async () => {
      await ensureCommands(["python"]);
      const uvPrefix = await getUvToolRunPrefix();

      if (!uvPrefix) {
        throw new Error(
          "Missing required tool: uv. Install it first, for example with `master-skill bootstrap --framework spec-kit`.",
        );
      }
    },
  },
  {
    id: "antigravity-kit",
    label: "Antigravity Kit",
    description: "Google Antigravity project template with agents and workflows.",
    detect: (cwd) =>
      [
        path.join(cwd, ".agent"),
        path.join(cwd, ".agent", "workflows"),
        path.join(cwd, ".agent", "skills"),
      ].some((candidate) => fs.existsSync(candidate)),
    getInstallCommand: async () => "npx @vudovn/ag-kit init",
    validate: async () => {
      await ensureCommands(["node", "npx"]);
    },
  },
];

export function getFrameworkById(id: string): FrameworkDefinition | undefined {
  return FRAMEWORKS.find((framework) => framework.id === id);
}

export async function runFrameworkInstall(
  frameworkId: FrameworkId,
  cwd: string,
  agentId: AgentId,
  dryRun = false,
): Promise<string> {
  const framework = getFrameworkById(frameworkId);

  if (!framework) {
    throw new Error(`Unsupported framework: ${frameworkId}`);
  }

  await framework.validate();
  const command = await framework.getInstallCommand(cwd, agentId);

  if (!dryRun) {
    await execa(command, {
      cwd,
      shell: true,
      stdio: "inherit",
    });
  }

  return command;
}
