import type { FrameworkId } from "./frameworks.js";
import type { SkillDescriptor } from "./skills.js";
import type { ToolId, ToolStatus } from "./tools.js";

export interface AssistantProjectSnapshot {
  cwd: string;
  config: { agentId: string } | null;
  detectedAgents: Array<{
    agent: { label: string };
    target: { markerDir: string };
  }>;
  installedFrameworks: string[];
  recommendedTarget:
    | {
        agentLabel: string;
        markerDir: string;
        skillsDir: string;
      }
    | null;
}

export interface AssistantAction {
  id: string;
  kind: "init" | "doctor" | "add-skill" | "sync-skills" | "add-framework" | "bootstrap";
  label: string;
  reason: string;
  command: string;
  frameworkId?: FrameworkId;
  skillQuery?: string;
  skillQueries?: string[];
  toolIds?: ToolId[];
}

export interface AssistantRecommendation {
  goal: string;
  interpretedIntent: string;
  summary: string;
  notes: string[];
  actions: AssistantAction[];
}

interface IntentDefinition {
  id: string;
  label: string;
  summary: string;
  keywords: string[];
  frameworkId?: FrameworkId;
  skillHints?: string[];
}

const INTENTS: IntentDefinition[] = [
  {
    id: "spec",
    label: "Specification and planning",
    summary: "This sounds like requirements, planning, or spec-driven work.",
    keywords: [
      "spec",
      "specification",
      "requirements",
      "requirement",
      "planejar",
      "plano",
      "roadmap",
      "arquitetura",
      "architecture",
      "product",
      "prd",
      "task breakdown",
    ],
    frameworkId: "spec-kit",
    skillHints: ["doc-coauthoring", "mcp-builder"],
  },
  {
    id: "workflow",
    label: "Guided implementation workflow",
    summary: "This looks like multi-role or process-heavy development work.",
    keywords: [
      "workflow",
      "agile",
      "multi agent",
      "multi-agent",
      "papel",
      "roles",
      "processo",
      "team flow",
      "sprint",
      "bmad",
    ],
    frameworkId: "bmad",
    skillHints: ["internal-comms"],
  },
  {
    id: "frontend",
    label: "Frontend and interface work",
    summary: "This sounds like UI, pages, or interaction design work.",
    keywords: [
      "ui",
      "ux",
      "frontend",
      "front-end",
      "page",
      "landing",
      "dashboard",
      "site",
      "screen",
      "layout",
      "design",
      "componente",
      "component",
    ],
    skillHints: ["frontend-design", "webapp-testing"],
  },
  {
    id: "document",
    label: "Document authoring",
    summary: "This sounds like structured documentation or Word-style output.",
    keywords: [
      "document",
      "doc",
      "docx",
      "word",
      "proposal",
      "memo",
      "report",
      "spec doc",
      "manual",
    ],
    skillHints: ["docx", "doc-coauthoring"],
  },
  {
    id: "pdf",
    label: "PDF workflow",
    summary: "This sounds like PDF generation or manipulation work.",
    keywords: ["pdf", "watermark", "ocr", "merge pdf", "split pdf"],
    skillHints: ["pdf"],
  },
  {
    id: "slides",
    label: "Presentation workflow",
    summary: "This sounds like presentation or deck work.",
    keywords: ["slides", "deck", "presentation", "pitch", "ppt", "pptx"],
    skillHints: ["pptx"],
  },
  {
    id: "spreadsheet",
    label: "Spreadsheet workflow",
    summary: "This sounds like spreadsheet or tabular data work.",
    keywords: ["xlsx", "excel", "csv", "spreadsheet", "planilha", "table"],
    skillHints: ["xlsx"],
  },
  {
    id: "testing",
    label: "Testing and verification",
    summary: "This sounds like validation, QA, or browser-based verification.",
    keywords: ["test", "qa", "verify", "bug", "debug", "playwright", "broken"],
    skillHints: ["webapp-testing"],
  },
  {
    id: "integration",
    label: "Integration and protocol work",
    summary: "This sounds like MCP, API, or integration work.",
    keywords: ["mcp", "api", "sdk", "integration", "connector", "server"],
    skillHints: ["mcp-builder"],
  },
  {
    id: "art",
    label: "Visual artifact creation",
    summary: "This sounds like poster, art, or visual asset work.",
    keywords: ["art", "poster", "visual", "canvas", "image", "generative"],
    skillHints: ["canvas-design", "algorithmic-art"],
  },
];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function countKeywordHits(goal: string, keywords: string[]): number {
  return keywords.reduce(
    (total, keyword) => total + (goal.includes(keyword) ? 1 : 0),
    0,
  );
}

function pickIntent(goal: string): IntentDefinition | null {
  const normalizedGoal = normalize(goal);

  if (!normalizedGoal) {
    return null;
  }

  const ranked = INTENTS.map((intent) => ({
    intent,
    score: countKeywordHits(normalizedGoal, intent.keywords),
  }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.intent ?? null;
}

function scoreSkill(skill: SkillDescriptor, hint: string): number {
  const haystack = `${skill.name} ${skill.description} ${skill.relativePath}`.toLowerCase();

  if (haystack === hint) {
    return 100;
  }

  if (skill.name.toLowerCase() === hint) {
    return 90;
  }

  if (haystack.includes(hint)) {
    return 60;
  }

  return 0;
}

function resolveSkillQueries(
  skills: SkillDescriptor[],
  hints: string[] | undefined,
): string[] {
  if (!hints || hints.length === 0) {
    return [];
  }

  const selected: string[] = [];

  for (const hint of hints) {
    const best = skills
      .map((skill) => ({ skill, score: scoreSkill(skill, hint.toLowerCase()) }))
      .sort((left, right) => right.score - left.score)[0];

    if (best && best.score > 0) {
      selected.push(best.skill.name);
    }
  }

  return Array.from(new Set(selected));
}

function findTool(statuses: ToolStatus[], toolId: ToolId): ToolStatus | undefined {
  return statuses.find((status) => status.id === toolId);
}

function buildActionCommand(action: AssistantAction): string {
  return action.command;
}

export function buildAssistantRecommendation(args: {
  goal: string;
  snapshot: AssistantProjectSnapshot;
  skills: SkillDescriptor[];
  toolStatuses: ToolStatus[];
}): AssistantRecommendation {
  const { goal, snapshot, skills, toolStatuses } = args;
  const intent = pickIntent(goal);
  const actions: AssistantAction[] = [];
  const notes: string[] = [];

  if (!snapshot.config) {
    actions.push({
      id: "init",
      kind: "init",
      label: "Run onboarding first",
      reason: "This CLI still needs a default agent and an external skill library.",
      command: "master-skill init",
    });
  }

  if (snapshot.detectedAgents.length === 0) {
    notes.push(
      "No agent marker was detected in this project. If needed, use `--agent` explicitly.",
    );
  }

  const skillQueries = resolveSkillQueries(skills, intent?.skillHints);

  if (intent?.frameworkId) {
    const requiredTools =
      intent.frameworkId === "spec-kit" ? (["uv"] as ToolId[]) : ([] as ToolId[]);
    const missingTools = requiredTools.filter(
      (toolId) => !findTool(toolStatuses, toolId)?.installed,
    );

    if (missingTools.length > 0) {
      actions.push({
        id: "bootstrap-tools",
        kind: "bootstrap",
        label: `Bootstrap ${missingTools.join(", ")}`,
        reason: `${intent.frameworkId} depends on missing local tools.`,
        command: `master-skill bootstrap --framework ${intent.frameworkId}`,
        toolIds: missingTools,
      });
    }

    const frameworkLabel =
      intent.frameworkId === "bmad"
        ? "BMad Method"
        : intent.frameworkId === "spec-kit"
          ? "Spec Kit"
          : "Antigravity Kit";

    if (!snapshot.installedFrameworks.includes(frameworkLabel)) {
      actions.push({
        id: "install-framework",
        kind: "add-framework",
        label: `Install ${frameworkLabel}`,
        reason: intent.summary,
        command: `master-skill add framework ${intent.frameworkId}`,
        frameworkId: intent.frameworkId,
      });
    }
  }

  if (skillQueries.length === 1) {
    actions.push({
      id: "add-skill",
      kind: "add-skill",
      label: `Install skill ${skillQueries[0]}`,
      reason: "This skill matches the current project intent.",
      command: `master-skill add skill "${skillQueries[0]}"`,
      skillQuery: skillQueries[0],
    });
  } else if (skillQueries.length > 1) {
    actions.push({
      id: "sync-skills",
      kind: "sync-skills",
      label: `Sync ${skillQueries.length} related skills`,
      reason: "A small bundle of skills matches the current project intent.",
      command: skillQueries
        .map((query) => `master-skill sync skills --query "${query}"`)
        .join("  |  "),
      skillQueries,
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: "doctor",
      kind: "doctor",
      label: "Inspect the project first",
      reason: "No strong intent match was found, so inspection is the safest first move.",
      command: "master-skill doctor",
    });
  }

  if (!goal.trim()) {
    notes.push(
      "No explicit goal was provided, so the assistant used only the current project state.",
    );
  }

  notes.push(
    "This assistant is heuristic-based. It uses project context plus your stated goal, without requiring an API key.",
  );

  return {
    goal,
    interpretedIntent: intent?.label ?? "General project setup",
    summary:
      intent?.summary ??
      "No strong intent match was found, so the assistant fell back to generic project setup guidance.",
    notes,
    actions,
  };
}

export function formatAssistantRecommendation(
  recommendation: AssistantRecommendation,
): string {
  return [
    `Detected intent: ${recommendation.interpretedIntent}`,
    `Summary: ${recommendation.summary}`,
    recommendation.goal ? `Goal: ${recommendation.goal}` : "Goal: not provided",
    "",
    "Suggested actions:",
    ...recommendation.actions.map(
      (action, index) =>
        `${index + 1}. ${action.label}\n   Why: ${action.reason}\n   Command: ${buildActionCommand(action)}`,
    ),
    "",
    "Notes:",
    ...recommendation.notes.map((note) => `- ${note}`),
  ].join("\n");
}
