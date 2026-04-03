import type { FrameworkId } from "./frameworks.js";
import type { SkillDescriptor } from "./skills.js";
import type { ToolId, ToolStatus } from "./tools.js";
import type { I18nMessages } from "./i18n.js";

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
  id:
    | "spec"
    | "workflow"
    | "frontend"
    | "document"
    | "pdf"
    | "slides"
    | "spreadsheet"
    | "testing"
    | "integration"
    | "art";
  keywords: string[];
  frameworkId?: FrameworkId;
  skillHints?: string[];
}

const INTENTS: IntentDefinition[] = [
  {
    id: "spec",
    keywords: [
      "spec",
      "specification",
      "requirements",
      "requirement",
      "especificacao",
      "especificacoes",
      "requisitos",
      "requisito",
      "planejar",
      "plano",
      "planejamento",
      "estruturar",
      "estrutura",
      "organizar",
      "organizacao",
      "setup",
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
    keywords: [
      "workflow",
      "agile",
      "multi agent",
      "multi-agent",
      "multiagente",
      "multiagentes",
      "papel",
      "roles",
      "processo",
      "implementacao",
      "team flow",
      "sprint",
      "bmad",
    ],
    frameworkId: "bmad",
    skillHints: ["internal-comms"],
  },
  {
    id: "frontend",
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
      "pagina",
      "paginas",
      "interface",
      "componente",
      "component",
    ],
    skillHints: ["frontend-design", "webapp-testing"],
  },
  {
    id: "document",
    keywords: [
      "document",
      "documento",
      "documentacao",
      "doc",
      "docx",
      "word",
      "proposal",
      "proposta",
      "memo",
      "report",
      "relatorio",
      "spec doc",
      "manual",
    ],
    skillHints: ["docx", "doc-coauthoring"],
  },
  {
    id: "pdf",
    keywords: ["pdf", "watermark", "ocr", "merge pdf", "split pdf", "mesclar pdf"],
    skillHints: ["pdf"],
  },
  {
    id: "slides",
    keywords: [
      "slides",
      "deck",
      "presentation",
      "pitch",
      "ppt",
      "pptx",
      "apresentacao",
    ],
    skillHints: ["pptx"],
  },
  {
    id: "spreadsheet",
    keywords: ["xlsx", "excel", "csv", "spreadsheet", "planilha", "table"],
    skillHints: ["xlsx"],
  },
  {
    id: "testing",
    keywords: [
      "test",
      "qa",
      "verify",
      "bug",
      "debug",
      "playwright",
      "broken",
      "teste",
      "validacao",
      "quebrado",
    ],
    skillHints: ["webapp-testing"],
  },
  {
    id: "integration",
    keywords: [
      "mcp",
      "api",
      "sdk",
      "integration",
      "connector",
      "server",
      "integracao",
      "conector",
    ],
    skillHints: ["mcp-builder"],
  },
  {
    id: "art",
    keywords: [
      "art",
      "poster",
      "visual",
      "canvas",
      "image",
      "generative",
      "arte",
      "imagem",
    ],
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
  messages: I18nMessages;
}): AssistantRecommendation {
  const { goal, snapshot, skills, toolStatuses, messages } = args;
  const intent = pickIntent(goal);
  const actions: AssistantAction[] = [];
  const notes: string[] = [];

  if (!snapshot.config) {
    actions.push({
      id: "init",
      kind: "init",
      label: messages.assistant.actions.initLabel,
      reason: messages.assistant.actions.initReason,
      command: "master-skill init",
    });
  }

  if (snapshot.detectedAgents.length === 0) {
    notes.push(messages.assistant.noMarkersNote);
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
        label: messages.assistant.actions.bootstrapLabel(missingTools.join(", ")),
        reason: messages.assistant.actions.bootstrapReason(intent.frameworkId),
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
        label: messages.assistant.actions.installFrameworkLabel(frameworkLabel),
        reason: messages.assistant.intents[intent.id].summary,
        command: `master-skill add framework ${intent.frameworkId}`,
        frameworkId: intent.frameworkId,
      });
    }
  }

  if (skillQueries.length === 1) {
    actions.push({
      id: "add-skill",
      kind: "add-skill",
      label: messages.assistant.actions.installSkillLabel(skillQueries[0]),
      reason: messages.assistant.actions.installSkillReason,
      command: `master-skill add skill "${skillQueries[0]}"`,
      skillQuery: skillQueries[0],
    });
  } else if (skillQueries.length > 1) {
    actions.push({
      id: "sync-skills",
      kind: "sync-skills",
      label: messages.assistant.actions.syncSkillsLabel(skillQueries.length),
      reason: messages.assistant.actions.syncSkillsReason,
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
      label: messages.assistant.actions.doctorLabel,
      reason: messages.assistant.actions.doctorReason,
      command: "master-skill doctor",
    });
  }

  if (!goal.trim()) {
    notes.push(messages.assistant.noGoalNote);
  }

  notes.push(messages.assistant.heuristicNote);

  return {
    goal,
    interpretedIntent:
      intent?.id ? messages.assistant.intents[intent.id].label : messages.assistant.generalIntent,
    summary: intent?.id
      ? messages.assistant.intents[intent.id].summary
      : messages.assistant.fallbackSummary,
    notes,
    actions,
  };
}

export function formatAssistantRecommendation(
  recommendation: AssistantRecommendation,
  messages: I18nMessages,
): string {
  return [
    `${messages.assistant.detectedIntent}: ${recommendation.interpretedIntent}`,
    `${messages.assistant.summary}: ${recommendation.summary}`,
    recommendation.goal
      ? `${messages.assistant.goal}: ${recommendation.goal}`
      : `${messages.assistant.goal}: ${messages.assistant.goalMissing}`,
    "",
    messages.assistant.suggestedActions,
    ...recommendation.actions.map(
      (action, index) =>
        `${index + 1}. ${action.label}\n   ${messages.assistant.why}: ${action.reason}\n   ${messages.assistant.command}: ${buildActionCommand(action)}`,
    ),
    "",
    messages.assistant.notes,
    ...recommendation.notes.map((note) => `- ${note}`),
  ].join("\n");
}
