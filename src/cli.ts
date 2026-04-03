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
import {
  getAppHome,
  getConfigPath,
  loadConfig,
  saveConfig,
  type OrchestratorConfig,
} from "./config.js";
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

interface InitOptions {
  agent?: string;
  globalDir?: string;
  skillsDir?: string;
}

interface AddSkillOptions {
  agent?: string;
  force?: boolean;
}

interface AddFrameworkOptions {
  agent?: string;
  dryRun?: boolean;
}

interface SyncSkillsOptions {
  agent?: string;
  query: string[];
  force?: boolean;
}

interface BootstrapOptions {
  tool: string[];
  framework: string[];
  dryRun?: boolean;
}

interface ProjectSnapshot {
  cwd: string;
  config: OrchestratorConfig | null;
  detectedAgents: ReturnType<typeof detectProjectAgents>;
  installedFrameworks: string[];
  recommendedTarget:
    | {
        agentLabel: string;
        markerDir: string;
        skillsDir: string;
      }
    | null;
}

interface DoctorReport {
  environment: string;
  configuration?: string;
  tooling: string;
}

function isInteractiveSession(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function assertPromptResult<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  return value as T;
}

function requireInteractivePrompt(optionHint: string): never {
  throw new Error(
    `Interactive input is required here. Re-run in a terminal, or pass ${optionHint}.`,
  );
}

async function promptForAgent(initialAgent?: string): Promise<AgentDefinition> {
  const resolved = initialAgent ? resolveAgent(initialAgent) : undefined;

  if (resolved) {
    return resolved;
  }

  if (!isInteractiveSession()) {
    requireInteractivePrompt("`--agent <agent>`");
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

  if (!isInteractiveSession()) {
    requireInteractivePrompt("`--global-dir <dir>`");
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

  if (!isInteractiveSession()) {
    requireInteractivePrompt("`--skills-dir <dir>`");
  }

  const answer = await text({
    message: "Where is your reusable skills library?",
    placeholder: "C:\\Users\\you\\AI-Skills",
    validate: (value) => {
      if (!value?.trim()) {
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

async function getProjectSnapshot(cwd: string): Promise<ProjectSnapshot> {
  const config = loadConfig();
  const detectedAgents = detectProjectAgents(cwd);
  const installedFrameworks = FRAMEWORKS.filter((framework) =>
    framework.detect(cwd),
  ).map((framework) => framework.label);

  try {
    const target = pickProjectTarget(cwd, config?.agentId);
    return {
      cwd,
      config,
      detectedAgents,
      installedFrameworks,
      recommendedTarget: {
        agentLabel: target.agent.label,
        markerDir: target.markerDir,
        skillsDir: target.skillsDir,
      },
    };
  } catch {
    return {
      cwd,
      config,
      detectedAgents,
      installedFrameworks,
      recommendedTarget: null,
    };
  }
}

function getRecommendedNextStep(snapshot: ProjectSnapshot): string {
  if (!snapshot.config) {
    return "Run `init` to connect one default agent and your reusable skill library.";
  }

  if (snapshot.detectedAgents.length === 0) {
    return "Open a project with `.agents`, `.claude`, `.agent`, `.cursor` or pass `--agent` explicitly.";
  }

  if (snapshot.installedFrameworks.length === 0) {
    return "Start with `sync skills` for reusable skills, or `add framework` if this project needs a formal workflow.";
  }

  return "Use `sync skills` to bring reusable capabilities in, or `doctor` to inspect prerequisites before the next install.";
}

function buildOverview(snapshot: ProjectSnapshot): string {
  return [
    "Master Skill is an orchestration CLI for AI-first development projects.",
    "",
    "What it does:",
    "1. Connect one default agent plus one reusable skill library.",
    "2. Copy reusable skills into the current project on demand.",
    "3. Install project frameworks like BMad, Spec Kit, and Antigravity Kit.",
    "4. Bootstrap missing tools such as uv and gh.",
    "",
    "Project snapshot:",
    `- Project: ${snapshot.cwd}`,
    `- Configured default agent: ${
      snapshot.config ? snapshot.config.agentId : "not configured yet"
    }`,
    `- Detected agent markers: ${
      snapshot.detectedAgents.length > 0
        ? snapshot.detectedAgents
            .map((entry) => `${entry.agent.label} (${entry.target.markerDir})`)
            .join(", ")
        : "none"
    }`,
    `- Installed frameworks: ${
      snapshot.installedFrameworks.length > 0
        ? snapshot.installedFrameworks.join(", ")
        : "none detected"
    }`,
    `- Recommended project target: ${
      snapshot.recommendedTarget
        ? `${snapshot.recommendedTarget.agentLabel} -> ${snapshot.recommendedTarget.markerDir}`
        : "needs manual selection"
    }`,
    "",
    `Recommended next step: ${getRecommendedNextStep(snapshot)}`,
  ].join("\n");
}

function printGuide(snapshot: ProjectSnapshot, title = "Master Skill overview"): void {
  note(buildOverview(snapshot), title);
}

async function buildDoctorReport(cwd = process.cwd()): Promise<DoctorReport> {
  const config = loadConfig();
  const detected = detectProjectAgents(cwd);
  const tools = await inspectTools(["node", "npm", "npx", "python", "uv", "git", "gh"]);

  return {
    environment: [
      `CLI home: ${getAppHome()}`,
      `Config file: ${config ? getConfigPath() : "not found"}`,
      `Project: ${cwd}`,
      `Detected agents: ${
        detected.length > 0
          ? detected.map((entry) => `${entry.agent.label} (${entry.target.markerDir})`).join(", ")
          : "none"
      }`,
    ].join("\n"),
    configuration: config
      ? [
          `Default agent: ${config.agentId}`,
          `Global skills: ${config.globalSkillsDir}`,
          `External skills: ${config.externalSkillsDir}`,
          `External folder exists: ${fs.existsSync(config.externalSkillsDir) ? "yes" : "no"}`,
        ].join("\n")
      : undefined,
    tooling: summarizeToolStatus(tools),
  };
}

function printDoctorReport(report: DoctorReport): void {
  note(report.environment, "Environment");

  if (report.configuration) {
    note(report.configuration, "Configuration");
  }

  note(report.tooling, "Tooling");
}

async function executeInitWorkflow(options: InitOptions): Promise<void> {
  const snapshot = await getProjectSnapshot(process.cwd());
  printGuide(snapshot, "What Master Skill does");

  const agent = await promptForAgent(options.agent);
  const globalSkillsDir = await promptForGlobalSkillsDir(agent, options.globalDir);
  const externalSkillsDir = await promptForExternalSkillsDir(options.skillsDir);
  const current = loadConfig();

  if (current && isInteractiveSession()) {
    const replace = await confirm({
      message: `Overwrite existing config at ${getConfigPath()}?`,
      initialValue: true,
    });

    if (!assertPromptResult(replace)) {
      note("Kept the existing configuration.", "Init skipped");
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
}

function executeListSkills(): SkillDescriptor[] {
  const config = loadConfig();

  if (!config) {
    throw new Error("Configuration not found. Run `master-skill init` first.");
  }

  return listSkills(config.externalSkillsDir);
}

function printSkillList(skills: SkillDescriptor[]): void {
  for (const skill of skills) {
    console.log(`${pc.green(skill.name)}  ${skill.relativePath}`);
    if (skill.description) {
      console.log(`  ${skill.description}`);
    }
  }
}

function executeAddSkill(query: string, options: AddSkillOptions): string {
  const config = loadConfig();

  if (!config) {
    throw new Error("Configuration not found. Run `master-skill init` first.");
  }

  const skills = listSkills(config.externalSkillsDir);
  const skill = chooseSkillOrThrow(findSkillMatches(skills, query), query);
  const target = pickProjectTarget(process.cwd(), options.agent);
  const destination = installSkill(skill, target.skillsDir, Boolean(options.force));

  note(
    [
      `Skill: ${skill.name}`,
      `Agent: ${target.agent.label}`,
      `Marker: ${target.markerDir}`,
      `Destination: ${destination}`,
    ].join("\n"),
    "Skill installed",
  );

  return destination;
}

async function executeAddFramework(
  framework: FrameworkId,
  options: AddFrameworkOptions,
): Promise<string> {
  const frameworkDefinition = getFrameworkById(framework);

  if (!frameworkDefinition) {
    throw new Error(
      `Unsupported framework: ${framework}. Available: ${FRAMEWORKS.map((item) => item.id).join(", ")}`,
    );
  }

  const target = pickProjectTarget(process.cwd(), options.agent);
  const command = await runFrameworkInstall(
    framework,
    process.cwd(),
    target.agent.id,
    Boolean(options.dryRun),
  );

  if (options.dryRun) {
    note(command, "Dry run");
  } else {
    note(
      [
        `Framework: ${frameworkDefinition.label}`,
        `Agent target: ${target.agent.label}`,
        `Command: ${command}`,
      ].join("\n"),
      "Framework installed",
    );
  }

  return command;
}

function executeSyncSkills(options: SyncSkillsOptions): void {
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

    installSkill(skill, target.skillsDir, Boolean(options.force));
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
}

async function executeBootstrap(options: BootstrapOptions): Promise<void> {
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
  const targetTools =
    requestedTools.length > 0
      ? Array.from(new Set(requestedTools))
      : (["uv", "gh"] as ToolId[]);

  const results = await bootstrapTools(targetTools, Boolean(options.dryRun));

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
}

async function promptForFrameworkSelection(): Promise<FrameworkId> {
  const answer = await select({
    message: "Which framework do you want to install in this project?",
    options: FRAMEWORKS.map((framework) => ({
      value: framework.id,
      label: framework.label,
      hint: framework.description,
    })),
  });

  return assertPromptResult(answer) as FrameworkId;
}

async function promptForSkillQuery(message: string): Promise<string> {
  const answer = await text({
    message,
    validate: (value) => (!value?.trim() ? "Provide a skill name or keyword." : undefined),
  });

  return assertPromptResult<string>(answer).trim();
}

async function promptForSyncQueries(): Promise<string[]> {
  const mode = await select({
    message: "How do you want to sync skills into this project?",
    options: [
      {
        value: "all",
        label: "All reusable skills",
        hint: "Copy every skill from the external library into this project.",
      },
      {
        value: "filtered",
        label: "Filtered subset",
        hint: "Choose a keyword and copy only matching skills.",
      },
    ],
  });

  if (assertPromptResult(mode) === "all") {
    return [];
  }

  const query = await promptForSkillQuery(
    "Which skill keyword should be synced into this project?",
  );

  return [query];
}

async function promptForBootstrapTargets(): Promise<BootstrapOptions> {
  const mode = await select({
    message: "What should Master Skill bootstrap?",
    options: [
      {
        value: "recommended",
        label: "Recommended tools",
        hint: "Install the default helper tools used by the CLI.",
      },
      {
        value: "framework",
        label: "Tools for one framework",
        hint: "Bootstrap prerequisites for BMad, Spec Kit, or Antigravity Kit.",
      },
    ],
  });

  if (assertPromptResult(mode) === "recommended") {
    return {
      tool: [],
      framework: [],
      dryRun: false,
    };
  }

  const framework = await promptForFrameworkSelection();
  return {
    tool: [],
    framework: [framework],
    dryRun: false,
  };
}

async function maybeContinueAfterInit(): Promise<void> {
  if (!isInteractiveSession()) {
    return;
  }

  const answer = await select({
    message: "Configuration saved. What do you want to do next in this project?",
    options: [
      {
        value: "doctor",
        label: "Inspect this project",
        hint: "Show config, markers, and tool prerequisites.",
      },
      {
        value: "sync-skills",
        label: "Sync reusable skills",
        hint: "Copy your shared skills into the current project.",
      },
      {
        value: "framework",
        label: "Install one framework",
        hint: "Run BMad, Spec Kit, or Antigravity Kit for this project.",
      },
      {
        value: "list-skills",
        label: "Browse available skills",
        hint: "Show what exists in the external skills library.",
      },
      {
        value: "finish",
        label: "Finish for now",
        hint: "Keep the saved config and exit onboarding.",
      },
    ],
  });

  switch (assertPromptResult(answer)) {
    case "doctor": {
      printDoctorReport(await buildDoctorReport());
      return;
    }
    case "sync-skills": {
      const query = await promptForSyncQueries();
      executeSyncSkills({ query, force: false });
      return;
    }
    case "framework": {
      const framework = await promptForFrameworkSelection();
      await executeAddFramework(framework, { dryRun: false });
      return;
    }
    case "list-skills": {
      printSkillList(executeListSkills());
      return;
    }
    default:
      return;
  }
}

async function launchInteractiveHome(): Promise<void> {
  intro("Master Skill Orchestrator");

  while (true) {
    const snapshot = await getProjectSnapshot(process.cwd());
    printGuide(snapshot, "What Master Skill can do for this project");

    const answer = await select({
      message: "What do you want to do now?",
      options: [
        {
          value: "init",
          label: snapshot.config ? "Reconfigure Master Skill" : "Start onboarding",
          hint: "Connect your default agent and external skill library.",
        },
        {
          value: "doctor",
          label: "Inspect this project",
          hint: "Review config, markers, and prerequisite tools.",
        },
        {
          value: "list-skills",
          label: "Browse reusable skills",
          hint: "Show what is available in your external skill library.",
        },
        {
          value: "add-skill",
          label: "Install one skill",
          hint: "Copy one reusable skill into this project.",
        },
        {
          value: "sync-skills",
          label: "Sync skills in bulk",
          hint: "Copy all skills or a filtered subset into this project.",
        },
        {
          value: "framework",
          label: "Install one framework",
          hint: "Run BMad, Spec Kit, or Antigravity Kit here.",
        },
        {
          value: "bootstrap",
          label: "Bootstrap prerequisites",
          hint: "Install missing tools like uv and gh.",
        },
        {
          value: "exit",
          label: "Exit",
          hint: "Leave the interactive guide.",
        },
      ],
    });

    switch (assertPromptResult(answer)) {
      case "init":
        await executeInitWorkflow({});
        await maybeContinueAfterInit();
        break;
      case "doctor":
        printDoctorReport(await buildDoctorReport());
        break;
      case "list-skills":
        printSkillList(executeListSkills());
        break;
      case "add-skill": {
        const query = await promptForSkillQuery(
          "Which reusable skill do you want to install into this project?",
        );
        executeAddSkill(query, { force: false });
        break;
      }
      case "sync-skills": {
        const query = await promptForSyncQueries();
        executeSyncSkills({ query, force: false });
        break;
      }
      case "framework": {
        const framework = await promptForFrameworkSelection();
        await executeAddFramework(framework, { dryRun: false });
        break;
      }
      case "bootstrap": {
        const bootstrapOptions = await promptForBootstrapTargets();
        await executeBootstrap(bootstrapOptions);
        break;
      }
      default:
        outro("See you later.");
        return;
    }
  }
}

const program = new Command();

program
  .name("master-skill")
  .description("Orchestrate reusable skills and AI development frameworks across projects.")
  .version("0.1.1")
  .showHelpAfterError();

program.action(async () => {
  if (isInteractiveSession()) {
    await launchInteractiveHome();
    return;
  }

  printGuide(await getProjectSnapshot(process.cwd()));
  console.log(
    "\nRun `master-skill init` to onboard, or `master-skill doctor` to inspect the current project.",
  );
});

program
  .command("guide")
  .description("Explain what Master Skill does for the current project.")
  .action(async () => {
    printGuide(await getProjectSnapshot(process.cwd()));
  });

program
  .command("init")
  .description(
    "Guide onboarding: explain the CLI, connect the default agent, and save the reusable skill library.",
  )
  .option("--agent <agent>", "Default agent id")
  .option("--global-dir <dir>", "Global skills directory for the selected agent")
  .option("--skills-dir <dir>", "Reusable external skills directory")
  .action(async (options: InitOptions) => {
    intro("Master Skill onboarding");
    await executeInitWorkflow(options);
    await maybeContinueAfterInit();
    outro("Onboarding finished.");
  });

program
  .command("doctor")
  .description("Inspect local configuration, project markers, and basic prerequisites.")
  .action(async () => {
    intro("Doctor");
    printDoctorReport(await buildDoctorReport());
    outro("Doctor finished.");
  });

const listCommand = program.command("list").description("List available entities.");

listCommand
  .command("skills")
  .description("List skills available in the reusable skills library.")
  .action(() => {
    printSkillList(executeListSkills());
  });

const addCommand = program
  .command("add")
  .description("Install a framework or skill into the current project.");

addCommand
  .command("skill <query>")
  .description("Copy one reusable skill into the current project.")
  .option("--agent <agent>", "Project agent id")
  .option("--force", "Overwrite destination if it already exists", false)
  .action((query: string, options: AddSkillOptions) => {
    executeAddSkill(query, options);
  });

addCommand
  .command("framework <framework>")
  .description("Run the official installer for a supported framework in the current project.")
  .option("--agent <agent>", "Project agent id")
  .option("--dry-run", "Print the installer command without running it", false)
  .action(async (framework: FrameworkId, options: AddFrameworkOptions) => {
    await executeAddFramework(framework, options);
  });

const syncCommand = program
  .command("sync")
  .description("Synchronize reusable assets into the current project.");

syncCommand
  .command("skills")
  .description("Sync all reusable skills, or a filtered subset, into the current project.")
  .option("--agent <agent>", "Project agent id")
  .option("--query <query>", "Filter skills by query", collectOption, [])
  .option("--force", "Overwrite existing destinations", false)
  .action((options: SyncSkillsOptions) => {
    executeSyncSkills(options);
  });

program
  .command("bootstrap")
  .description("Install missing system prerequisites used by frameworks and publishing.")
  .option("--tool <tool>", "Specific tool to install", collectOption, [])
  .option("--framework <framework>", "Install prerequisites for a framework", collectOption, [])
  .option("--dry-run", "Print installer commands without running them", false)
  .action(async (options: BootstrapOptions) => {
    await executeBootstrap(options);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(pc.red(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
