# Master Skill Orchestrator

CLI para automatizar o fluxo de skills e frameworks em agentes como Codex, Claude Code e Antigravity.

## Desenvolvimento local

```bash
npm install
npm run build
node dist/cli.js
node dist/cli.js doctor
node dist/cli.js assist "I want to build a frontend landing page"
```

## Fluxo basico

```bash
npx tsx src/cli.ts
npx tsx src/cli.ts assist "I need specs for a new feature"
npx tsx src/cli.ts guide
npx tsx src/cli.ts init
npx tsx src/cli.ts list skills
npx tsx src/cli.ts add skill brainstorm
npx tsx src/cli.ts sync skills --query brainstorm --query docx
npx tsx src/cli.ts bootstrap --framework spec-kit
npx tsx src/cli.ts add framework bmad
```

## Comandos

- `master-skill` sem argumentos: abre a home interativa e explica o que a CLI faz no projeto atual
- `assist [goal]`: interpreta sua intencao e sugere o proximo passo com base no projeto atual
- `guide`: mostra um resumo contextual do projeto atual e o proximo passo recomendado
- `init`: salva agente padrao, pasta global de skills e pasta externa de skills
- `doctor`: inspeciona configuracao e markers do projeto
- `bootstrap`: instala pre-requisitos como `uv` e `gh` quando possivel
- `list skills`: lista skills disponiveis na pasta externa
- `add skill <query>`: copia uma skill para o projeto atual
- `sync skills`: copia varias skills em lote para o projeto atual
- `add framework <framework>`: executa o instalador oficial do framework

## Frameworks suportados

- `bmad`
- `spec-kit`
- `antigravity-kit`

## Publicacao npm

```bash
npm login
npm run release:check
npm publish
```

## Uso depois de publicado

```bash
npx master-skill-orchestrator
npx master-skill-orchestrator assist "I need specs for a new feature"
npx master-skill-orchestrator guide
npx master-skill-orchestrator init
npx master-skill-orchestrator doctor
npx master-skill-orchestrator sync skills
```
