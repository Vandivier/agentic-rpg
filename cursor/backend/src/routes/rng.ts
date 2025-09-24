import { Router, Request, Response } from "express";
import { DiceRoller } from "rpg-dice-roller";
import seedrandom from "seedrandom";

const router = Router();

interface RngRollRequest {
  seed: string | number;
  dice: string;
}

const roller = new DiceRoller();

router.post("/roll", (req: Request, res: Response) => {
  const { seed, dice } = req.body as RngRollRequest;

  if (!seed || !dice) {
    return res.status(400).json({ error: "Missing seed or dice string" });
  }

  try {
    const rng = seedrandom(seed.toString());
    roller.setRand(rng);

    const result = roller.roll(dice);

    // The rpg-dice-roller library provides a much richer result object.
    // We can extract the total, individual rolls, and we can infer the modifier.
    const total = result.total;
    const rolls = result.rolls.flatMap((r) => r.rolls.map((i) => i.value));

    // Infer the modifier by subtracting the sum of rolls from the total.
    const sumOfRolls = rolls.reduce((acc, val) => acc + val, 0);
    const modifier = total - sumOfRolls;

    return res.json({ total, rolls, modifier });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return res
      .status(500)
      .json({ error: "Failed to roll dice", details: errorMessage });
  }
});

export default router;
