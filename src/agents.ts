import os from "node:os";
import path from "node:path";
import fs from "fs-extra";

export type AgentId =
  | "codex"
  | "claude"
  | "antigravity"
  | "gemini"
  | "cursor"
  | "windsurf"
  | "copilot";

export interface ProjectTarget {
  markerDir: string;
  skillsDir: string;
}

export interface AgentDefinition {
  id: AgentId;
  label: string;
  aliases: string[];
  globalSkillDirs: string[];
  projectTargets: ProjectTarget[];
  defaultProjectTarget: ProjectTarget;
}

export interface DetectedProjectAgent {
  agent: AgentDefinition;
  target: ProjectTarget;
}

const home = os.homedir();

export const AGENTS: AgentDefinition[] = [
  {
    id: "codex",
    label: "Codex",
    aliases: ["codex", "codex cli", "openai codex"],
    globalSkillDirs: [
      path.join(home, ".agents", "skills"),
      path.join(home, ".codex", "skills"),
    ],
    projectTargets: [
      { markerDir: ".agents", skillsDir: path.join(".agents", "skills") },
      { markerDir: ".codex", skillsDir: path.join(".codex", "skills") },
    ],
    defaultProjectTarget: {
      markerDir: ".agents",
      skillsDir: path.join(".agents", "skills"),
    },
  },
  {
    id: "claude",
    label: "Claude Code / Claw",
    aliases: ["claude", "claude code", "claw"],
    globalSkillDirs: [path.join(home, ".claude", "skills")],
    projectTargets: [
      { markerDir: ".claude", skillsDir: path.join(".claude", "skills") },
    ],
    defaultProjectTarget: {
      markerDir: ".claude",
      skillsDir: path.join(".claude", "skills"),
    },
  },
  {
    id: "antigravity",
    label: "OpenCode / Antigravity",
    aliases: [
      "antigravity",
      "google antigravity",
      "opencode",
      "open code",
      "opencode cli",
    ],
    globalSkillDirs: [path.join(home, ".gemini", "antigravity", "skills")],
    projectTargets: [
      { markerDir: ".agent", skillsDir: path.join(".agent", "skills") },
    ],
    defaultProjectTarget: {
      markerDir: ".agent",
      skillsDir: path.join(".agent", "skills"),
    },
  },
  {
    id: "gemini",
    label: "Gemini CLI",
    aliases: ["gemini", "gemini cli"],
    globalSkillDirs: [path.join(home, ".gemini", "skills")],
    projectTargets: [
      { markerDir: ".gemini", skillsDir: path.join(".gemini", "skills") },
    ],
    defaultProjectTarget: {
      markerDir: ".gemini",
      skillsDir: path.join(".gemini", "skills"),
    },
  },
  {
    id: "cursor",
    label: "Cursor",
    aliases: ["cursor"],
    globalSkillDirs: [path.join(home, ".cursor", "skills")],
    projectTargets: [
      { markerDir: ".cursor", skillsDir: path.join(".cursor", "skills") },
    ],
    defaultProjectTarget: {
      markerDir: ".cursor",
      skillsDir: path.join(".cursor", "skills"),
    },
  },
  {
    id: "windsurf",
    label: "Windsurf",
    aliases: ["windsurf"],
    globalSkillDirs: [path.join(home, ".windsurf", "skills")],
    projectTargets: [
      { markerDir: ".windsurf", skillsDir: path.join(".windsurf", "skills") },
    ],
    defaultProjectTarget: {
      markerDir: ".windsurf",
      skillsDir: path.join(".windsurf", "skills"),
    },
  },
  {
    id: "copilot",
    label: "GitHub Copilot",
    aliases: ["copilot", "github copilot"],
    globalSkillDirs: [path.join(home, ".github", "skills")],
    projectTargets: [
      { markerDir: ".github", skillsDir: path.join(".github", "skills") },
    ],
    defaultProjectTarget: {
      markerDir: ".github",
      skillsDir: path.join(".github", "skills"),
    },
  },
];

export function getAgentById(id: string): AgentDefinition | undefined {
  return AGENTS.find((agent) => agent.id === id);
}

export function resolveAgent(input: string): AgentDefinition | undefined {
  const normalized = input.trim().toLowerCase();
  return AGENTS.find(
    (agent) =>
      agent.id === normalized ||
      agent.label.toLowerCase() === normalized ||
      agent.aliases.includes(normalized),
  );
}

export function findExistingGlobalSkillDirs(agent: AgentDefinition): string[] {
  return agent.globalSkillDirs.filter((dir) => fs.existsSync(dir));
}

export function detectProjectAgents(cwd: string): DetectedProjectAgent[] {
  return AGENTS.flatMap((agent) =>
    agent.projectTargets
      .filter((target) => fs.existsSync(path.join(cwd, target.markerDir)))
      .map((target) => ({ agent, target })),
  );
}

export function getPreferredProjectTarget(
  cwd: string,
  agentId: AgentId,
): ProjectTarget {
  const agent = getAgentById(agentId);

  if (!agent) {
    throw new Error(`Unsupported agent: ${agentId}`);
  }

  const existingTarget = agent.projectTargets.find((target) =>
    fs.existsSync(path.join(cwd, target.markerDir)),
  );

  return existingTarget ?? agent.defaultProjectTarget;
}
