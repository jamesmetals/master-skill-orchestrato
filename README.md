# Master Skill Orchestrator

CLI para automatizar o fluxo de skills e frameworks em agentes como Codex, Claude Code / Claw e OpenCode / Antigravity.

Agora com interface de terminal visual: logo ASCII, fluxo de execucao por comando, mapa rapido de comandos e paines de contexto.

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

## Como funciona na pratica

Depois do `init`, a CLI salva 3 decisoes no arquivo global de config:

- agente padrao
- pasta global de skills desse agente
- biblioteca reutilizavel de skills

Exemplo de resultado salvo:

```text
Agent: Codex
Global skills: C:\Users\james\.codex\skills
External skills: C:\Users\james\.codex\skills
Config: C:\Users\james\.agent-orchestrator\config.json
```

Na pratica, isso significa:

- `global skills`: onde o agente escolhido ja procura ou mantem skills globais
- `external skills`: pasta-fonte usada pelo orquestrador para copiar skills para outros projetos

Com isso pronto, o fluxo do dia a dia fica assim:

```bash
npx master-skill-orchestrator doctor
npx master-skill-orchestrator list skills
npx master-skill-orchestrator add skill aiox-po
npx master-skill-orchestrator sync skills
npx master-skill-orchestrator add framework bmad
```

## Exemplo com OpenCode

Hoje o runtime `OpenCode` usa a estrutura de projeto `.agent`, entao ele e tratado pelo orquestrador como `Antigravity`.

Regra pratica:

- se o projeto estiver rodando no `OpenCode`, use `Antigravity`
- nas versoes mais novas do codigo, `OpenCode` ja aparece como alias de `Antigravity`

Se o seu agente padrao foi salvo como `Codex`, mas o projeto atual esta no `OpenCode`, use `--agent antigravity` nos comandos desse projeto:

```bash
npx master-skill-orchestrator doctor
npx master-skill-orchestrator add skill aiox-po --agent antigravity
npx master-skill-orchestrator sync skills --agent antigravity
npx master-skill-orchestrator add framework antigravity-kit --agent antigravity
```

Se quiser evitar `--agent` nesse caso, rode `init` de novo e escolha `Antigravity` como agente padrao.

## Idiomas

- Suporte atual: `pt-BR` e `en`
- O `init` salva o idioma da interface no arquivo de configuracao global
- Tambem e possivel sobrescrever por execucao com `--lang`

```bash
npx master-skill-orchestrator --lang pt-BR
npx master-skill-orchestrator guide --lang en
npx master-skill-orchestrator assist "quero estruturar esse CRM" --lang pt-BR
npx master-skill-orchestrator init --lang pt-BR
```

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
