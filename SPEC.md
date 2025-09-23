# Agent‑First D&D‑Style Narrative RPG — Full Spec

> An LLM‑directed, tool‑assisted narrative RPG that blends **determinism when it matters** (rules, dice, resources) with **creativity everywhere else** (storytelling, images, banter). Optimized for <5s scene art via async generation.

---

## 1) Vision & Design Pillars

- **Agent‑first**: A DM Agent orchestrates scenes, calls tools for rules and world‑state, and narrates outcomes. NPC Agents handle dialogue and tactics.
- **Determinism where it matters**: All mechanical outcomes (skill checks, combat resolution, damage, resource costs) are computed by tools, not by the LLM.
- **Creative elasticity**: The LLM freely narrates descriptions, hints, and character voices; constrained by lore & world facts.
- **<5s scene art**: Every scene can request an image. A fast preview returns in ≤5s; an optional HQ re‑render arrives later.
- **Observable & reproducible**: Seeded RNG, traceable tool calls, and serialized world state enable replay and audit.

---

## 2) Player Experience

### 2.1 Core Loop

1. **Present Scene** → short narrative + goals + optional choices.
2. **Player Input** → choose option or free‑text.
3. **Adjudication** → DM Agent plans; calls tools for checks/resolution.
4. **Outcome + Rewards** → narration + state updates.
5. **Async Art** → fast image appears; HQ version replaces when ready.

### 2.2 First‑Session Flow (example timing)

- T+0.0s: Text scene loads instantly with placeholder art (blur/silhouette).
- T+0.4–1.0s: Streaming narration finishes.
- T+2.0–4.5s: **Fast image** resolves (≤512 px, 20–30 step inference or flash model).
- T+5–20s: **HQ image** (optional) swaps in; not blocking input.

### 2.3 UX Components

- **Narration stream** (token streaming)
- **Choice chips** (suggested actions) + **free‑text** box
- **Action log** (dice rolls, DCs, damage)
- **Scene Card** (image, title, tags)
- **Character sheet** (HP, resources, skills, inventory)
- **Minimap of narrative arcs** (chapter, scene)

---

## 3) Game Systems

### 3.1 Mechanics & Determinism Matrix

| System | Deterministic via Tool | Creative via LLM |
|---|---|---|
| Ability checks (DCs, advantage) | ✓ resolve_check() | ✧ describe attempt & consequences |
| Combat (initiative, to‑hit, damage, status) | ✓ combat_resolve_turn() | ✧ narrate tactics & flavor |
| Inventory & economy | ✓ inventory_update(), shop_txn() | ✧ item lore & flavor text |
| Travel/time | ✓ time_advance() | ✧ scenery, ambient events |
| Quests & flags | ✓ quest_update() | ✧ exposition, foreshadowing |

### 3.2 Character Model (example)

- **Abilities**: STR/DEX/CON/INT/WIS/CHA (0–20)
- **Proficiencies**: skill list w/ proficiency bonus scaling by level
- **HP/Resources**: HP, spell slots, stamina, gold
- **Tags**: background, faction, traits for narrative hooks

### 3.3 Checks

- DC scale: 5 (Trivial), 10 (Easy), 12 (Routine), 15 (Moderate), 18 (Hard), 20 (Very Hard), 25 (Extreme)
- RNG: d20 + modifier + proficiency (if proficient) + situational bonuses
- Advantage/Disadvantage handled deterministically by tool

---

## 4) Agent Architecture

### 4.1 Agents

- **DM Agent** (primary orchestrator)
  - Inputs: player intent, scene state, lorebook, quest flags
  - Plans: decide if action triggers **tool** vs **free narration**
  - Calls: rules, world‑state, RNG, safety, image gen
  - Outputs: narration, structured updates, next choices
- **NPC Agents** (optional per key character)
  - Persona‑constrained dialogue; consults world facts; cannot change rules
- **Critic/Guard Agent** (lightweight)
  - Validates DM output: budget, safety, contradictions; can request revise

### 4.2 Orchestration

- **Planner**: builds a tool‑call plan from user input
- **Tool Router**: function‑calling → executes tools → returns JSON
- **Reducer**: merges results → final DM narration → UI model
- **Trace**: capture prompts, seeds, tool I/O (for replay)

---

## 5) Tool APIs (Deterministic)
>
> All tools must be **pure** (or idempotent) and **seeded** where randomness is used. Return structured JSON.

### 5.1 Randomness

```
POST /rng/roll
{ "seed": "<uuid|int>", "dice": "2d6+1" }
→ { "total": 9, "rolls": [3,5], "modifier": 1 }
```

### 5.2 Rules: Checks

```
POST /rules/check
{ "seed": 123, "actor": "pc:1", "ability": "DEX", "proficient": true,
  "dc": 15, "advantage": false, "context": "pick_lock" }
→ { "result": "success|fail", "roll": 17, "total": 19, "dc": 15 }
```

### 5.3 Combat

```
POST /combat/resolveTurn
{ "seed": 42, "attacker": "pc:1", "target": "npc:banditA",
  "attack": { "type": "melee", "toHitMod": 5, "damage": "1d8+3" },
  "targetAC": 14 }
→ { "hit": true, "toHitRoll": 16, "total": 21,
     "damage": { "rolls": [6], "modifier": 3, "total": 9 },
     "status": [] }
```

### 5.4 Inventory/Economy

```
POST /inventory/update
{ "actor": "pc:1", "delta": { "gold": -5, "itemsAdd": ["Lockpick"] } }
→ { "ok": true, "newGold": 27, "items": [ ... ] }
```

### 5.5 World State & Quests

```
POST /world/update
{ "sceneId": "market_day", "flags": { "guardAlerted": true } }
→ { "ok": true, "scene": { ... } }
```

### 5.6 Safety/Content Filtering

```
POST /safety/check
{ "text": "raw LLM draft" }
→ { "ok": true, "redactions": [] }
```

### 5.7 Image Generation (Async, Dual‑Path)

```
POST /images/request
{ "sceneId": "crypt_entrance", "prompt": "moody crypt gate ...",
  "mode": "preview", "seed": 2025, "size": "512x512" }
→ { "jobId": "img_abc", "etaSec": 3 }

GET /images/result?jobId=img_abc
→ { "status": "ready", "url": ".../preview.png" }

POST /images/rerender
{ "jobId": "img_abc", "mode": "hq", "size": "1024x1024" }
→ { "jobId": "img_hq_abc", "etaSec": 12 }
```

---

## 6) LLM Prompting & Controls

### 6.1 System Prompt (DM Agent)

- **Role**: You are the impartial DM. Use *tools* for all mechanics; do not invent numbers. Narrate tersely (≤120 words per beat) with vivid but efficient prose. Offer 2–4 concise choices plus accept free‑text. Maintain world facts; consult lorebook. Avoid content violations.
- **Style**: present‑tense, second person, tangible sensory details.
- **Constraints**: Never resolve checks yourself; always call rules/check. Never adjust HP or gold directly; call tools.

### 6.2 Planner Prompt (function‑calling)

- Decide: (a) pure narration, (b) call one or more tools, (c) both.
- Return JSON plan with ordered steps. Include **seed** for any RNG.

### 6.3 Lorebook & Canonical Facts

- YAML/JSON store indexed by entity and scene. DM must cite keys when describing.

```
entities:
  city.arclight:
    tags: [coastal, fog]
    canon: ["lighthouse pulses every 12 sec", "guards wear teal sashes"]
```

### 6.4 Output Contract (per turn)

```
{
  "narration": "...",
  "action_log": [{ "type": "check", "ability": "DEX", "roll": 17, "total": 19, "dc": 15 }],
  "choices": ["Sneak past", "Distract the guard", "Turn back"],
  "state_updates": { "flags": {"guardAlerted": true} },
  "image_request": { "prompt": "moody alley...", "seed": 774, "mode": "preview" }
}
```

---

## 7) Data Model

### 7.1 Session

```
Session { id, playerId, startedAt, seed, difficulty, settings }
```

### 7.2 World/Scene

```
Scene { id, chapter, title, synopsis, flags, npcs[], exits[], imageRefs[] }
```

### 7.3 Character

```
Character { id, name, level, abilities{}, profs[], hp, resources{}, inventory[] }
```

### 7.4 Trace (for replay)

```
Trace { turn, promptHash, toolCalls[], rngSeeds[], outputs[] }
```

---

## 8) State Machine

**States**: `Idle → Plan → ToolExec → Reduce → Safety → Render → AwaitInput`

- Errors route to `Recover` with fallback narration and explicit logs.
- Timeouts: tool (2s), image preview (5s soft), HQ (no block).

---

## 9) Performance & Latency Budget (<5s Preview)

| Component | Target |
|---|---|
| Planner + DM draft | 300–800 ms (streaming) |
| Rules tool calls (parallel) | 80–200 ms |
| World/DB ops | 20–80 ms |
| Safety pass | 50–120 ms |
| Image **preview** request → ready | 2.5–4.5 s |
| UI paint + swap | <100 ms |

**Techniques**: streaming tokens; concurrent tool calls; connection pooling; content cache (lore, stat blocks); persistent seeds; CDN images; warm pools for image workers; prompt distillation for image prompts.

---

## 10) Image Pipeline Details

- **Preview mode**: lower steps (10–20), smaller res (512), fast model (e.g., “flash/turbo”), deterministic seed.
- **HQ mode**: 30–50 steps, 1024–1536, optional upscaler; scheduled post‑render.
- **Prompt template** (DM → Image):

```
[Style: painterly noir, muted palette]
[Subjects: {subjects}]
[Setting: {setting}]
[Key details: {canon_facts}]
[Framing: medium wide, cinematic]
[Do not include text]
```

- **Retry & Fallback**: If preview fails by T+5s, show stock silhouette + retry once in background.

---

## 11) Safety & Content Controls

- Pre‑prompt constraints; tool‑level filters; final output safety pass.
- Redaction policy for disallowed content; replace with safe alternates.
- Age‑rating mode (Teen/Adult) toggles allowed themes.

---

## 12) Persistence & Saves

- Auto‑save per turn: sceneId, flags, character, inventory, quest.
- Cloud saves keyed by playerId + sessionId; allow manual bookmarks.

---

## 13) Analytics & Live Tuning

**KPIs**:

- Time‑to‑first‑token, time‑to‑preview‑image, turn duration
- Choice utilization vs free‑text ratio
- Encounter fail/success rates, DC distribution
- Drop‑offs (scene, latency), CSAT prompts

**Experimentation**:

- A/B: number of choices (2 vs 4), preview style, narration length
- Multi‑armed bandit for prompt variants (guarded by safety)

---

## 14) Balancing & Difficulty

- DC presets per tier (Novice/Standard/Challenging)
- Adaptive: raise or lower DC by ±2 based on rolling 3‑turn success rate
- Hard caps to prevent runaway difficulty

---

## 15) Content Pipeline

- **Scene Templates** with slots (location, obstacle, stakes)
- **Encounter Blueprints** (skill, social, combat)
- **NPC Personas** with goals & secrets
- **Lorebook**: canonical facts (never contradict)
- **Asset Tags** → image prompt tokens

---

## 16) Example Turn (End‑to‑End)

**Player**: "I pick the lock quietly."

**Planner** → plan:

```
{
  "steps": [
    {"tool": "rules/check", "args": {"seed": 8842, "actor": "pc:1", "ability": "DEX", "proficient": true, "dc": 15 }},
    {"tool": "world/update", "args": {"sceneId": "crypt_entrance", "flags": {"doorOpen": true}}},
    {"tool": "images/request", "args": {"sceneId": "crypt_entrance", "prompt": "ancient iron gate ajar, torchlit crypt, fog", "mode": "preview", "seed": 8842}}
  ]
}
```

**Tool results** → reducer → DM output:

```
{
  "narration": "The pick bites. With a soft click, the iron gate yields a handspan—enough to slip through without a squeal.",
  "action_log": [{"type":"check","ability":"DEX","roll":17,"total":19,"dc":15}],
  "choices": ["Slip inside", "Wedge it wider", "Look for patrols"],
  "state_updates": {"flags":{"doorOpen": true}},
  "image_request": {"jobId":"img_abc","mode":"preview"}
}
```

---

## 17) Failure & Recovery

- **Tool timeout** → fallback narration acknowledges delay; queue retry; do not fabricate mechanics.
- **Image fail** → show placeholder, retry once; log metric.
- **Contradiction** → critic agent requests revision; if unresolved, prefer canonical facts.

---

## 18) Engineering Notes

- **Streaming UI** (SSE/WebSocket) for narration and job status.
- **Batch tool calls** (checks for multiple NPCs) to reduce overhead.
- **Cache**: lorebook, stat blocks, prompt templates in memory/CDN.
- **Content hashes** to dedupe identical image prompts.
- **Observability**: OpenTelemetry spans; per‑turn traces with seeds.

---

## 19) Privacy & Data Handling

- Store minimal PII; encrypt at rest; redact raw prompts from analytics by default.
- Provide data export & delete endpoints.

---

## 20) Roadmap (Milestones)

1. **MVP (4–6 wks)**: Single‑protagonist, skill checks, basic combat, preview images, saves.
2. **Beta**: HQ re‑render pipeline, NPC agents, shops/economy, analytics dashboard.
3. **1.0**: Chaptered campaign, difficulty tuning, live‑ops events, modding hooks.
4. **Post‑1.0**: Co‑op sessions, creator tools, seasonal content, mobile client.

---

## 21) Optional Extensions

- **TCG‑lite encounters** embedded in narrative (card‑based combat)
- **Voice**: TTS for narration; VAD for player speech input
- **Accessibility**: alt text, high‑contrast mode, text size presets

---

## 22) Acceptance Criteria (MVP)

- 95th percentile **preview image** time ≤ 5s
- No mechanical outcomes generated by LLM (all from tools)
- Save/Load works across sessions
- At least 10 unique scenes with canonical facts enforced
- Telemetry for core KPIs enabled and visible
