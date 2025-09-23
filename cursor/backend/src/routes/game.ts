import { Router, Request, Response } from "express";
import { gameStateManager } from "../game/gameStateManager";

const router = Router();

// This endpoint will be used to process a player's turn.
router.post("/turn", (req: Request, res: Response) => {
  // For now, this is a placeholder.
  // The DM Agent orchestration logic will go here.
  const currentState = gameStateManager.getState();
  res.json({
    narration: "You are standing at the entrance of a crypt. What do you do?",
    choices: ["Examine the door", "Listen for sounds", "Enter the crypt"],
    gameState: currentState,
  });
});

// This endpoint will start a new game.
router.post("/new", (req: Request, res: Response) => {
  const { seed } = req.body;
  if (!seed) {
    return res
      .status(400)
      .json({ error: "A seed is required to start a new game." });
  }
  const initialState = gameStateManager.initializeNewGame(seed);
  res.json(initialState);
});

export default router;
