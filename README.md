# Master Skill Orchestrator

CLI para automatizar o fluxo de skills e frameworks em agentes como Codex, Claude Code e Antigravity.

## Desenvolvimento local

```bash
npm install
npm run build
node dist/cli.js doctor
```

## Fluxo básico

```bash
npx tsx src/cli.ts init
npx tsx src/cli.ts list skills
npx tsx src/cli.ts add skill brainstorm
npx tsx src/cli.ts sync skills --query brainstorm --query docx
npx tsx src/cli.ts bootstrap --framework spec-kit
npx tsx src/cli.ts add framework bmad
```

## Comandos

- `init`: salva agente padrão, pasta global de skills e pasta externa de skills
- `doctor`: inspeciona configuração e markers do projeto
- `bootstrap`: instala pré-requisitos como `uv` e `gh` quando possível
- `list skills`: lista skills disponíveis na pasta externa
- `add skill <query>`: copia uma skill para o projeto atual
- `sync skills`: copia várias skills em lote para o projeto atual
- `add framework <framework>`: executa o instalador oficial do framework

## Frameworks suportados

- `bmad`
- `spec-kit`
- `antigravity-kit`

## Publicação npm

```bash
npm login
npm run release:check
npm publish
```

## Uso depois de publicado

```bash
npx master-skill-orchestrator init
npx master-skill-orchestrator doctor
npx master-skill-orchestrator sync skills
```
