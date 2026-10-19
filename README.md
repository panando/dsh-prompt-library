<div align="center">

[🇨🇳 中文](./README.zh.md) | 🌐 **English**

</div>

# dsh-prompt-library (@panando fork)

> **This is a fork of [`@sunjuntao/dsh-prompt-library`](https://www.npmjs.com/package/@sunjuntao/dsh-prompt-library)** (original author master1Sun, MIT).
>
> What this fork changes:
> 1. **The library entry moved from an injected button above the host's sidebar Settings button into a card at the bottom of Settings → Library settings**, which opens a standalone panel. The injected button (it appeared both above the settings navigation and in the bottom-left menu) is gone.
> 2. Fixed **invisible SVG icons inside the dialog surface** (they were collapsed to 0 width by `scrollbar-gutter`).
> 3. **Persona injection is now opt-in and off by default**: new sessions no longer get a "prompt librarian" persona template pushed into them. Turn it on under **Settings → Library settings → Chat interaction → "Inject persona into sessions"**. See [Persona](#persona-ai-read-only-reference) below.
>
> See [FORK.md](./FORK.md) for details, source provenance and build steps. Install the upstream package for the original behaviour.

DSH (DeepSeek Harness) prompt library plugin: provides **prompt management**, **AI polish** and **persona customization** in the chat bar, helping you accumulate, reuse and continuously improve prompts.

## Key Features

### Prompt Library

- Manage frequently-used prompts (title + body + tags), with search, sorting, tag grouping and usage-count statistics
- Entry 1: the "Library" card at the bottom of **Settings → Library settings** opens a standalone panel (850×800, maximizable, closes with ✕ / Esc) whose tabs switch between Data Management, Import/Export, Tags and Recycle Bin
- Entry 2: the prompt-library button beside the chat input opens recent/frequent prompts with one click
- **Insert**: appends to the existing content in the input box
- **Overwrite**: directly replaces the whole draft with this prompt
- **Insert & Send**: fills in template variables and sends with one click (uses the variable dialog when it contains `{{}}`); outside `#` scenarios it is only available when the draft is empty, avoiding accidentally carrying existing content; when triggered by `#`, the trigger word is filtered out while the preceding text is kept and sent along
- Type `#` to quickly trigger selection with real-time filtering
- The bottom shows the total number of tags and prompts in real time

### Generate Skills

- Select prompts in "Library menu → Skill Manager" (skill import dialog) to generate DSH Skills in batch
- AI generates an English skill name and description from the prompt content; the skill is written to `~/.dsh/skills/<name>/SKILL.md`, and can be triggered by typing `/skill-name` in the chat box, or auto-matched by the model from the description
- A link between the prompt and the skill is created automatically; regenerating the same prompt **overwrites the original skill directory** instead of adding endlessly
- If the body contains `{{variables}}`, the "placeholder auto-fill" capability is marked at generation time — when using the skill, AI infers and fills them automatically from the current semantic context, no manual input needed

### AI Polish

- The "AI Polish" button in the chat bar optimizes text with one click, then replaces it back into the input box with one click
- The polishing process follows the constraints of the persona settings

### Persona (AI read-only reference)

Persona bodies live in the database (`prompts.db`: default persona in the meta table, custom ones in the personas table), constraining every AI call and the session they apply to, forming a stable assistant persona. A complete default template is seeded automatically when missing; its content is **manually maintained by the user**, and AI only reads it without modifying it on its own. Multiple personas (SOUL) can be created and bound per workspace/project — new sessions opened under a matched path automatically adopt that persona.

**Session injection is off by default**: the persona is no longer pushed into new sessions' system prompt automatically. Turn on **Settings → Library settings → Chat interaction → "Inject persona into sessions"**, and injection then resolves in this order: session binding → workspace/project binding → default persona. While it is off, the persona still constrains "AI Polish", it just never appears in a session. Changes apply from the next message, no restart needed.


| Storage | Meaning | Purpose                                   |
| ------- | ------- | ----------------------------------------- |
| SOUL    | Persona | Identity, tone/personality, working rules |

- When the input is empty, matching prompts are recommended above the input based on recent chat context; click to insert into the draft
- The persona is the user's explicit configuration (including the default template), and AI follows its personality, tone and working rules accordingly

### Settings

Under DSH Settings → Library settings, adjust: AI model selection, panel size, chat-bar button visibility/icon-only, `#` triggering, context recommendations, **persona injection into sessions (off by default)**, add-prompt-from-selection, maximum stored prompts, etc. Changes take effect immediately.

## Data Storage

The library uses **SQLite** (`node:sqlite`); all other configs and logs are stored under `~/.dsh/prompt-library/`:

```
~/.dsh/prompt-library/
├── db/prompts.db      # prompt library, personas & bindings (SQLite)
├── settings.json      # plugin settings (prompt-library namespace)
├── log/
│   └── ai-YYYY-MM-DD.log   # AI diagnostic logs (per-day files)
└── character/         # (legacy, migration read-only; personas now live in the database)
```

## Installation

```bash
dsh plugin --profile web add @panando/dsh-prompt-library
```

## Usage

Start `dsh web`, open **Settings → Library settings** and click the "Library" card at the bottom of the page to open the panel; or use the prompt-library button beside the chat input, type `#` for the quick picker, and click "AI Polish" to polish your input with one click.

## Development / Build

```bash
npm install
npm run build   # build lib/client.js and lib/index.js
npm run check   # node --check both bundles
npm test        # jsdom: apply() smoke test + real settings-page render (23 assertions)

# Link into the desktop profile for local development; refresh/restart DSH to apply
../scripts/link-plugin.sh dsh-prompt-library
# Revert: ../scripts/link-plugin.sh dsh-prompt-library --unlink
```

## Author

Original author **master1Sun** (MIT): [github.com/master1Sun/dsh-prompt-library](https://github.com/master1Sun/dsh-prompt-library)

This fork is maintained by **panando**: the entry-point placement, the dialog icon rendering, and making persona session injection optional (off by default) were changed; prompt management / AI polish / the persona library are kept as upstream.
