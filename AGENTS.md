# WeZJUers: agent rules

WeZJUers (formerly "Listings") is a free, bilingual student platform for Zhejiang University, starting from second-hand trading. Independent student project, not official. The name is under review and may change. Users are students on campus in China, mostly on phones. Run: `cd app && DEMO_MODE=1 npm start` then http://localhost:4400 (Node 22, local PostgreSQL). Specs are in `docs/`.

## Folder rule (all projects)
- Built mainly by Claude: `~/Documents/claude-ai/<project>` (today the real path is `~/Documents/Artificial Intelligence/claude-ai/<project>`; this project is at `zju-projects/we-zjuers`).
- Built mainly by another AI, or several AIs with similar impact: `~/Documents/maestri/<project>`.
- Never move a project without asking Gabriel.

## Second brain (Obsidian)
Notes are in `/Users/gabrielnogueira/Documents/Obsidian Vault/projects/we-zjuers/`.
- Always start from `index.md` (under one page). If you need more, search that folder with `rg`, then follow `[[wikilinks]]` at most 2 steps.
- Open at most 5 vault notes per task; ask Gabriel before opening more.
- Never read the rest of the vault or personal notes. `task-log.md` is read only at the weekly review.
- `product.md`: what it does, who for, scope, International College proposal. `architecture.md`: stack, folders, data model, run and deploy. `feedback.md`: student feedback, summarized and anonymous. `decisions.md`: one line per decision (date | decision | reason).
- Never store names, student IDs, emails or other personal data in the vault or the repo.
- After each feature: add a line to `decisions.md` if a decision was made, and update the Status line in `index.md`.
- When you create or update a note, link it from `index.md` and to related notes with `[[wikilinks]]`. Plain English, no em dashes. Touch only the WeZJUers folder in the vault.

## Project rules (every task)
- The product name lives in one place (a config or constants file). Never hardcode it elsewhere, because it may change. (Not true yet: see the migration plan in the vault `decisions.md`.)
- Do not add dependencies that are blocked or unreliable in mainland China (Google Fonts, Maps, reCAPTCHA, Firebase, many CDNs). If one is needed, propose an alternative that works there.
- Follow Unsplash's API guidelines whenever photos are used: hotlink, credit the photographer and Unsplash with links and utm params, trigger the download endpoint (see `app/lib/unsplash.mjs`).
- Keys only in `app/.env` (gitignored). Never commit secrets.
- Never use real student data in code, seeds, tests or screenshots. Use made-up data.
- Mobile first: check every UI change at phone width (390px) in the portal, and at desktop width before landing a feature.
- Anything touching user accounts, personal data or security is a complex task, however small.

## Team: "WeZJUers Team" band
Recruit only from these presets, on demand, and dismiss idle agents. Maestro is the only Sonnet. No other Claude agents except Haiku, and Opus under the budget rules. Never use `deepseek`, `deepseek-local` or `ollama` as agents: they are chat prompts.

| Preset | Use for |
|---|---|
| Sonnet | Maestro: planning, splitting tasks, complex code, taking over stuck tasks |
| Opus | Architecture, data model, security, hard bugs. One focused task, then dismiss. Never routine coding |
| Haiku | Backup for vault updates and review |
| Codex Luna | Reviewer (GPT-6 Luna, free plan, small limits) |
| OpenCode Flash (`deepseek/deepseek-flash`) | Default builder for simple and medium tasks, backup reviewer, Vault Keeper |
| OpenCode Pro (`deepseek/deepseek-v4-pro`) | Second opinion only, when Flash fails and Claude budget is behind pace |
| OpenCode Free (`opencode/deepseek-v4.1-flash-free`) | Background tasks with no time pressure |

Standing band: Maestro, one OpenCode Flash builder, the Codex reviewer. After recruiting an OpenCode agent, confirm its status bar names the intended model (presets use `--standalone`; without it the model is silently ignored).

## Tiers, time caps and handover
Starting values; the current values live in the "WeZJUers Maestro" role after the weekly review.

| Tier | Examples | Start with | Time cap |
|---|---|---|---|
| Simple | copy text, styling, listing card tweaks, small UI fixes, tests for existing code | OpenCode Flash | 8 min |
| Medium | a contained feature (search filters, listing form, image upload) | OpenCode Flash | 20 min |
| Complex | auth, messaging, data model, payments, deployment, security | Maestro or Opus | check in with Gabriel at 45 min |

- Note the start time with `date` when handing out a task; schedule a check-in for the cap with `maestri routine`.
- At the cap: almost done (final checks or commit) allows one extension of half the cap; otherwise hand over: OpenCode Free → OpenCode Flash → Maestro → Opus (budget rules).
- A handover keeps the work: same branch, plus a short summary of done, left, failed. The next agent continues.
- Failing review twice escalates one level. A simple task touching many files is re-tiered as medium.
- Independent tasks run in parallel, each builder on its own floor. Same-file tasks run one after another.
- Review: Codex. If its limit is hit, OpenCode Flash, then Haiku.

## Light workflow (simple tasks)
1. Work on the current branch, no floor.
2. Make the change, run a quick check, look at it in the portal.
3. Commit with a Conventional Commit.
4. No reviewer and no vault update, unless a decision was made. Still log the task.

## Feature workflow (medium and complex tasks)
1. Create a floor (new branch) for the feature.
2. Build it, keeping each session focused.
3. Run build/tests, check at phone and desktop width in the portal, fix failures.
4. Reviewer checks the diff, including security and privacy for anything touching user data.
5. The builder commits as its last step with Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `style:`, `chore:`), small steps, never secrets.
6. Update the vault and log the task.
7. `maestri notify` Gabriel and wait.
8. Land the floor or open a PR only when Gabriel says so. Never push, force-push, delete branches, deploy or rewrite history without his explicit OK. This project shares a git repo with unrelated work and a MetricLab remote: stage only files under `zju-projects/we-zjuers`.

## Task log and self-tuning
After every task append one line to `task-log.md` in the vault folder: `date | tier | task type | agents in order | runtime | outcome` (on time / extended / handed over / failed review). Weekly review (Sunday evening, Beijing time): `python3 task-log-stats.py` in the vault folder; adjust a tier only with at least 5 tasks that week. Lower a cap when 80% of tasks finish under half the cap (new cap about 1.5x median). Raise by 25% when 30% were extended or handed over and the handed-over ones were nearly done. Max change 50% per week; limits simple 3 to 15 min, medium 10 to 40 min. Cap changes: Maestro applies them alone (update the role, add a line to `decisions.md`). Changing which agent starts a task type needs Gabriel's OK.

## Claude budget
The weekly Claude limit is shared with university work and other workspaces. Keep 15-20% for Friday. Before recruiting Opus or starting a large Claude task, ask Gabriel how much of the week is left. Ahead of pace: Opus and Sonnet freely when best. Behind pace: builders use DeepSeek through OpenCode, Sonnet only coordinates, no Opus without OK. From Thursday evening or at 25% left: Claude plans and coordinates only. Never touch the 15% reserve.

## Reporting
End every reply where work was done with one line: `Agents: <agent> (<model for OpenCode/Codex>) ~NN% (what) · ...`, rounded to 10%, using the model actually used. Mark handovers with `→`. Hard tasks and features add `- Runtime: 11m 32s - Paid: $0.04 - Claude est.: ~$1.20` (Paid = real DeepSeek cost, Claude est. = approximate API-equivalent). Record those lines in `agent-log.md`; if non-Claude agents do most of the work, tell Gabriel so he can decide on the folder rule.
