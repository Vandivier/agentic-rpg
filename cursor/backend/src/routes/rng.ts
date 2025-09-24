import { Router, Request, Response } from "express";
import seedrandom from "seedrandom";

const router = Router();

interface RngRollRequest {
  seed: string | number;
  dice: string;
}

/**
 * A simple, deterministic dice roller.
 * @param dice - The dice notation string (e.g., "2d6+3").
 * @param rng - A seeded random number generator function.
 * @returns An object with the total, rolls, and modifier.
 */
function rollDeterministicDice(dice: string, rng: () => number) {
  const diceRegex = /(\d+)d(\d+)([+-]\d+)?/;
  const match = dice.match(diceRegex);

  if (!match) {
    throw new Error(`Invalid dice notation: ${dice}`);
  }

  const numDice = parseInt(match[1], 10);
  const numSides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  const rolls: number[] = [];
  let total = 0;

  for (let i = 0; i < numDice; i++) {
    const roll = Math.floor(rng() * numSides) + 1;
    rolls.push(roll);
    total += roll;
  }

  total += modifier;

  return { total, rolls, modifier };
}

router.post("/roll", (req: Request, res: Response) => {
  const { seed, dice } = req.body as RngRollRequest;

  if (!seed || !dice) {
    return res.status(400).json({ error: "Missing seed or dice string" });
  }

  try {
    const rng = seedrandom(seed.toString());
    const result = rollDeterministicDice(dice, rng);
    return res.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return res
      .status(500)
      .json({ error: "Failed to roll dice", details: errorMessage });
  }
});

export default router;
