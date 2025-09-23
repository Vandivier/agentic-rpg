# Agentic RPG

This project is an implementation of the "Agent-First D&D-Style Narrative RPG" specification.

## Project Structure

This is a monorepo managed with npm workspaces.

- `/backend`: The Node.js/Express server that provides the deterministic tool APIs as defined in the spec. It also contains the core agent logic (DM Agent, Planner, etc.).
- `/frontend`: The Next.js application that serves as the player's interface to the game.
- `/packages/shared`: Shared code and types between the frontend and backend, such as data models for characters, scenes, etc.

## Getting Started

1. Install dependencies from the root directory:

   ```bash
   npm install
   ```

2. Run both backend and frontend concurrently:

   ```bash
   npm run dev
   ```
