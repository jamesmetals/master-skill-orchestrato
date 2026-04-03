export const SUPPORTED_LOCALES = ["en", "pt-BR"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function readCliLocaleArg(argv: string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--lang") {
      return argv[index + 1];
    }

    if (token.startsWith("--lang=")) {
      return token.slice("--lang=".length);
    }
  }

  return undefined;
}

export function normalizeLocale(value?: string | null): SupportedLocale | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "en" || normalized.startsWith("en-")) {
    return "en";
  }

  if (
    normalized === "pt" ||
    normalized === "pt-br" ||
    normalized.startsWith("pt-")
  ) {
    return "pt-BR";
  }

  return undefined;
}

export function detectSystemLocale(): SupportedLocale {
  return (
    normalizeLocale(process.env.LC_ALL) ??
    normalizeLocale(process.env.LC_MESSAGES) ??
    normalizeLocale(process.env.LANG) ??
    normalizeLocale(Intl.DateTimeFormat().resolvedOptions().locale) ??
    "en"
  );
}

export function resolveStartupLocale(
  argv: string[],
  configuredLocale?: string | null,
): SupportedLocale {
  return (
    normalizeLocale(readCliLocaleArg(argv)) ??
    normalizeLocale(configuredLocale) ??
    detectSystemLocale()
  );
}

const MESSAGES = {
  en: {
    localeNames: {
      en: "English",
      "pt-BR": "Portuguese (Brazil)",
    },
    help: {
      rootDescription:
        "Orchestrate reusable skills and AI development frameworks across projects.",
      langOption: "Interface language",
      guide: "Explain what Master Skill does for the current project.",
      init:
        "Guide onboarding: explain the CLI, connect the default agent, and save the reusable skill library.",
      doctor: "Inspect local configuration, project markers, and basic prerequisites.",
      list: "List available entities.",
      listSkills: "List skills available in the reusable skills library.",
      add: "Install a framework or skill into the current project.",
      addSkill: "Copy one reusable skill into the current project.",
      addFramework:
        "Run the official installer for a supported framework in the current project.",
      sync: "Synchronize reusable assets into the current project.",
      syncSkills:
        "Sync all reusable skills, or a filtered subset, into the current project.",
      bootstrap:
        "Install missing system prerequisites used by frameworks and publishing.",
      assist:
        "Analyze the current project, interpret your goal, and suggest or execute the next step.",
      optionAgent: "Project agent id",
      optionForce: "Overwrite destination if it already exists",
      optionDryRun: "Print installer commands without running them",
      optionTool: "Specific tool to install",
      optionFramework: "Install prerequisites for a framework",
      optionQuery: "Filter skills by query",
      optionRun: "Execute the top assistant recommendation immediately",
      optionDefaultAgent: "Default agent id",
      optionGlobalDir: "Global skills directory for the selected agent",
      optionSkillsDir: "Reusable external skills directory",
    },
    prompts: {
      interactiveRequired: (optionHint: string) =>
        `Interactive input is required here. Re-run in a terminal, or pass ${optionHint}.`,
      localeQuestion: "Interface language / Idioma da interface",
      agentQuestion: "Which AI agent should be managed by default?",
      globalSkillsQuestion: (label: string) =>
        `Where should the global ${label} skills live?`,
      skillsLibraryQuestion: "Where is your reusable skills library?",
      skillsLibraryPlaceholder: "C:\\Users\\you\\AI-Skills",
      skillsLibraryRequired: "Provide a folder path.",
      skillsLibraryNotFound: "Folder not found.",
      overwriteConfig: (configPath: string) =>
        `Overwrite existing config at ${configPath}?`,
      frameworkQuestion: "Which framework do you want to install in this project?",
      skillQuestion:
        "Which reusable skill do you want to install into this project?",
      skillKeywordQuestion:
        "Which skill keyword should be synced into this project?",
      syncModeQuestion: "How do you want to sync skills into this project?",
      syncModeAll: "All reusable skills",
      syncModeAllHint:
        "Copy every skill from the external library into this project.",
      syncModeFiltered: "Filtered subset",
      syncModeFilteredHint: "Choose a keyword and copy only matching skills.",
      bootstrapQuestion: "What should Master Skill bootstrap?",
      bootstrapRecommended: "Recommended tools",
      bootstrapRecommendedHint:
        "Install the default helper tools used by the CLI.",
      bootstrapFramework: "Tools for one framework",
      bootstrapFrameworkHint:
        "Bootstrap prerequisites for BMad, Spec Kit, or Antigravity Kit.",
      continueAfterInit:
        "Configuration saved. What do you want to do next in this project?",
      continueDoctor: "Inspect this project",
      continueDoctorHint: "Show config, markers, and tool prerequisites.",
      continueSync: "Sync reusable skills",
      continueSyncHint: "Copy your shared skills into the current project.",
      continueFramework: "Install one framework",
      continueFrameworkHint:
        "Run BMad, Spec Kit, or Antigravity Kit for this project.",
      continueList: "Browse available skills",
      continueListHint: "Show what exists in the external skills library.",
      continueAssistant: "Ask the assistant what fits this project",
      continueAssistantHint:
        "Interpret your goal and suggest the next step.",
      continueFinish: "Finish for now",
      continueFinishHint: "Keep the saved config and exit onboarding.",
      homeQuestion: "What do you want to do now?",
      homeStart: "Start onboarding",
      homeReconfigure: "Reconfigure Master Skill",
      homeInitHint:
        "Connect your default agent and external skill library.",
      homeDoctor: "Inspect this project",
      homeDoctorHint: "Review config, markers, and prerequisite tools.",
      homeListSkills: "Browse reusable skills",
      homeListSkillsHint:
        "Show what is available in your external skill library.",
      homeAddSkill: "Install one skill",
      homeAddSkillHint: "Copy one reusable skill into this project.",
      homeSyncSkills: "Sync skills in bulk",
      homeSyncSkillsHint:
        "Copy all skills or a filtered subset into this project.",
      homeFramework: "Install one framework",
      homeFrameworkHint: "Run BMad, Spec Kit, or Antigravity Kit here.",
      homeBootstrap: "Bootstrap prerequisites",
      homeBootstrapHint: "Install missing tools like uv and gh.",
      homeAssistant: "Ask the assistant",
      homeAssistantHint:
        "Describe your goal and let Master Skill suggest the next move.",
      homeExit: "Exit",
      homeExitHint: "Leave the interactive guide.",
      goalQuestion: "What are you trying to do in this project?",
      goalPlaceholder:
        "example: I want to set up frontend work for this project",
      goalRequired: "Provide a skill name or keyword.",
      assistantRunQuestion:
        "Do you want Master Skill to execute one of these actions now?",
      assistantRunNone: "Just keep the plan",
      assistantRunNoneHint: "Review the recommendation and act later.",
    },
    titles: {
      onboarding: "Master Skill onboarding",
      home: "Master Skill Orchestrator",
      doctor: "Doctor",
      guide: "Master Skill overview",
      guideProject: "What Master Skill can do for this project",
      guideInit: "What Master Skill does",
      environment: "Environment",
      configuration: "Configuration",
      tooling: "Tooling",
      savedConfiguration: "Saved configuration",
      initSkipped: "Init skipped",
      skillInstalled: "Skill installed",
      frameworkInstalled: "Framework installed",
      syncComplete: "Sync complete",
      bootstrap: "Bootstrap",
      bootstrapPlan: "Bootstrap plan",
      dryRun: "Dry run",
      assistantPlan: "Assistant plan",
    },
    guide: {
      intro: "Master Skill is an orchestration CLI for AI-first development projects.",
      whatItDoes: "What it does:",
      bullets: [
        "Connect one default agent plus one reusable skill library.",
        "Copy reusable skills into the current project on demand.",
        "Install project frameworks like BMad, Spec Kit, and Antigravity Kit.",
        "Bootstrap missing tools such as uv and gh.",
      ],
      snapshotTitle: "Project snapshot:",
      cliHome: "CLI home",
      configFile: "Config file",
      project: "Project",
      configuredAgent: "Configured default agent",
      detectedAgents: "Detected agent markers",
      installedFrameworks: "Installed frameworks",
      recommendedTarget: "Recommended project target",
      recommendedNext: "Recommended next step",
      notConfiguredYet: "not configured yet",
      notFound: "not found",
      none: "none",
      noneDetected: "none detected",
      needsManualSelection: "needs manual selection",
      nextStepSetup:
        "Run `init` to connect one default agent and your reusable skill library.",
      nextStepNoMarkers:
        "Open a project with `.agents`, `.claude`, `.agent`, `.cursor` or pass `--agent` explicitly.",
      nextStepNoFrameworks:
        "Start with `sync skills` for reusable skills, or `add framework` if this project needs a formal workflow.",
      nextStepDefault:
        "Use `sync skills` to bring reusable capabilities in, or `doctor` to inspect prerequisites before the next install.",
      nonInteractiveHint:
        "Run `master-skill init` to onboard, or `master-skill doctor` to inspect the current project.",
    },
    outputs: {
      operationCancelled: "Operation cancelled.",
      keptExistingConfig: "Kept the existing configuration.",
      nothingToDo:
        "Nothing to do. Requested tools are already installed.",
      onboardingFinished: "Onboarding finished.",
      initializationComplete: "Initialization complete.",
      doctorFinished: "Doctor finished.",
      seeYouLater: "See you later.",
      agent: "Agent",
      skill: "Skill",
      globalSkills: "Global skills",
      externalSkills: "External skills",
      language: "Language",
      config: "Config",
      marker: "Marker",
      destination: "Destination",
      framework: "Framework",
      agentTarget: "Agent target",
      command: "Command",
      installed: "Installed",
      skipped: "Skipped",
      installedSkills: "Installed skills",
      skippedExisting: "Skipped existing",
      defaultAgent: "Default agent",
      externalFolderExists: "External folder exists",
      exists: "exists",
      willBeCreated: "will be created",
      ok: "ok",
      missing: "missing",
      install: "install",
      yes: "yes",
      no: "no",
    },
    errors: {
      configNotFound:
        "Configuration not found. Run `master-skill init` first.",
      unsupportedLocale: (value: string, available: string) =>
        `Unsupported locale: ${value}. Available: ${available}`,
      externalSkillsDirNotFound: (value: string) =>
        `External skills directory not found: ${value}`,
      unsupportedAgent: (value: string) => `Unsupported agent: ${value}`,
      unsupportedFramework: (value: string, available: string) =>
        `Unsupported framework: ${value}. Available: ${available}`,
      multipleAgentMarkers: (markers: string) =>
        `Multiple agent folders detected: ${markers}. Re-run with --agent.`,
      noSkillMatch: (query: string) => `No skill matched "${query}".`,
      multipleSkillMatches: (query: string, matches: string) =>
        `Multiple skills matched "${query}": ${matches}. Narrow the query.`,
      destinationExists: (destination: string) =>
        `Destination already exists: ${destination}. Re-run with --force to overwrite.`,
      missingAssistantSkillQuery:
        "Assistant action is missing a skill query.",
      missingAssistantFrameworkId:
        "Assistant action is missing a framework id.",
      unknownAssistantAction: (value: string) =>
        `Unknown assistant action: ${value}`,
    },
    assistant: {
      detectedIntent: "Detected intent",
      summary: "Summary",
      goal: "Goal",
      goalMissing: "not provided",
      suggestedActions: "Suggested actions:",
      why: "Why",
      command: "Command",
      notes: "Notes:",
      heuristicNote:
        "This assistant is heuristic-based. It uses project context plus your stated goal, without requiring an API key.",
      noGoalNote:
        "No explicit goal was provided, so the assistant used only the current project state.",
      noMarkersNote:
        "No agent marker was detected in this project. If needed, use `--agent` explicitly.",
      generalIntent: "General project setup",
      fallbackSummary:
        "No strong intent match was found, so the assistant fell back to generic project setup guidance.",
      actions: {
        initLabel: "Run onboarding first",
        initReason:
          "This CLI still needs a default agent and an external skill library.",
        bootstrapLabel: (tools: string) => `Bootstrap ${tools}`,
        bootstrapReason: (framework: string) =>
          `${framework} depends on missing local tools.`,
        installFrameworkLabel: (framework: string) =>
          `Install ${framework}`,
        installSkillLabel: (skill: string) => `Install skill ${skill}`,
        installSkillReason:
          "This skill matches the current project intent.",
        syncSkillsLabel: (count: number) => `Sync ${count} related skills`,
        syncSkillsReason:
          "A small bundle of skills matches the current project intent.",
        doctorLabel: "Inspect the project first",
        doctorReason:
          "No strong intent match was found, so inspection is the safest first move.",
      },
      intents: {
        spec: {
          label: "Specification and planning",
          summary:
            "This sounds like requirements, planning, or spec-driven work.",
        },
        workflow: {
          label: "Guided implementation workflow",
          summary:
            "This looks like multi-role or process-heavy development work.",
        },
        frontend: {
          label: "Frontend and interface work",
          summary: "This sounds like UI, pages, or interaction design work.",
        },
        document: {
          label: "Document authoring",
          summary:
            "This sounds like structured documentation or Word-style output.",
        },
        pdf: {
          label: "PDF workflow",
          summary: "This sounds like PDF generation or manipulation work.",
        },
        slides: {
          label: "Presentation workflow",
          summary: "This sounds like presentation or deck work.",
        },
        spreadsheet: {
          label: "Spreadsheet workflow",
          summary: "This sounds like spreadsheet or tabular data work.",
        },
        testing: {
          label: "Testing and verification",
          summary:
            "This sounds like validation, QA, or browser-based verification.",
        },
        integration: {
          label: "Integration and protocol work",
          summary: "This sounds like MCP, API, or integration work.",
        },
        art: {
          label: "Visual artifact creation",
          summary: "This sounds like poster, art, or visual asset work.",
        },
      },
    },
    branding: {
      badge: "Workflow cockpit for reusable skills and AI frameworks",
      executionFlow: "Execution flow",
      commandMap: "Command map",
      currentContext: "Current context",
      stageReviewContext: "Review the current project",
      stageChooseAction: "Choose the next action",
      stageRunAction: "Run the next step",
      stageChooseLanguage: "Choose the interface language",
      stageChooseAgent: "Choose the default agent",
      stageConnectFolders: "Connect the skill folders",
      stageSaveConfig: "Save the configuration",
      stageScanProject: "Scan project markers",
      stageLoadConfig: "Load saved configuration",
      stageCheckTools: "Check local tools",
      stageReadProject: "Read the project state",
      stageSummarizeState: "Summarize the current setup",
      stageRecommendNext: "Recommend the next move",
      stageInterpretGoal: "Interpret your goal",
      stageMatchIntent: "Match intent to tooling",
      stageSuggestActions: "Suggest the next actions",
      mapInit: "Initialize or reconfigure the CLI",
      mapDoctor: "Inspect the active project and toolchain",
      mapSync: "Copy reusable skills into this project",
      mapFramework: "Install a supported workflow framework",
      mapAssist: "Interpret a goal and suggest what to run",
    },
  },
  "pt-BR": {
    localeNames: {
      en: "Ingles",
      "pt-BR": "Portugues (Brasil)",
    },
    help: {
      rootDescription:
        "Orquestra skills reutilizaveis e frameworks de desenvolvimento com IA em varios projetos.",
      langOption: "Idioma da interface",
      guide: "Explica o que o Master Skill faz no projeto atual.",
      init:
        "Guia o onboarding: explica a CLI, conecta o agente padrao e salva a biblioteca reutilizavel de skills.",
      doctor: "Inspeciona configuracao local, markers do projeto e pre-requisitos.",
      list: "Lista entidades disponiveis.",
      listSkills: "Lista skills disponiveis na biblioteca externa.",
      add: "Instala um framework ou skill no projeto atual.",
      addSkill: "Copia uma skill reutilizavel para o projeto atual.",
      addFramework:
        "Roda o instalador oficial de um framework suportado no projeto atual.",
      sync: "Sincroniza assets reutilizaveis para o projeto atual.",
      syncSkills:
        "Sincroniza todas as skills reutilizaveis, ou um subconjunto filtrado, para o projeto atual.",
      bootstrap:
        "Instala pre-requisitos do sistema usados pelos frameworks e pela publicacao.",
      assist:
        "Analisa o projeto atual, interpreta seu objetivo e sugere ou executa o proximo passo.",
      optionAgent: "Id do agente do projeto",
      optionForce: "Sobrescreve o destino se ele ja existir",
      optionDryRun: "Mostra os comandos sem executar",
      optionTool: "Ferramenta especifica para instalar",
      optionFramework: "Instala pre-requisitos para um framework",
      optionQuery: "Filtra skills por palavra-chave",
      optionRun: "Executa imediatamente a primeira recomendacao do assistente",
      optionDefaultAgent: "Id do agente padrao",
      optionGlobalDir: "Pasta global de skills do agente selecionado",
      optionSkillsDir: "Pasta externa de skills reutilizaveis",
    },
    prompts: {
      interactiveRequired: (optionHint: string) =>
        `Esta etapa precisa de entrada interativa. Rode em um terminal, ou passe ${optionHint}.`,
      localeQuestion: "Idioma da interface / Interface language",
      agentQuestion: "Qual agente de IA deve ser o padrao?",
      globalSkillsQuestion: (label: string) =>
        `Onde as skills globais de ${label} devem ficar?`,
      skillsLibraryQuestion: "Onde fica sua biblioteca reutilizavel de skills?",
      skillsLibraryPlaceholder: "C:\\Users\\voce\\AI-Skills",
      skillsLibraryRequired: "Informe o caminho da pasta.",
      skillsLibraryNotFound: "Pasta nao encontrada.",
      overwriteConfig: (configPath: string) =>
        `Sobrescrever a configuracao existente em ${configPath}?`,
      frameworkQuestion: "Qual framework voce quer instalar neste projeto?",
      skillQuestion: "Qual skill reutilizavel voce quer instalar neste projeto?",
      skillKeywordQuestion:
        "Qual palavra-chave de skill deve ser sincronizada para este projeto?",
      syncModeQuestion: "Como voce quer sincronizar skills neste projeto?",
      syncModeAll: "Todas as skills reutilizaveis",
      syncModeAllHint:
        "Copia todas as skills da biblioteca externa para este projeto.",
      syncModeFiltered: "Subconjunto filtrado",
      syncModeFilteredHint:
        "Escolha uma palavra-chave e copie apenas as skills que combinam.",
      bootstrapQuestion: "O que o Master Skill deve bootstrapar?",
      bootstrapRecommended: "Ferramentas recomendadas",
      bootstrapRecommendedHint:
        "Instala as ferramentas auxiliares padrao usadas pela CLI.",
      bootstrapFramework: "Ferramentas de um framework",
      bootstrapFrameworkHint:
        "Instala pre-requisitos de BMad, Spec Kit ou Antigravity Kit.",
      continueAfterInit:
        "Configuracao salva. O que voce quer fazer agora neste projeto?",
      continueDoctor: "Inspecionar este projeto",
      continueDoctorHint: "Mostra configuracao, markers e pre-requisitos.",
      continueSync: "Sincronizar skills reutilizaveis",
      continueSyncHint: "Copia suas skills compartilhadas para este projeto.",
      continueFramework: "Instalar um framework",
      continueFrameworkHint:
        "Roda BMad, Spec Kit ou Antigravity Kit para este projeto.",
      continueList: "Ver skills disponiveis",
      continueListHint: "Mostra o que existe na biblioteca externa de skills.",
      continueAssistant: "Perguntar ao assistente o que encaixa aqui",
      continueAssistantHint:
        "Interpreta seu objetivo e sugere o proximo passo.",
      continueFinish: "Encerrar por enquanto",
      continueFinishHint: "Mantem a configuracao salva e sai do onboarding.",
      homeQuestion: "O que voce quer fazer agora?",
      homeStart: "Iniciar onboarding",
      homeReconfigure: "Reconfigurar o Master Skill",
      homeInitHint:
        "Conecta seu agente padrao e a biblioteca externa de skills.",
      homeDoctor: "Inspecionar este projeto",
      homeDoctorHint: "Revisa configuracao, markers e pre-requisitos.",
      homeListSkills: "Ver skills reutilizaveis",
      homeListSkillsHint:
        "Mostra o que esta disponivel na sua biblioteca externa de skills.",
      homeAddSkill: "Instalar uma skill",
      homeAddSkillHint: "Copia uma skill reutilizavel para este projeto.",
      homeSyncSkills: "Sincronizar skills em lote",
      homeSyncSkillsHint:
        "Copia todas as skills ou um subconjunto filtrado para este projeto.",
      homeFramework: "Instalar um framework",
      homeFrameworkHint: "Roda BMad, Spec Kit ou Antigravity Kit aqui.",
      homeBootstrap: "Bootstrapar pre-requisitos",
      homeBootstrapHint: "Instala ferramentas faltantes como uv e gh.",
      homeAssistant: "Perguntar ao assistente",
      homeAssistantHint:
        "Descreva seu objetivo e deixe o Master Skill sugerir o proximo passo.",
      homeExit: "Sair",
      homeExitHint: "Fecha a interface interativa.",
      goalQuestion: "O que voce quer fazer neste projeto?",
      goalPlaceholder:
        "exemplo: quero estruturar o frontend deste projeto",
      goalRequired: "Informe um nome de skill ou uma palavra-chave.",
      assistantRunQuestion:
        "Voce quer que o Master Skill execute uma dessas acoes agora?",
      assistantRunNone: "So guardar o plano",
      assistantRunNoneHint: "Revise a recomendacao e execute depois.",
    },
    titles: {
      onboarding: "Onboarding do Master Skill",
      home: "Master Skill Orchestrator",
      doctor: "Diagnostico",
      guide: "Visao geral do Master Skill",
      guideProject: "O que o Master Skill pode fazer por este projeto",
      guideInit: "O que o Master Skill faz",
      environment: "Ambiente",
      configuration: "Configuracao",
      tooling: "Ferramentas",
      savedConfiguration: "Configuracao salva",
      initSkipped: "Init ignorado",
      skillInstalled: "Skill instalada",
      frameworkInstalled: "Framework instalado",
      syncComplete: "Sincronizacao concluida",
      bootstrap: "Bootstrap",
      bootstrapPlan: "Plano de bootstrap",
      dryRun: "Simulacao",
      assistantPlan: "Plano do assistente",
    },
    guide: {
      intro:
        "Master Skill e uma CLI de orquestracao para projetos de desenvolvimento com IA.",
      whatItDoes: "O que ele faz:",
      bullets: [
        "Conecta um agente padrao e uma biblioteca reutilizavel de skills.",
        "Copia skills reutilizaveis para o projeto atual sob demanda.",
        "Instala frameworks de projeto como BMad, Spec Kit e Antigravity Kit.",
        "Bootstrapa ferramentas faltantes como uv e gh.",
      ],
      snapshotTitle: "Resumo do projeto:",
      cliHome: "Home da CLI",
      configFile: "Arquivo de config",
      project: "Projeto",
      configuredAgent: "Agente padrao configurado",
      detectedAgents: "Markers de agente detectados",
      installedFrameworks: "Frameworks instalados",
      recommendedTarget: "Alvo recomendado do projeto",
      recommendedNext: "Proximo passo recomendado",
      notConfiguredYet: "ainda nao configurado",
      notFound: "nao encontrado",
      none: "nenhum",
      noneDetected: "nenhum detectado",
      needsManualSelection: "precisa de selecao manual",
      nextStepSetup:
        "Rode `init` para conectar um agente padrao e sua biblioteca reutilizavel de skills.",
      nextStepNoMarkers:
        "Abra um projeto com `.agents`, `.claude`, `.agent`, `.cursor` ou passe `--agent` explicitamente.",
      nextStepNoFrameworks:
        "Comece com `sync skills` para skills reutilizaveis, ou use `add framework` se este projeto precisar de um fluxo formal.",
      nextStepDefault:
        "Use `sync skills` para trazer capacidades reutilizaveis, ou `doctor` para inspecionar pre-requisitos antes da proxima instalacao.",
      nonInteractiveHint:
        "Rode `master-skill init` para o onboarding, ou `master-skill doctor` para inspecionar o projeto atual.",
    },
    outputs: {
      operationCancelled: "Operacao cancelada.",
      keptExistingConfig: "A configuracao existente foi mantida.",
      nothingToDo:
        "Nada para fazer. As ferramentas solicitadas ja estao instaladas.",
      onboardingFinished: "Onboarding concluido.",
      initializationComplete: "Inicializacao concluida.",
      doctorFinished: "Diagnostico concluido.",
      seeYouLater: "Ate depois.",
      agent: "Agente",
      skill: "Skill",
      globalSkills: "Skills globais",
      externalSkills: "Skills externas",
      language: "Idioma",
      config: "Config",
      marker: "Marker",
      destination: "Destino",
      framework: "Framework",
      agentTarget: "Alvo do agente",
      command: "Comando",
      installed: "Instaladas",
      skipped: "Ignoradas",
      installedSkills: "Skills instaladas",
      skippedExisting: "Ja existentes ignoradas",
      defaultAgent: "Agente padrao",
      externalFolderExists: "Pasta externa existe",
      exists: "existe",
      willBeCreated: "sera criada",
      ok: "ok",
      missing: "faltando",
      install: "instalar",
      yes: "sim",
      no: "nao",
    },
    errors: {
      configNotFound:
        "Configuracao nao encontrada. Rode `master-skill init` primeiro.",
      unsupportedLocale: (value: string, available: string) =>
        `Idioma nao suportado: ${value}. Disponiveis: ${available}`,
      externalSkillsDirNotFound: (value: string) =>
        `Pasta externa de skills nao encontrada: ${value}`,
      unsupportedAgent: (value: string) => `Agente nao suportado: ${value}`,
      unsupportedFramework: (value: string, available: string) =>
        `Framework nao suportado: ${value}. Disponiveis: ${available}`,
      multipleAgentMarkers: (markers: string) =>
        `Multiplas pastas de agente detectadas: ${markers}. Rode novamente com --agent.`,
      noSkillMatch: (query: string) =>
        `Nenhuma skill combinou com "${query}".`,
      multipleSkillMatches: (query: string, matches: string) =>
        `Multiplas skills combinaram com "${query}": ${matches}. Refine a busca.`,
      destinationExists: (destination: string) =>
        `O destino ja existe: ${destination}. Rode novamente com --force para sobrescrever.`,
      missingAssistantSkillQuery:
        "A acao do assistente nao tem uma skill definida.",
      missingAssistantFrameworkId:
        "A acao do assistente nao tem um framework definido.",
      unknownAssistantAction: (value: string) =>
        `Acao do assistente desconhecida: ${value}`,
    },
    assistant: {
      detectedIntent: "Intencao detectada",
      summary: "Resumo",
      goal: "Objetivo",
      goalMissing: "nao informado",
      suggestedActions: "Acoes sugeridas:",
      why: "Motivo",
      command: "Comando",
      notes: "Observacoes:",
      heuristicNote:
        "Este assistente usa heuristicas. Ele combina o contexto do projeto com o objetivo informado, sem exigir chave de API.",
      noGoalNote:
        "Nenhum objetivo explicito foi informado, entao o assistente usou apenas o estado atual do projeto.",
      noMarkersNote:
        "Nenhum marker de agente foi detectado neste projeto. Se precisar, use `--agent` explicitamente.",
      generalIntent: "Setup geral do projeto",
      fallbackSummary:
        "Nao houve uma intencao forte detectada, entao o assistente caiu para uma orientacao geral de setup.",
      actions: {
        initLabel: "Rodar onboarding primeiro",
        initReason:
          "Esta CLI ainda precisa de um agente padrao e de uma biblioteca externa de skills.",
        bootstrapLabel: (tools: string) => `Bootstrapar ${tools}`,
        bootstrapReason: (framework: string) =>
          `${framework} depende de ferramentas locais que ainda estao faltando.`,
        installFrameworkLabel: (framework: string) =>
          `Instalar ${framework}`,
        installSkillLabel: (skill: string) => `Instalar a skill ${skill}`,
        installSkillReason:
          "Esta skill combina com a intencao atual do projeto.",
        syncSkillsLabel: (count: number) =>
          `Sincronizar ${count} skills relacionadas`,
        syncSkillsReason:
          "Um pequeno conjunto de skills combina com a intencao atual do projeto.",
        doctorLabel: "Inspecionar o projeto primeiro",
        doctorReason:
          "Nao houve uma intencao forte detectada, entao inspecionar o projeto e o primeiro passo mais seguro.",
      },
      intents: {
        spec: {
          label: "Especificacao e planejamento",
          summary:
            "Isso parece trabalho de requisitos, planejamento ou desenvolvimento guiado por especificacao.",
        },
        workflow: {
          label: "Fluxo guiado de implementacao",
          summary:
            "Isso parece desenvolvimento orientado a papeis ou a um processo mais pesado.",
        },
        frontend: {
          label: "Frontend e interface",
          summary: "Isso parece trabalho de UI, paginas ou design de interacao.",
        },
        document: {
          label: "Producao de documentos",
          summary:
            "Isso parece documentacao estruturada ou saida no estilo Word.",
        },
        pdf: {
          label: "Fluxo com PDF",
          summary: "Isso parece geracao ou manipulacao de PDF.",
        },
        slides: {
          label: "Fluxo de apresentacao",
          summary: "Isso parece trabalho com apresentacao ou deck.",
        },
        spreadsheet: {
          label: "Fluxo de planilha",
          summary: "Isso parece trabalho com planilhas ou dados tabulares.",
        },
        testing: {
          label: "Testes e verificacao",
          summary:
            "Isso parece validacao, QA ou verificacao baseada em navegador.",
        },
        integration: {
          label: "Integracao e protocolos",
          summary: "Isso parece trabalho com MCP, API ou integracoes.",
        },
        art: {
          label: "Criacao de artefato visual",
          summary: "Isso parece poster, arte ou asset visual.",
        },
      },
    },
    branding: {
      badge: "Cockpit de workflow para skills reutilizaveis e frameworks de IA",
      executionFlow: "Fluxo de execucao",
      commandMap: "Mapa de comandos",
      currentContext: "Contexto atual",
      stageReviewContext: "Revisar o projeto atual",
      stageChooseAction: "Escolher a proxima acao",
      stageRunAction: "Executar o proximo passo",
      stageChooseLanguage: "Escolher o idioma da interface",
      stageChooseAgent: "Escolher o agente padrao",
      stageConnectFolders: "Conectar as pastas de skills",
      stageSaveConfig: "Salvar a configuracao",
      stageScanProject: "Escanear markers do projeto",
      stageLoadConfig: "Carregar a configuracao salva",
      stageCheckTools: "Checar as ferramentas locais",
      stageReadProject: "Ler o estado do projeto",
      stageSummarizeState: "Resumir o setup atual",
      stageRecommendNext: "Recomendar o proximo movimento",
      stageInterpretGoal: "Interpretar seu objetivo",
      stageMatchIntent: "Associar a intencao as ferramentas",
      stageSuggestActions: "Sugerir as proximas acoes",
      mapInit: "Inicializar ou reconfigurar a CLI",
      mapDoctor: "Inspecionar o projeto ativo e a toolchain",
      mapSync: "Copiar skills reutilizaveis para este projeto",
      mapFramework: "Instalar um framework de workflow suportado",
      mapAssist: "Interpretar um objetivo e sugerir o que rodar",
    },
  },
} as const;

export type I18nMessages = (typeof MESSAGES)[SupportedLocale];

export function getMessages(locale: SupportedLocale): I18nMessages {
  return MESSAGES[locale];
}
