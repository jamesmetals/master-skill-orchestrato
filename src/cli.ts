#!/usr/bin/env node

import path from "node:path";
import fs from "fs-extra";
import pc from "picocolors";
import {
  cancel,
  confirm,
  intro,
  isCancel,
  note,
  outro,
  select,
  text,
} from "@clack/prompts";
import { Command } from "commander";
import {
  AGENTS,
  detectProjectAgents,
  findExistingGlobalSkillDirs,
  getAgentById,
  getPreferredProjectTarget,
  resolveAgent,
  type AgentDefinition,
} from "./agents.js";
import { getAppHome, getConfigPath, loadConfig, saveConfig } from "./config.js";
import {
  FRAMEWORKS,
  getFrameworkById,
  runFrameworkInstall,
  type FrameworkId,
} from "./frameworks.js";
import {
  findSkillMatches,
  getSkillDestination,
  installSkill,
  listSkills,
  type SkillDescriptor,
} from "./skills.js";
import {
  FRAMEWORK_TOOL_REQUIREMENTS,
  bootstrapTools,
  inspectTools,
  type ToolId,
} from "./tools.js";

function assertPromptResult<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  return value as T;
}

async function promptForAgent(initialAgent?: string): Promise<AgentDefinition> {
  const resolved = initialAgent ? resolveAgent(initialAgent) : undefined;

  if (resolved) {
    return resolved;
  }

  const answer = await select({
    message: "Which AI agent should be managed by default?",
    options: AGENTS.map((agent) => ({
      value: agent.id,
      label: agent.label,
      hint: agent.globalSkillDirs.join(" | "),
    })),
  });

  const agentId = assertPromptResult(answer);
  const agent = getAgentById(agentId);

  if (!agent) {
    throw new Error(`Unsupported agent: ${String(agentId)}`);
  }

  return agent;
}

async function promptForGlobalSkillsDir(
  agent: AgentDefinition,
  initialValue?: string,
): Promise<string> {
  if (initialValue) {
    return path.resolve(initialValue);
  }

  const existing = findExistingGlobalSkillDirs(agent);
  const choices = [...new Set([...existing, ...agent.globalSkillDirs])];

  if (choices.length === 1) {
    return choices[0];
  }

  const answer = await select({
    message: `Where should the global ${agent.label} skills live?`,
    options: choices.map((dir) => ({
      value: dir,
      label: dir,
      hint: fs.existsSync(dir) ? "exists" : "will be created",
    })),
  });

  return assertPromptResult(answer);
}

async function promptForExternalSkillsDir(initialValue?: string): Promise<string> {
  if (initialValue) {
    if (!fs.existsSync(initialValue)) {
      throw new Error(`External skills directory not found: ${initialValue}`);
    }

    return path.resolve(initialValue);
  }

  const answer = await text({
    message: "Where is your reusable skills library?",
    placeholder: "C:\\Users\\you\\AI-Skills",
    validate: (value) => {
      if (!value) {
        return "Provide a folder path.";
      }

      if (!value.trim()) {
        return "Provide a folder path.";
      }

      if (!fs.existsSync(value)) {
        return "Folder not found.";
      }

      return undefined;
    },
  });

  return path.resolve(assertPromptResult<string>(answer));
}

function pickProjectTarget(cwd: string, preferredAgentId?: string): {
  agent: AgentDefinition;
  skillsDir: string;
  markerDir: string;
} {
  const detected = detectProjectAgents(cwd);

  if (preferredAgentId) {
    const preferred = getAgentById(preferredAgentId);

    if (!preferred) {
      throw new Error(`Unsupported agent: ${preferredAgentId}`);
    }

    const target = getPreferredProjectTarget(cwd, preferred.id);
    return {
      agent: preferred,
      markerDir: target.markerDir,
      skillsDir: path.join(cwd, target.skillsDir),
    };
  }

  if (detected.length === 1) {
    const [match] = detected;
    return {
      agent: match.agent,
      markerDir: match.target.markerDir,
      skillsDir: path.join(cwd, match.target.skillsDir),
    };
  }

  if (detected.length > 1) {
    throw new Error(
      `Multiple agent folders detected: ${detected
        .map((match) => match.target.markerDir)
        .join(", ")}. Re-run with --agent.`,
    );
  }

  const config = loadConfig();

  if (config) {
    const target = getPreferredProjectTarget(cwd, config.agentId);
    return {
      agent: getAgentById(config.agentId)!,
      markerDir: target.markerDir,
      skillsDir: path.join(cwd, target.skillsDir),
    };
  }

  const fallback = AGENTS[0];
  return {
    agent: fallback,
    markerDir: fallback.defaultProjectTarget.markerDir,
    skillsDir: path.join(cwd, fallback.defaultProjectTarget.skillsDir),
  };
}

function chooseSkillOrThrow(matches: SkillDescriptor[], query: string): SkillDescriptor {
  if (matches.length === 0) {
    throw new Error(`No skill matched "${query}".`);
  }

  if (matches.length > 1) {
    throw new Error(
      `Multiple skills matched "${query}": ${matches
        .map((skill) => skill.relativePath)
        .join(", ")}. Narrow the query.`,
    );
  }

  return matches[0];
}

function collectOption(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}

function uniqueSkills(skills: SkillDescriptor[]): SkillDescriptor[] {
  return Array.from(new Map(skills.map((skill) => [skill.relativePath, skill])).values());
}

function resolveSkillsForSync(
  skills: SkillDescriptor[],
  queries: string[],
): SkillDescriptor[] {
  if (queries.length === 0) {
    return skills;
  }

  const selected = queries.flatMap((query) => {
    const matches = findSkillMatches(skills, query);

    if (matches.length === 0) {
      throw new Error(`No skill matched "${query}".`);
    }

    return matches;
  });

  return uniqueSkills(selected);
}

function summarizeToolStatus(statuses: Awaited<ReturnType<typeof inspectTools>>): string {
  return statuses
    .map(
      (status) =>
        `${status.label}: ${status.installed ? `ok (${status.detectedCommand})` : "missing"}${
          status.installCommand ? ` | install: ${status.installCommand}` : ""
        }`,
    )
    .join("\n");
}

const program = new Command();

program
  .name("master-skill")
  .description("Orchestrate reusable skills and AI development frameworks across projects.")
  .version("0.1.0");

program
  .command("init")
  .description("Configure the default agent, global skills directory, and reusable skills library.")
  .option("--agent <agent>", "Default agent id")
  .option("--global-dir <dir>", "Global skills directory for the selected agent")
  .option("--skills-dir <dir>", "Reusable external skills directory")
  .action(async (options) => {
    intro("Master Skill Orchestrator");

    const agent = await promptForAgent(options.agent);
    const globalSkillsDir = await promptForGlobalSkillsDir(agent, options.globalDir);
    const externalSkillsDir = await promptForExternalSkillsDir(options.skillsDir);
    const current = loadConfig();

    if (current) {
      const replace = await confirm({
        message: `Overwrite existing config at ${getConfigPath()}?`,
        initialValue: true,
      });
      if (!assertPromptResult(replace)) {
        outro("Initialization aborted.");
        return;
      }
    }

    fs.ensureDirSync(globalSkillsDir);

    saveConfig({
      version: 1,
      agentId: agent.id,
      globalSkillsDir,
      externalSkillsDir,
      updatedAt: new Date().toISOString(),
    });

    note(
      [
        `Agent: ${agent.label}`,
        `Global skills: ${globalSkillsDir}`,
        `External skills: ${externalSkillsDir}`,
        `Config: ${getConfigPath()}`,
      ].join("\n"),
      "Saved configuration",
    );

    outro("Initialization complete.");
  });

program
  .command("doctor")
  .description("Inspect local configuration, project markers, and basic prerequisites.")
  .action(async () => {
    const config = loadConfig();
    const cwd = process.cwd();
    const detected = detectProjectAgents(cwd);
    const tools = await inspectTools(["node", "npm", "npx", "python", "uv", "git", "gh"]);

    intro("Doctor");
    note(
      [
        `CLI home: ${getAppHome()}`,
        `Config file: ${config ? getConfigPath() : "not found"}`,
        `Project: ${cwd}`,
        `Detected agents: ${
          detected.length > 0
            ? detected.map((entry) => `${entry.agent.label} (${entry.target.markerDir})`).join(", ")
            : "none"
        }`,
      ].join("\n"),
      "Environment",
    );

    if (config) {
      note(
        [
          `Default agent: ${config.agentId}`,
          `Global skills: ${config.globalSkillsDir}`,
          `External skills: ${config.externalSkillsDir}`,
          `External folder exists: ${fs.existsSync(config.externalSkillsDir) ? "yes" : "no"}`,
        ].join("\n"),
        "Configuration",
      );
    }

    note(summarizeToolStatus(tools), "Tooling");

    outro("Doctor finished.");
  });

const listCommand = program.command("list").description("List available entities.");

listCommand
  .command("skills")
  .description("List skills available in the reusable skills library.")
  .action(() => {
    const config = loadConfig();

    if (!config) {
      throw new Error("Configuration not found. Run `master-skill init` first.");
    }

    const skills = listSkills(config.externalSkillsDir);

    for (const skill of skills) {
      console.log(`${pc.green(skill.name)}  ${skill.relativePath}`);
      if (skill.description) {
        console.log(`  ${skill.description}`);
      }
    }
  });

const addCommand = program.command("add").description("Install a framework or skill into the current project.");

addCommand
  .command("skill <query>")
  .description("Copy one reusable skill into the current project.")
  .option("--agent <agent>", "Project agent id")
  .option("--force", "Overwrite destination if it already exists", false)
  .action((query, options) => {
    const config = loadConfig();

    if (!config) {
      throw new Error("Configuration not found. Run `master-skill init` first.");
    }

    const skills = listSkills(config.externalSkillsDir);
    const skill = chooseSkillOrThrow(findSkillMatches(skills, query), query);
    const target = pickProjectTarget(process.cwd(), options.agent);
    const destination = installSkill(skill, target.skillsDir, options.force);

    note(
      [
        `Skill: ${skill.name}`,
        `Agent: ${target.agent.label}`,
        `Marker: ${target.markerDir}`,
        `Destination: ${destination}`,
      ].join("\n"),
      "Skill installed",
    );
  });

addCommand
  .command("framework <framework>")
  .description("Run the official installer for a supported framework in the current project.")
  .option("--agent <agent>", "Project agent id")
  .option("--dry-run", "Print the installer command without running it", false)
  .action(async (framework, options) => {
    const frameworkDefinition = getFrameworkById(framework);

    if (!frameworkDefinition) {
      throw new Error(
        `Unsupported framework: ${framework}. Available: ${FRAMEWORKS.map((item) => item.id).join(", ")}`,
      );
    }

    const target = pickProjectTarget(process.cwd(), options.agent);
    const command = await runFrameworkInstall(
      framework as FrameworkId,
      process.cwd(),
      target.agent.id,
      options.dryRun,
    );

    if (options.dryRun) {
      note(command, "Dry run");
      return;
    }

    outro(`${frameworkDefinition.label} installer finished.`);
  });

const syncCommand = program.command("sync").description("Synchronize reusable assets into the current project.");

syncCommand
  .command("skills")
  .description("Sync all reusable skills, or a filtered subset, into the current project.")
  .option("--agent <agent>", "Project agent id")
  .option("--query <query>", "Filter skills by query", collectOption, [])
  .option("--force", "Overwrite existing destinations", false)
  .action((options: { agent?: string; query: string[]; force: boolean }) => {
    const config = loadConfig();

    if (!config) {
      throw new Error("Configuration not found. Run `master-skill init` first.");
    }

    const allSkills = listSkills(config.externalSkillsDir);
    const selectedSkills = resolveSkillsForSync(allSkills, options.query);
    const target = pickProjectTarget(process.cwd(), options.agent);
    const installed: string[] = [];
    const skipped: string[] = [];

    for (const skill of selectedSkills) {
      const destination = getSkillDestination(skill, target.skillsDir);

      if (fs.existsSync(destination) && !options.force) {
        skipped.push(skill.relativePath);
        continue;
      }

      installSkill(skill, target.skillsDir, options.force);
      installed.push(skill.relativePath);
    }

    note(
      [
        `Agent: ${target.agent.label}`,
        `Installed: ${installed.length}`,
        `Skipped: ${skipped.length}`,
        installed.length > 0 ? `Installed skills: ${installed.join(", ")}` : "",
        skipped.length > 0 ? `Skipped existing: ${skipped.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      "Sync complete",
    );
  });

program
  .command("bootstrap")
  .description("Install missing system prerequisites used by frameworks and publishing.")
  .option("--tool <tool>", "Specific tool to install", collectOption, [])
  .option("--framework <framework>", "Install prerequisites for a framework", collectOption, [])
  .option("--dry-run", "Print installer commands without running them", false)
  .action(
    async (options: {
      tool: string[];
      framework: string[];
      dryRun: boolean;
    }) => {
      const frameworkTools = options.framework.flatMap((framework) => {
        const requirements = FRAMEWORK_TOOL_REQUIREMENTS[framework];

        if (!requirements) {
          throw new Error(
            `Unsupported framework: ${framework}. Available: ${FRAMEWORKS.map((item) => item.id).join(", ")}`,
          );
        }

        return requirements;
      });

      const requestedTools = [...options.tool, ...frameworkTools] as ToolId[];
      const targetTools = requestedTools.length > 0
        ? Array.from(new Set(requestedTools))
        : (["uv", "gh"] as ToolId[]);

      const results = await bootstrapTools(targetTools, options.dryRun);

      if (results.length === 0) {
        note("Nothing to do. Requested tools are already installed.", "Bootstrap");
        return;
      }

      note(
        results
          .map(
            (result) =>
              `${result.toolId}: ${result.command}${result.executed ? "" : " (dry-run)"}`,
          )
          .join("\n"),
        "Bootstrap plan",
      );
    },
  );

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(pc.red(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
