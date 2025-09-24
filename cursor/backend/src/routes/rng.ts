import { Router, Request, Response } from "express";
import { roll } from "randsum";
import seedrandom from "seedrandom";

const router = Router();

interface RngRollRequest {
  seed: string | number;
  dice: string;
}

router.post("/roll", (req: Request, res: Response) => {
  const { seed, dice } = req.body as RngRollRequest;

  if (!seed || !dice) {
    return res.status(400).json({ error: "Missing seed or dice string" });
  }

  try {
    const rng = seedrandom(seed.toString());

    // `randsum` allows passing a custom randomizer function directly.
    const result = roll(dice, { randomizer: rng });

    // The result object from `randsum` matches our spec's needs perfectly.
    const total = result.total;
    const rolls = result.rolls;
    const modifier = result.modifier;

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
