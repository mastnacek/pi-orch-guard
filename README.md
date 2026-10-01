# pi-orch-guard

**An expensive model that never reads your code.**

The premise: a frontier model is roughly fifty times the price of a cheap one, so
its context must be spent on *thinking*, not on file bodies. This plugin makes
that structural — a `tool_call` hook, not a promise in a prompt:

| Call | While guarded |
|---|---|
| `edit`, `write`, `apply_patch`, `bash` with a mutating verb | **always blocked** — a guarded orchestrator decides, a worker edits |
| `read`, `grep`, `read_symbol`, `read_enclosing`, `cat` via `bash` | **blocked unless approved** by a modal that shows the target *and your stated reason* |
| `symbol_search`, `module_report`, `project_report`, `lsp_diagnostics`, `lsp_symbols`, `find`, `ls` | **free** — structure, not content, so the structural tier costs you nothing |

```bash
pi install git:github.com/mastnacek/pi-orch-guard
pi -e git:github.com/mastnacek/pi-orch-guard    # try without installing
```

## Use

```
/orch-guard on              # this project (.pi/pi-orch-guard.json)
/orch-guard on --global     # every project (~/.pi/agent/pi-orch-guard.json)
/orch-guard status
/orch-guard lang cs
```

Then switch the session to your frontier model (`/model`) and let the
`orchestrate` skill load. Everything ships in the package:

- **`skills/orchestrate/SKILL.md`** — the tier ladder: structure first (free),
  then a cheap child's brief, then `request_read` with a reason.
- **`agents/notes-extractor.md`** — the cheap child. Reads one symbol or region,
  returns ≤200 words: purpose, inputs, guards, side effects, throws.

## The modal

The dialog deliberately lives in `request_read`, not in the hook. A hook sees the
tool name and the arguments; it cannot know *why*. So the model states the reason
as an argument, and you judge the reason next to the exact target:

```
read chce číst
  src/agents/init.lss

Uvedený důvod:
  need the exact On Error path before I pin the guard rule into the dispatch

  ▸ Odmítnout — pracovat dál z briefů (výchozí)
    Povolit toto čtení
    Povolit tento file na celou relaci
```

Deny is the highlighted default. A timeout is a deny. A headless session (no UI
to ask) is a deny — fail-open is exactly the bug this plugin exists to prevent.
"Povolit na celou relaci" whitelists the path, so later `read` calls on it stop
asking.

## What this is not

It is **not a sandbox**. `bash` is inspected by two regexes, not a shell parser:
`>` redirection and `$(…)` still get through. The guard buys *visibility*, and
visibility is what makes an expensive model's context auditable. If you need a
containment boundary, that is a different tool.

## Direct-API providers

The orchestrator is meant to run on a first-party model. `auth.json` ships with
no `openai`/`anthropic` entry, so register them once before pointing the agent at
them:

```bash
# then set model: openai/<frontier id> in your session / agent config
pi model add openai --api-key sk-...
```

`agents/notes-extractor.md` deliberately ships on `openrouter-soukr/…-mini` so
the cheap half works before any key exists.

## Development

```bash
npm test     # tsc -p tsconfig.test.json && node --test dist/test/*.test.js
npm run check
```

`src/shared/classify.ts` is the whole policy in one pure function — that is why
it carries the tests.