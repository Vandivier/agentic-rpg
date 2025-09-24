"use client";

import { useState } from "react";
import { Scene, Character, Session } from "@agentic-rpg/shared";

interface GameState {
  session: Session | null;
  playerCharacter: Character | null;
  currentScene: Scene | null;
}

interface TurnResponse {
  narration: string;
  choices: string[];
  gameState: GameState;
}

export default function Game() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [narration, setNarration] = useState<string>("The adventure begins...");
  const [choices, setChoices] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleNewGame = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/game/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: "initial-seed" }), // Using a fixed seed for now
      });
      const data: GameState = await response.json();
      setGameState(data);

      // After starting a new game, get the first turn information
      const turnResponse = await fetch("/api/game/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }), // Placeholder action
      });
      const turnData: TurnResponse = await turnResponse.json();
      setNarration(turnData.narration);
      setChoices(turnData.choices);
    } catch (error) {
      console.error("Failed to start new game:", error);
      setNarration("Failed to start a new game. Please try again.");
    }
    setIsLoading(false);
  };

  return (
    <div className="container mx-auto p-8">
      <div className="bg-gray-800 text-white p-6 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold mb-4">Agentic RPG</h1>
        <div className="mb-4 p-4 bg-gray-900 rounded">
          <p>{narration}</p>
        </div>

        {gameState ? (
          <div className="flex space-x-4">
            {choices.map((choice, index) => (
              <button
                key={index}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                disabled={isLoading}
              >
                {choice}
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={handleNewGame}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            disabled={isLoading}
          >
            {isLoading ? "Starting..." : "Start New Game"}
          </button>
        )}
      </div>
    </div>
  );
}
