# AGENTS.md

This project uses a long-running agent model.

Agents must behave like stateless workers:

* No memory between sessions
* All durable state lives in repository files
* Each session reconstructs context from files

---

# Core Principle

> Never rely on chat history.
> Always rely on project state.

---

# Agent Roles

## Initializer

The initializer bootstraps the repository state.

Responsibilities:

* Create `feature_list.json`
* Create `progress.md`
* Create `init.sh`
* Initialize git
* Do not implement business logic

## Planning Agent

The Planning Agent handles new requirements before implementation begins.

Responsibilities:

* Read `SPEC.md`
* Read `feature_list.json`
* Update `SPEC.md` by appending the new requirement clearly
* Append new features to `feature_list.json`
* Keep all existing requirements and feature entries unchanged unless explicitly instructed

Strict rules:

* Do not modify existing feature IDs
* Do not reset existing fields such as `passes`, `status`, `attempts`, or `last_error`
* Do not reorder existing features
* Only append new feature entries
* Preserve all existing data and state

## Coding Agent

The Coding Agent implements exactly one feature.

Responsibilities:

* Read `AGENTS.md`
* Read `progress.md`
* Read `feature_list.json`
* Check recent work with `git log --oneline -20`
* Run `./init.sh` before and after changes
* Implement only the requested feature
* Keep the system runnable
* Update `progress.md`
* Update only the current feature in `feature_list.json`
* Preserve unknown fields and feature ordering

## Evaluator Agent

The Evaluator Agent verifies whether one feature is truly complete.

Responsibilities:

* Read `AGENTS.md`
* Read `feature_list.json`
* Read `progress.md`
* Run `./init.sh`
* Inspect the implementation related to the target feature
* Run relevant tests or harness checks if available
* Verify the feature against its description and acceptance criteria

The Evaluator Agent must output exactly one of:

```text
EVAL_PASS: Fxxx
EVAL_FAIL: Fxxx: <reason>
```

---

# Startup Protocol

Every Coding Agent and Evaluator Agent run must:

1. Read `progress.md`
2. Read `feature_list.json`
3. Check recent work:

   ```bash
   git log --oneline -20
   ```

4. Run:

   ```bash
   ./init.sh
   ```

---

# State Files

## feature_list.json

`feature_list.json` defines the full feature scope and state.

Each feature may include:

* `id` (string, required)
* `description` (string, required)
* `passes` (boolean, required)
* `status`: one of `["todo", "in_progress", "done", "blocked"]`
* `attempts` (integer)
* `last_error` (string)
* Other metadata fields such as `priority`

Rules:

* `passes=true` means the feature is complete
* `passes=false` means the feature is not complete
* Agents must not delete fields
* Agents must preserve unknown fields

## progress.md

`progress.md` must include:

* Current system status
* Last completed feature
* Next feature
* Known issues

---

# External Behavior Verification

When implementation depends on behavior outside this repository's own code, agents must verify that behavior before relying on it.

Examples include:

* CLI tools and their flags, stdin/stdout/stderr behavior, exit codes, signals, working directory, environment variables, and timeout behavior
* Third-party APIs, webhooks, SDKs, protocol payloads, callback formats, and version-specific fields
* Runtime and platform behavior such as process management, filesystem semantics, shell behavior, permissions, networking, deployment platforms, and operating-system differences
* Model or tool output schemas, streamed event formats, JSONL event fields, and approval or permission protocols

Rules:

* Do not infer unknown external behavior from intuition or local mocks
* Prefer primary sources: official help output, official documentation, real minimal commands, real sample payloads, or captured logs from the target tool
* Treat mocks and fake children as tests of this repository's state machine only; they do not prove the external tool or platform behaves that way
* When changing process semantics such as argv, stdio, cwd, env, timeout, signal handling, or shell mode, verify the real command behavior or document why direct verification is not possible
* When depending on structured output fields, verify with real-shaped output from the source and add regression tests using those captured shapes
* If behavior remains uncertain, state the uncertainty explicitly in `SPEC.md`, `progress.md`, or implementation notes, and choose the safer default

---

# Work Rules

* Only one feature per Coding Agent run
* Always keep the system runnable
* Always run `./init.sh` before declaring success
* Keep Telegram secrets out of git
* Keep camera media out of git and logs
* Do not add hidden or continuous monitoring without explicit feature planning

---

# Goal

Make the system:

* Recoverable at any time
* Runnable at any time
* Continuously improvable
* Safe for trusted personal home-monitoring use
