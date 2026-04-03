import pc from "picocolors";
import type { I18nMessages } from "./i18n.js";

export type BrandMode = "home" | "init" | "doctor" | "guide" | "assist";

interface KeyValueRow {
  label: string;
  value: string;
}

const LOGO_LINES = [
  " __  __           _             ____  _    _ _ _ _ ",
  "|  \\/  | __ _ ___| |_ ___ _ __ / ___|| | _(_) | | |",
  "| |\\/| |/ _` / __| __/ _ \\ '__|\\___ \\| |/ / | | | |",
  "| |  | | (_| \\__ \\ ||  __/ |    ___) |   <| | | | |",
  "|_|  |_|\\__,_|___/\\__\\___|_|   |____/|_|\\_\\_|_|_|_|",
];

function getModeSummary(mode: BrandMode, messages: I18nMessages): string {
  switch (mode) {
    case "home":
      return messages.help.rootDescription;
    case "init":
      return messages.help.init;
    case "doctor":
      return messages.help.doctor;
    case "guide":
      return messages.help.guide;
    case "assist":
      return messages.help.assist;
  }
}

function getModeSteps(mode: BrandMode, messages: I18nMessages): string[] {
  switch (mode) {
    case "home":
      return [
        messages.branding.stageReviewContext,
        messages.branding.stageChooseAction,
        messages.branding.stageRunAction,
      ];
    case "init":
      return [
        messages.branding.stageChooseLanguage,
        messages.branding.stageChooseAgent,
        messages.branding.stageConnectFolders,
        messages.branding.stageSaveConfig,
      ];
    case "doctor":
      return [
        messages.branding.stageScanProject,
        messages.branding.stageLoadConfig,
        messages.branding.stageCheckTools,
      ];
    case "guide":
      return [
        messages.branding.stageReadProject,
        messages.branding.stageSummarizeState,
        messages.branding.stageRecommendNext,
      ];
    case "assist":
      return [
        messages.branding.stageInterpretGoal,
        messages.branding.stageMatchIntent,
        messages.branding.stageSuggestActions,
      ];
  }
}

function getCommandMap(messages: I18nMessages): Array<[string, string]> {
  return [
    ["init", messages.branding.mapInit],
    ["doctor", messages.branding.mapDoctor],
    ["sync skills", messages.branding.mapSync],
    ["add framework", messages.branding.mapFramework],
    ["assist", messages.branding.mapAssist],
  ];
}

export function renderBrandHeader(
  mode: BrandMode,
  messages: I18nMessages,
): string {
  const logo = LOGO_LINES.map((line, index) => {
    if (index < 2) {
      return pc.cyan(line);
    }

    if (index < 4) {
      return pc.blueBright(line);
    }

    return pc.whiteBright(line);
  }).join("\n");

  const title = pc.bold(pc.whiteBright(messages.titles.home));
  const badge = pc.yellow(messages.branding.badge);
  const subtitle = pc.dim(getModeSummary(mode, messages));

  return [logo, "", title, badge, subtitle].join("\n");
}

export function renderStageFlow(
  mode: BrandMode,
  messages: I18nMessages,
): string {
  return getModeSteps(mode, messages)
    .map((step, index) => {
      const marker = index === 0 ? pc.cyan(">>") : pc.dim("--");
      const label = index === 0 ? pc.whiteBright(step) : pc.dim(step);
      return `${marker} ${index + 1}. ${label}`;
    })
    .join("\n");
}

export function renderCommandMap(messages: I18nMessages): string {
  const entries = getCommandMap(messages);
  const width = Math.max(...entries.map(([name]) => name.length));

  return entries
    .map(
      ([name, description]) =>
        `${pc.cyan(name.padEnd(width, " "))}  ${description}`,
    )
    .join("\n");
}

export function renderKeyValuePanel(rows: KeyValueRow[]): string {
  const width = Math.max(...rows.map((row) => row.label.length));

  return rows
    .map(
      (row) =>
        `${pc.dim(row.label.padEnd(width, " "))} : ${pc.whiteBright(row.value)}`,
    )
    .join("\n");
}
