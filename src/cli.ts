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
  getMessages,
  normalizeLocale,
  resolveStartupLocale,
  SUPPORTED_LOCALES,
  type I18nMessages,
  type SupportedLocale,
} from "./i18n.js";
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
import {
  buildAssistantRecommendation,
  formatAssistantRecommendation,
  type AssistantAction,
  type AssistantRecommendation,
} from "./assistant.js";
import {
  renderBrandHeader,
  renderCommandMap,
  renderKeyValuePanel,
  renderStageFlow,
  type BrandMode,
} from "./branding.js";

interface InitOptions {
  agent?: string;
  lang?: string;
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

interface AssistOptions {
  run?: boolean;
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

const startupConfig = loadConfig();
let activeLocale: SupportedLocale = resolveStartupLocale(
  process.argv,
  startupConfig?.locale,
);
let messages: I18nMessages = getMessages(activeLocale);

function setActiveLocale(locale: SupportedLocale): void {
  activeLocale = locale;
  messages = getMessages(locale);
}

function withLangOption<T extends Command>(command: T): T {
  return command.option("--lang <locale>", messages.help.langOption);
}

function printBrandHeader(mode: BrandMode): void {
  if (!isInteractiveSession()) {
    return;
  }

  console.log("");
  console.log(renderBrandHeader(mode, messages));
  console.log("");
}

function printBrandPanels(
  mode: BrandMode,
  contextRows?: Array<{ label: string; value: string }>,
): void {
  if (!isInteractiveSession()) {
    return;
  }

  note(renderStageFlow(mode, messages), messages.branding.executionFlow);

  if (mode === "home") {
    note(renderCommandMap(messages), messages.branding.commandMap);
  }

  if (contextRows && contextRows.length > 0) {
    note(renderKeyValuePanel(contextRows), messages.branding.currentContext);
  }
}

function isInteractiveSession(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function assertPromptResult<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel(messages.outputs.operationCancelled);
    process.exit(0);
  }

  return value as T;
}

function requireInteractivePrompt(optionHint: string): never {
  throw new Error(messages.prompts.interactiveRequired(optionHint));
}

async function promptForLocale(initialValue?: string): Promise<SupportedLocale> {
  const normalized = normalizeLocale(initialValue);

  if (initialValue && !normalized) {
    throw new Error(
      messages.errors.unsupportedLocale(initialValue, SUPPORTED_LOCALES.join(", ")),
    );
  }

  if (normalized) {
    return normalized;
  }

  if (!isInteractiveSession()) {
    return activeLocale;
  }

  const answer = await select({
    message: messages.prompts.localeQuestion,
    options: SUPPORTED_LOCALES.map((locale) => ({
      value: locale,
      label: getMessages(locale).localeNames[locale],
    })),
  });

  return assertPromptResult(answer) as SupportedLocale;
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
    message: messages.prompts.agentQuestion,
    options: AGENTS.map((agent) => ({
      value: agent.id,
      label: agent.label,
      hint: agent.globalSkillDirs.join(" | "),
    })),
  });

  const agentId = assertPromptResult(answer);
  const agent = getAgentById(agentId);

  if (!agent) {
    throw new Error(messages.errors.unsupportedAgent(String(agentId)));
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
    message: messages.prompts.globalSkillsQuestion(agent.label),
    options: choices.map((dir) => ({
      value: dir,
      label: dir,
      hint: fs.existsSync(dir)
        ? messages.outputs.exists
        : messages.outputs.willBeCreated,
    })),
  });

  return assertPromptResult(answer);
}

async function promptForExternalSkillsDir(initialValue?: string): Promise<string> {
  if (initialValue) {
    if (!fs.existsSync(initialValue)) {
      throw new Error(messages.errors.externalSkillsDirNotFound(initialValue));
    }

    return path.resolve(initialValue);
  }

  if (!isInteractiveSession()) {
    requireInteractivePrompt("`--skills-dir <dir>`");
  }

  const answer = await text({
    message: messages.prompts.skillsLibraryQuestion,
    placeholder: messages.prompts.skillsLibraryPlaceholder,
    validate: (value) => {
      if (!value?.trim()) {
        return messages.prompts.skillsLibraryRequired;
      }

      if (!fs.existsSync(value)) {
        return messages.prompts.skillsLibraryNotFound;
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
      throw new Error(messages.errors.unsupportedAgent(preferredAgentId));
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
      messages.errors.multipleAgentMarkers(
        detected.map((match) => match.target.markerDir).join(", "),
      ),
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
    throw new Error(messages.errors.noSkillMatch(query));
  }

  if (matches.length > 1) {
    throw new Error(
      messages.errors.multipleSkillMatches(
        query,
        matches.map((skill) => skill.relativePath).join(", "),
      ),
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
      throw new Error(messages.errors.noSkillMatch(query));
    }

    return matches;
  });

  return uniqueSkills(selected);
}

function summarizeToolStatus(statuses: Awaited<ReturnType<typeof inspectTools>>): string {
  return statuses
    .map(
      (status) =>
        `${status.label}: ${
          status.installed
            ? `${messages.outputs.ok} (${status.detectedCommand})`
            : messages.outputs.missing
        }${
          status.installCommand
            ? ` | ${messages.outputs.install}: ${status.installCommand}`
            : ""
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
    return messages.guide.nextStepSetup;
  }

  if (snapshot.detectedAgents.length === 0) {
    return messages.guide.nextStepNoMarkers;
  }

  if (snapshot.installedFrameworks.length === 0) {
    return messages.guide.nextStepNoFrameworks;
  }

  return messages.guide.nextStepDefault;
}

function buildOverview(snapshot: ProjectSnapshot): string {
  return [
    messages.guide.intro,
    "",
    messages.guide.whatItDoes,
    ...messages.guide.bullets.map((bullet, index) => `${index + 1}. ${bullet}`),
    "",
    messages.guide.snapshotTitle,
    `- ${messages.guide.project}: ${snapshot.cwd}`,
    `- ${messages.guide.configuredAgent}: ${
      snapshot.config ? snapshot.config.agentId : messages.guide.notConfiguredYet
    }`,
    `- ${messages.guide.detectedAgents}: ${
      snapshot.detectedAgents.length > 0
        ? snapshot.detectedAgents
            .map((entry) => `${entry.agent.label} (${entry.target.markerDir})`)
            .join(", ")
        : messages.guide.none
    }`,
    `- ${messages.guide.installedFrameworks}: ${
      snapshot.installedFrameworks.length > 0
        ? snapshot.installedFrameworks.join(", ")
        : messages.guide.noneDetected
    }`,
    `- ${messages.guide.recommendedTarget}: ${
      snapshot.recommendedTarget
        ? `${snapshot.recommendedTarget.agentLabel} -> ${snapshot.recommendedTarget.markerDir}`
        : messages.guide.needsManualSelection
    }`,
    "",
    `${messages.guide.recommendedNext}: ${getRecommendedNextStep(snapshot)}`,
  ].join("\n");
}

function printGuide(
  snapshot: ProjectSnapshot,
  title: string = messages.titles.guide,
): void {
  note(buildOverview(snapshot), title);
}

async function buildDoctorReport(cwd = process.cwd()): Promise<DoctorReport> {
  const config = loadConfig();
  const detected = detectProjectAgents(cwd);
  const tools = await inspectTools(["node", "npm", "npx", "python", "uv", "git", "gh"]);

  return {
    environment: [
      `${messages.guide.cliHome}: ${getAppHome()}`,
      `${messages.guide.configFile}: ${
        config ? getConfigPath() : messages.guide.notFound
      }`,
      `${messages.guide.project}: ${cwd}`,
      `${messages.guide.detectedAgents}: ${
        detected.length > 0
          ? detected.map((entry) => `${entry.agent.label} (${entry.target.markerDir})`).join(", ")
          : messages.guide.none
      }`,
    ].join("\n"),
    configuration: config
      ? [
          `${messages.outputs.defaultAgent}: ${config.agentId}`,
          `${messages.outputs.language}: ${config.locale}`,
          `${messages.outputs.globalSkills}: ${config.globalSkillsDir}`,
          `${messages.outputs.externalSkills}: ${config.externalSkillsDir}`,
          `${messages.outputs.externalFolderExists}: ${
            fs.existsSync(config.externalSkillsDir)
              ? messages.outputs.yes
              : messages.outputs.no
          }`,
        ].join("\n")
      : undefined,
    tooling: summarizeToolStatus(tools),
  };
}

function printDoctorReport(report: DoctorReport): void {
  note(report.environment, messages.titles.environment);

  if (report.configuration) {
    note(report.configuration, messages.titles.configuration);
  }

  note(report.tooling, messages.titles.tooling);
}

async function executeInitWorkflow(options: InitOptions): Promise<void> {
  const current = loadConfig();
  const locale = options.lang
    ? await promptForLocale(options.lang)
    : !isInteractiveSession()
      ? current?.locale ?? activeLocale
      : await promptForLocale();
  setActiveLocale(locale);
  const snapshot = await getProjectSnapshot(process.cwd());
  printBrandHeader("init");
  printBrandPanels("init", [
    { label: messages.guide.project, value: snapshot.cwd },
    {
      label: messages.guide.configuredAgent,
      value: snapshot.config?.agentId ?? messages.guide.notConfiguredYet,
    },
    { label: messages.guide.configFile, value: getConfigPath() },
  ]);
  printGuide(snapshot, messages.titles.guideInit);

  const agent = await promptForAgent(options.agent);
  const globalSkillsDir = await promptForGlobalSkillsDir(agent, options.globalDir);
  const externalSkillsDir = await promptForExternalSkillsDir(options.skillsDir);

  if (current && isInteractiveSession()) {
    const replace = await confirm({
      message: messages.prompts.overwriteConfig(getConfigPath()),
      initialValue: true,
    });

    if (!assertPromptResult(replace)) {
      note(messages.outputs.keptExistingConfig, messages.titles.initSkipped);
      return;
    }
  }

  fs.ensureDirSync(globalSkillsDir);

  saveConfig({
    version: 1,
    agentId: agent.id,
    locale,
    globalSkillsDir,
    externalSkillsDir,
    updatedAt: new Date().toISOString(),
  });

  note(
    [
      `${messages.outputs.language}: ${locale}`,
      `${messages.outputs.agent}: ${agent.label}`,
      `${messages.outputs.globalSkills}: ${globalSkillsDir}`,
      `${messages.outputs.externalSkills}: ${externalSkillsDir}`,
      `${messages.outputs.config}: ${getConfigPath()}`,
    ].join("\n"),
    messages.titles.savedConfiguration,
  );
}

function executeListSkills(): SkillDescriptor[] {
  const config = loadConfig();

  if (!config) {
    throw new Error(messages.errors.configNotFound);
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

function getSkillsForAssistant(): SkillDescriptor[] {
  const config = loadConfig();

  if (!config || !fs.existsSync(config.externalSkillsDir)) {
    return [];
  }

  try {
    return listSkills(config.externalSkillsDir);
  } catch {
    return [];
  }
}

function executeAddSkill(query: string, options: AddSkillOptions): string {
  const config = loadConfig();

  if (!config) {
    throw new Error(messages.errors.configNotFound);
  }

  const skills = listSkills(config.externalSkillsDir);
  const skill = chooseSkillOrThrow(findSkillMatches(skills, query), query);
  const target = pickProjectTarget(process.cwd(), options.agent);
  const destination = installSkill(skill, target.skillsDir, Boolean(options.force));

  note(
    [
      `${messages.outputs.skill}: ${skill.name}`,
      `${messages.outputs.agent}: ${target.agent.label}`,
      `${messages.outputs.marker}: ${target.markerDir}`,
      `${messages.outputs.destination}: ${destination}`,
    ].join("\n"),
    messages.titles.skillInstalled,
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
      messages.errors.unsupportedFramework(
        framework,
        FRAMEWORKS.map((item) => item.id).join(", "),
      ),
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
    note(command, messages.titles.dryRun);
  } else {
    note(
      [
        `${messages.outputs.framework}: ${frameworkDefinition.label}`,
        `${messages.outputs.agentTarget}: ${target.agent.label}`,
        `${messages.outputs.command}: ${command}`,
      ].join("\n"),
      messages.titles.frameworkInstalled,
    );
  }

  return command;
}

function executeSyncSkills(options: SyncSkillsOptions): void {
  const config = loadConfig();

  if (!config) {
    throw new Error(messages.errors.configNotFound);
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
      `${messages.outputs.agent}: ${target.agent.label}`,
      `${messages.outputs.installed}: ${installed.length}`,
      `${messages.outputs.skipped}: ${skipped.length}`,
      installed.length > 0
        ? `${messages.outputs.installedSkills}: ${installed.join(", ")}`
        : "",
      skipped.length > 0
        ? `${messages.outputs.skippedExisting}: ${skipped.join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
    messages.titles.syncComplete,
  );
}

async function executeBootstrap(options: BootstrapOptions): Promise<void> {
  const frameworkTools = options.framework.flatMap((framework) => {
    const requirements = FRAMEWORK_TOOL_REQUIREMENTS[framework];

    if (!requirements) {
      throw new Error(
        messages.errors.unsupportedFramework(
          framework,
          FRAMEWORKS.map((item) => item.id).join(", "),
        ),
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
    note(messages.outputs.nothingToDo, messages.titles.bootstrap);
    return;
  }

  note(
    results
      .map(
        (result) =>
          `${result.toolId}: ${result.command}${result.executed ? "" : " (dry-run)"}`,
      )
      .join("\n"),
    messages.titles.bootstrapPlan,
  );
}

async function buildAssistantPlan(goal: string): Promise<AssistantRecommendation> {
  const snapshot = await getProjectSnapshot(process.cwd());
  const skills = getSkillsForAssistant();
  const toolStatuses = await inspectTools(["node", "npm", "npx", "python", "uv", "git", "gh"]);

  return buildAssistantRecommendation({
    goal,
    snapshot,
    skills,
    toolStatuses,
    messages,
  });
}

function printAssistantPlan(plan: AssistantRecommendation): void {
  note(formatAssistantRecommendation(plan, messages), messages.titles.assistantPlan);
}

async function executeAssistantAction(action: AssistantAction): Promise<void> {
  switch (action.kind) {
    case "init":
      await executeInitWorkflow({});
      return;
    case "doctor":
      printDoctorReport(await buildDoctorReport());
      return;
    case "add-skill":
      if (!action.skillQuery) {
        throw new Error(messages.errors.missingAssistantSkillQuery);
      }
      executeAddSkill(action.skillQuery, { force: false });
      return;
    case "sync-skills":
      executeSyncSkills({
        query: action.skillQueries ?? [],
        force: false,
      });
      return;
    case "add-framework":
      if (!action.frameworkId) {
        throw new Error(messages.errors.missingAssistantFrameworkId);
      }
      await executeAddFramework(action.frameworkId, { dryRun: false });
      return;
    case "bootstrap":
      await executeBootstrap({
        tool: (action.toolIds ?? []) as string[],
        framework: [],
        dryRun: false,
      });
      return;
    default:
      throw new Error(messages.errors.unknownAssistantAction(JSON.stringify(action)));
  }
}

async function promptForGoal(message: string): Promise<string> {
  if (!isInteractiveSession()) {
    return "";
  }

  const answer = await text({
    message,
    placeholder: messages.prompts.goalPlaceholder,
  });

  return assertPromptResult<string>(answer).trim();
}

async function maybeRunAssistantPlan(plan: AssistantRecommendation): Promise<void> {
  if (!isInteractiveSession() || plan.actions.length === 0) {
    return;
  }

  const answer = await select({
    message: messages.prompts.assistantRunQuestion,
    options: [
      {
        value: "none",
        label: messages.prompts.assistantRunNone,
        hint: messages.prompts.assistantRunNoneHint,
      },
      ...plan.actions.map((action) => ({
        value: action.id,
        label: action.label,
        hint: action.reason,
      })),
    ],
  });

  const selected = assertPromptResult(answer);

  if (selected === "none") {
    return;
  }

  const action = plan.actions.find((item) => item.id === selected);

  if (!action) {
    throw new Error(messages.errors.unknownAssistantAction(String(selected)));
  }

  await executeAssistantAction(action);
}

async function promptForFrameworkSelection(): Promise<FrameworkId> {
  const answer = await select({
    message: messages.prompts.frameworkQuestion,
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
    validate: (value) =>
      !value?.trim() ? messages.prompts.goalRequired : undefined,
  });

  return assertPromptResult<string>(answer).trim();
}

async function promptForSyncQueries(): Promise<string[]> {
  const mode = await select({
    message: messages.prompts.syncModeQuestion,
    options: [
      {
        value: "all",
        label: messages.prompts.syncModeAll,
        hint: messages.prompts.syncModeAllHint,
      },
      {
        value: "filtered",
        label: messages.prompts.syncModeFiltered,
        hint: messages.prompts.syncModeFilteredHint,
      },
    ],
  });

  if (assertPromptResult(mode) === "all") {
    return [];
  }

  const query = await promptForSkillQuery(
    messages.prompts.skillKeywordQuestion,
  );

  return [query];
}

async function promptForBootstrapTargets(): Promise<BootstrapOptions> {
  const mode = await select({
    message: messages.prompts.bootstrapQuestion,
    options: [
      {
        value: "recommended",
        label: messages.prompts.bootstrapRecommended,
        hint: messages.prompts.bootstrapRecommendedHint,
      },
      {
        value: "framework",
        label: messages.prompts.bootstrapFramework,
        hint: messages.prompts.bootstrapFrameworkHint,
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
    message: messages.prompts.continueAfterInit,
    options: [
      {
        value: "doctor",
        label: messages.prompts.continueDoctor,
        hint: messages.prompts.continueDoctorHint,
      },
      {
        value: "sync-skills",
        label: messages.prompts.continueSync,
        hint: messages.prompts.continueSyncHint,
      },
      {
        value: "framework",
        label: messages.prompts.continueFramework,
        hint: messages.prompts.continueFrameworkHint,
      },
      {
        value: "list-skills",
        label: messages.prompts.continueList,
        hint: messages.prompts.continueListHint,
      },
      {
        value: "assistant",
        label: messages.prompts.continueAssistant,
        hint: messages.prompts.continueAssistantHint,
      },
      {
        value: "finish",
        label: messages.prompts.continueFinish,
        hint: messages.prompts.continueFinishHint,
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
    case "assistant": {
      const goal = await promptForGoal(messages.prompts.goalQuestion);
      const plan = await buildAssistantPlan(goal);
      printAssistantPlan(plan);
      await maybeRunAssistantPlan(plan);
      return;
    }
    default:
      return;
  }
}

async function launchInteractiveHome(): Promise<void> {
  const initialSnapshot = await getProjectSnapshot(process.cwd());
  printBrandHeader("home");
  printBrandPanels("home", [
    { label: messages.guide.project, value: initialSnapshot.cwd },
    {
      label: messages.guide.configuredAgent,
      value: initialSnapshot.config?.agentId ?? messages.guide.notConfiguredYet,
    },
    {
      label: messages.guide.detectedAgents,
      value:
        initialSnapshot.detectedAgents.length > 0
          ? initialSnapshot.detectedAgents
              .map((entry) => `${entry.agent.label} (${entry.target.markerDir})`)
              .join(", ")
          : messages.guide.none,
    },
  ]);
  intro(messages.titles.home);

  while (true) {
    const snapshot = await getProjectSnapshot(process.cwd());
    printGuide(snapshot, messages.titles.guideProject);

    const answer = await select({
      message: messages.prompts.homeQuestion,
      options: [
        {
          value: "init",
          label: snapshot.config
            ? messages.prompts.homeReconfigure
            : messages.prompts.homeStart,
          hint: messages.prompts.homeInitHint,
        },
        {
          value: "doctor",
          label: messages.prompts.homeDoctor,
          hint: messages.prompts.homeDoctorHint,
        },
        {
          value: "list-skills",
          label: messages.prompts.homeListSkills,
          hint: messages.prompts.homeListSkillsHint,
        },
        {
          value: "add-skill",
          label: messages.prompts.homeAddSkill,
          hint: messages.prompts.homeAddSkillHint,
        },
        {
          value: "sync-skills",
          label: messages.prompts.homeSyncSkills,
          hint: messages.prompts.homeSyncSkillsHint,
        },
        {
          value: "framework",
          label: messages.prompts.homeFramework,
          hint: messages.prompts.homeFrameworkHint,
        },
        {
          value: "bootstrap",
          label: messages.prompts.homeBootstrap,
          hint: messages.prompts.homeBootstrapHint,
        },
        {
          value: "assistant",
          label: messages.prompts.homeAssistant,
          hint: messages.prompts.homeAssistantHint,
        },
        {
          value: "exit",
          label: messages.prompts.homeExit,
          hint: messages.prompts.homeExitHint,
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
          messages.prompts.skillQuestion,
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
      case "assistant": {
        const goal = await promptForGoal(messages.prompts.goalQuestion);
        const plan = await buildAssistantPlan(goal);
        printAssistantPlan(plan);
        await maybeRunAssistantPlan(plan);
        break;
      }
      default:
        outro(messages.outputs.seeYouLater);
        return;
    }
  }
}

const program = new Command();

program
  .name("master-skill")
  .description(messages.help.rootDescription)
  .version("0.4.0")
  .showHelpAfterError();

withLangOption(program);

program.action(async () => {
  if (isInteractiveSession()) {
    await launchInteractiveHome();
    return;
  }

  printGuide(await getProjectSnapshot(process.cwd()));
  console.log(`\n${messages.guide.nonInteractiveHint}`);
});

withLangOption(
  program
  .command("assist [goal...]")
  .description(messages.help.assist)
  .option("--run", messages.help.optionRun, false)
  .action(async (goalWords: string[] = [], options: AssistOptions) => {
    printBrandHeader("assist");
    printBrandPanels("assist", [
      { label: messages.guide.project, value: process.cwd() },
      {
        label: messages.guide.configuredAgent,
        value: loadConfig()?.agentId ?? messages.guide.notConfiguredYet,
      },
    ]);
    const goal =
      goalWords.length > 0
        ? goalWords.join(" ")
        : await promptForGoal(messages.prompts.goalQuestion);
    const plan = await buildAssistantPlan(goal);
    printAssistantPlan(plan);

    if (options.run && plan.actions.length > 0) {
      await executeAssistantAction(plan.actions[0]);
      return;
    }

    await maybeRunAssistantPlan(plan);
  }),
);

withLangOption(
  program
  .command("guide")
  .description(messages.help.guide)
  .action(async () => {
    printBrandHeader("guide");
    printBrandPanels("guide", [
      { label: messages.guide.project, value: process.cwd() },
      {
        label: messages.guide.configuredAgent,
        value: loadConfig()?.agentId ?? messages.guide.notConfiguredYet,
      },
    ]);
    printGuide(await getProjectSnapshot(process.cwd()));
  }),
);

withLangOption(
  program
  .command("init")
  .description(messages.help.init)
  .option("--agent <agent>", messages.help.optionDefaultAgent)
  .option("--global-dir <dir>", messages.help.optionGlobalDir)
  .option("--skills-dir <dir>", messages.help.optionSkillsDir)
  .action(async (options: InitOptions) => {
    intro(messages.titles.onboarding);
    await executeInitWorkflow(options);
    await maybeContinueAfterInit();
    outro(messages.outputs.onboardingFinished);
  }),
);

withLangOption(
  program
  .command("doctor")
  .description(messages.help.doctor)
  .action(async () => {
    printBrandHeader("doctor");
    printBrandPanels("doctor", [
      { label: messages.guide.project, value: process.cwd() },
      { label: messages.guide.configFile, value: getConfigPath() },
    ]);
    intro(messages.titles.doctor);
    printDoctorReport(await buildDoctorReport());
    outro(messages.outputs.doctorFinished);
  }),
);

const listCommand = withLangOption(
  program.command("list").description(messages.help.list),
);

withLangOption(
  listCommand
  .command("skills")
  .description(messages.help.listSkills)
  .action(() => {
    printSkillList(executeListSkills());
  }),
);

const addCommand = withLangOption(
  program.command("add").description(messages.help.add),
);

withLangOption(
  addCommand
  .command("skill <query>")
  .description(messages.help.addSkill)
  .option("--agent <agent>", messages.help.optionAgent)
  .option("--force", messages.help.optionForce, false)
  .action((query: string, options: AddSkillOptions) => {
    executeAddSkill(query, options);
  }),
);

withLangOption(
  addCommand
  .command("framework <framework>")
  .description(messages.help.addFramework)
  .option("--agent <agent>", messages.help.optionAgent)
  .option("--dry-run", messages.help.optionDryRun, false)
  .action(async (framework: FrameworkId, options: AddFrameworkOptions) => {
    await executeAddFramework(framework, options);
  }),
);

const syncCommand = withLangOption(
  program.command("sync").description(messages.help.sync),
);

withLangOption(
  syncCommand
  .command("skills")
  .description(messages.help.syncSkills)
  .option("--agent <agent>", messages.help.optionAgent)
  .option("--query <query>", messages.help.optionQuery, collectOption, [])
  .option("--force", messages.help.optionForce, false)
  .action((options: SyncSkillsOptions) => {
    executeSyncSkills(options);
  }),
);

withLangOption(
  program
  .command("bootstrap")
  .description(messages.help.bootstrap)
  .option("--tool <tool>", messages.help.optionTool, collectOption, [])
  .option(
    "--framework <framework>",
    messages.help.optionFramework,
    collectOption,
    [],
  )
  .option("--dry-run", messages.help.optionDryRun, false)
  .action(async (options: BootstrapOptions) => {
    await executeBootstrap(options);
  }),
);

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(pc.red(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
