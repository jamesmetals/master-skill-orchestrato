import fs from "fs-extra";
import { execa } from "execa";

export type ToolId =
  | "node"
  | "npm"
  | "npx"
  | "git"
  | "python"
  | "uv"
  | "gh"
  | "winget";

export interface ToolDefinition {
  id: ToolId;
  label: string;
  commands: string[];
  description: string;
}

export interface ToolStatus {
  id: ToolId;
  label: string;
  description: string;
  installed: boolean;
  detectedCommand: string | null;
  installCommand: string | null;
}

const WINDOWS_GH_PATH = "C:\\Program Files\\GitHub CLI\\gh.exe";

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    id: "node",
    label: "Node.js",
    commands: ["node"],
    description: "Runtime required by the CLI and npm-based frameworks.",
  },
  {
    id: "npm",
    label: "npm",
    commands: ["npm"],
    description: "Package manager used to publish and install this CLI.",
  },
  {
    id: "npx",
    label: "npx",
    commands: ["npx"],
    description: "Runs package executables without global installs.",
  },
  {
    id: "git",
    label: "Git",
    commands: ["git"],
    description: "Version control and source retrieval for frameworks.",
  },
  {
    id: "python",
    label: "Python",
    commands: ["python", "python3"],
    description: "Runtime required by Spec Kit and uv bootstrapping.",
  },
  {
    id: "uv",
    label: "uv",
    commands: ["uv", "uvx"],
    description: "Python package runner required by Spec Kit.",
  },
  {
    id: "gh",
    label: "GitHub CLI",
    commands: ["gh"],
    description: "Useful for repository creation and GitHub automation.",
  },
  {
    id: "winget",
    label: "winget",
    commands: ["winget"],
    description: "Windows package manager used for bootstrap installs.",
  },
];

export const FRAMEWORK_TOOL_REQUIREMENTS: Record<string, ToolId[]> = {
  bmad: ["node", "npx"],
  "spec-kit": ["python", "uv"],
  "antigravity-kit": ["node", "npx"],
};

export async function hasCommand(command: string): Promise<boolean> {
  const probe = process.platform === "win32" ? "where" : "which";

  try {
    await execa(probe, [command]);
    return true;
  } catch {
    return false;
  }
}

async function detectCommand(commands: string[]): Promise<string | null> {
  for (const command of commands) {
    if (await hasCommand(command)) {
      return command;
    }
  }

  return null;
}

async function canRunPythonUv(): Promise<boolean> {
  try {
    await execa("python", ["-m", "uv", "--version"]);
    return true;
  } catch {
    return false;
  }
}

export async function getUvToolRunPrefix(): Promise<string | null> {
  if (await hasCommand("uvx")) {
    return "uvx";
  }

  if (await hasCommand("uv")) {
    return "uv tool run";
  }

  if (await canRunPythonUv()) {
    return "python -m uv tool run";
  }

  return null;
}

export async function getGhExecutable(): Promise<string | null> {
  if (await hasCommand("gh")) {
    return "gh";
  }

  if (process.platform === "win32" && fs.existsSync(WINDOWS_GH_PATH)) {
    return `"${WINDOWS_GH_PATH}"`;
  }

  return null;
}

export async function ensureCommands(commands: string[]): Promise<void> {
  const missing: string[] = [];

  for (const command of commands) {
    if (!(await hasCommand(command))) {
      missing.push(command);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required tools: ${missing.join(", ")}`);
  }
}

export function getToolDefinition(toolId: ToolId): ToolDefinition {
  const tool = TOOL_DEFINITIONS.find((entry) => entry.id === toolId);

  if (!tool) {
    throw new Error(`Unsupported tool: ${toolId}`);
  }

  return tool;
}

export async function inspectTools(toolIds?: ToolId[]): Promise<ToolStatus[]> {
  const definitions = toolIds
    ? toolIds.map((toolId) => getToolDefinition(toolId))
    : TOOL_DEFINITIONS;

  const statuses: ToolStatus[] = [];

  for (const definition of definitions) {
    let detectedCommand = await detectCommand(definition.commands);

    if (!detectedCommand && definition.id === "uv" && (await canRunPythonUv())) {
      detectedCommand = "python -m uv";
    }

    if (!detectedCommand && definition.id === "gh") {
      detectedCommand = await getGhExecutable();
    }

    statuses.push({
      id: definition.id,
      label: definition.label,
      description: definition.description,
      installed: Boolean(detectedCommand),
      detectedCommand,
      installCommand: await getBootstrapCommand(definition.id),
    });
  }

  return statuses;
}

async function getWindowsBootstrapCommand(toolId: ToolId): Promise<string | null> {
  const hasWinget = await hasCommand("winget");

  switch (toolId) {
    case "uv":
      if (await hasCommand("python")) {
        return "python -m pip install --user uv";
      }
      return hasWinget
        ? "winget install --id Python.Python.3.12 -e --source winget"
        : null;
    case "gh":
      return hasWinget
        ? "winget install --id GitHub.cli -e --source winget"
        : null;
    case "git":
      return hasWinget ? "winget install --id Git.Git -e --source winget" : null;
    case "python":
      return hasWinget
        ? "winget install --id Python.Python.3.12 -e --source winget"
        : null;
    case "node":
    case "npm":
    case "npx":
      return hasWinget
        ? "winget install --id OpenJS.NodeJS.LTS -e --source winget"
        : null;
    default:
      return null;
  }
}

async function getPosixBootstrapCommand(toolId: ToolId): Promise<string | null> {
  const hasBrew = await hasCommand("brew");

  if (hasBrew) {
    switch (toolId) {
      case "uv":
        return "brew install uv";
      case "gh":
        return "brew install gh";
      case "git":
        return "brew install git";
      case "python":
        return "brew install python";
      case "node":
      case "npm":
      case "npx":
        return "brew install node";
      default:
        return null;
    }
  }

  return null;
}

export async function getBootstrapCommand(toolId: ToolId): Promise<string | null> {
  if (process.platform === "win32") {
    return getWindowsBootstrapCommand(toolId);
  }

  return getPosixBootstrapCommand(toolId);
}

export async function bootstrapTools(
  toolIds: ToolId[],
  dryRun = false,
): Promise<Array<{ toolId: ToolId; command: string; executed: boolean }>> {
  const results: Array<{ toolId: ToolId; command: string; executed: boolean }> = [];

  for (const toolId of toolIds) {
    const definition = getToolDefinition(toolId);
    let detected = await detectCommand(definition.commands);

    if (!detected && toolId === "uv" && (await canRunPythonUv())) {
      detected = "python -m uv";
    }

    if (!detected && toolId === "gh") {
      detected = await getGhExecutable();
    }

    if (detected) {
      continue;
    }

    const command = await getBootstrapCommand(toolId);

    if (!command) {
      throw new Error(`No automatic installer available for ${definition.label}.`);
    }

    if (!dryRun) {
      await execa(command, {
        shell: true,
        stdio: "inherit",
      });
    }

    results.push({
      toolId,
      command,
      executed: !dryRun,
    });
  }

  return results;
}
