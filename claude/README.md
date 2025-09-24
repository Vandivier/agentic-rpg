# Agentic RPG

An LLM-directed, tool-assisted narrative RPG that blends **determinism when it matters** (rules, dice, resources) with **creativity everywhere else** (storytelling, images, banter).

## Features

- **Agent-first architecture**: DM Agent orchestrates scenes, NPC Agents handle dialogue, Critic Agent validates outputs
- **Deterministic mechanics**: All dice rolls, combat, and resource management handled by tools, not LLM
- **Real-time streaming**: WebSocket-based interface with streaming narration
- **Dual-path image generation**: Fast preview images (≤5s) with optional HQ re-renders
- **Observable & reproducible**: Seeded RNG, traceable tool calls, serialized world state
- **Safety & content filtering**: Age-appropriate content with configurable filters

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Start the server**:
   ```bash
   npm start
   ```

4. **Open your browser**:
   Navigate to `http://localhost:3000`

## Architecture

### Core Components

- **State Machine**: Manages game flow through states (Idle → Plan → ToolExec → Reduce → Safety → Render → AwaitInput)
- **Game Orchestrator**: Coordinates between agents and manages sessions
- **Tool APIs**: Deterministic systems for dice, combat, inventory, world state
- **Agent System**: DM, NPC, and Critic agents for different aspects of gameplay
- **Content System**: YAML-based lorebook and scenes for rich world-building

### Project Structure

```
src/
├── agents/          # DM, NPC, and Critic agents
├── content/         # Lorebook and scene definitions
├── images/          # Image generation pipeline
├── models/          # Data models (Session, Character, Scene, Trace)
├── persistence/     # Save system and data storage
├── routes/          # HTTP API endpoints
├── state/           # State machine and orchestration
├── tools/           # Deterministic game mechanics
├── ui/              # Frontend HTML/CSS/JS
└── index.js         # Main server entry point
```

## Game Systems

### Character Model
- **Abilities**: STR/DEX/CON/INT/WIS/CHA (0-20 scale)
- **Skills**: Proficiency bonus based on level
- **Resources**: HP, gold, spell slots, etc.
- **Inventory**: Items with properties and effects

### Mechanics
- **Skill Checks**: d20 + ability modifier + proficiency bonus vs. DC
- **Combat**: Initiative, attack rolls, damage, status effects
- **Advantage/Disadvantage**: Roll twice, take higher/lower
- **DC Scale**: 5 (Trivial) to 25 (Extreme)

### World State
- **Scenes**: Persistent locations with flags and NPCs
- **Global Flags**: World-wide state tracking
- **Time System**: Day/hour tracking with events
- **Quest System**: Objective tracking and completion

## Content Creation

### Lorebook (YAML)
Define NPCs, locations, organizations, and lore:

```yaml
npcs:
  thorin_barkeep:
    name: "Thorin Ironbrew"
    race: "Dwarf"
    role: "Tavern Keeper"
    disposition: "helpful"
    knowledge:
      - topic: "local_history"
        information: "The city was founded 300 years ago..."
        keywords: ["history", "founding"]
```

### Scenes (YAML)
Create interactive locations:

```yaml
scenes:
  tavern_start:
    title: "The Crossed Swords Tavern"
    description: "A warm, welcoming tavern..."
    canonical_facts:
      - "The fireplace never goes out"
    npcs:
      - id: "thorin_barkeep"
        position: "behind the bar"
```

## API Reference

### Tool APIs

#### RNG Tool
```javascript
POST /rng/roll
{ "seed": 123, "dice": "2d6+1" }
→ { "total": 9, "rolls": [3,5], "modifier": 1 }
```

#### Rules Tool
```javascript
POST /rules/check
{ "seed": 123, "actor": character, "ability": "DEX", "dc": 15 }
→ { "result": "success", "roll": 17, "total": 19, "dc": 15 }
```

#### Combat Tool
```javascript
POST /combat/resolveTurn
{ "seed": 42, "attacker": pc, "target": npc, "attack": {...} }
→ { "hit": true, "damage": { "total": 9 }, "status": [] }
```

### WebSocket Events

#### Client → Server
- `player-action`: Submit player input
  ```javascript
  {
    sessionId: "uuid",
    playerInput: "I pick the lock",
    sceneId: "tavern_start"
  }
  ```

#### Server → Client
- `narration-stream`: Streaming story text
- `turn-complete`: Turn processing finished
- `image-generating`: Image generation started
- `image-ready`: Image available
- `error`: Error occurred

## Configuration

### Environment Variables
```bash
PORT=3000
NODE_ENV=development

# LLM APIs (for future integration)
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here

# Image Generation (for future integration)
STABILITY_API_KEY=your_key_here

# Safety/Moderation
OPENAI_MODERATION_KEY=your_key_here
```

### Game Settings
- **Age Rating**: Teen/Adult content filtering
- **Difficulty**: Trivial to Extreme DC scaling
- **Image Quality**: Preview-only or with HQ re-renders
- **Auto-save**: Frequency and backup retention

## Performance

### Latency Budget (Target)
- Planner + DM draft: 300-800ms
- Tool calls (parallel): 80-200ms
- Safety check: 50-120ms
- Image preview: 2.5-4.5s
- UI paint/swap: <100ms

### Optimization Techniques
- Streaming token output
- Concurrent tool execution
- Connection pooling
- Content caching (lore, templates)
- Persistent RNG seeds
- Warm image generation pools

## Development

### Running in Development
```bash
npm run dev  # Uses nodemon for auto-restart
```

### Testing
```bash
npm test     # Run test suite
npm run lint # Code linting
```

### Adding New Content
1. Edit `src/content/lorebook.yaml` for world data
2. Edit `src/content/scenes.yaml` for locations
3. Restart server to reload content

### Adding New Tools
1. Create tool class in `src/tools/`
2. Export from `src/tools/index.js`
3. Add to DM Agent's tool execution logic

## Roadmap

### MVP (Current)
- ✅ Single-protagonist gameplay
- ✅ Skill checks and basic combat
- ✅ Preview image generation
- ✅ Save/load sessions
- ✅ Basic UI and streaming

### Beta (Planned)
- HQ image re-rendering
- Advanced NPC dialogue system
- Shop/economy mechanics
- Analytics dashboard
- Content editor UI

### 1.0 (Future)
- Multi-chapter campaigns
- Difficulty auto-tuning
- Live-ops events
- Modding support
- Mobile client

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Acknowledgments

Based on the comprehensive RPG specification in `/SPEC.md`, implementing:
- Agent-first architecture
- Deterministic mechanics
- Real-time streaming
- Observable game state
- Content-driven storytelling