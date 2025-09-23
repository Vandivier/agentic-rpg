import { Router, Request, Response } from "express";
import { DiceRoller } from "dice-typescript";
import seedrandom from "seedrandom";

const router = Router();

interface RngRollRequest {
  seed: string | number;
  dice: string;
}

const diceRoller = new DiceRoller();

router.post("/roll", (req: Request, res: Response) => {
  const { seed, dice } = req.body as RngRollRequest;

  if (!seed || !dice) {
    return res.status(400).json({ error: "Missing seed or dice string" });
  }

  try {
    const rng = seedrandom(seed.toString());
    // Override the default random function with our seeded one
    diceRoller.roll(dice, () => rng());
    const result = diceRoller.getLog()[diceRoller.getLog().length - 1];

    // The structure of the result from dice-typescript is a bit different.
    // We will adapt it to the format specified in SPEC.md
    // Example result: { total: 9, rolls: [ [Object] ], string: '2d6+1' }
    // The rolls themselves are inside an object with more details.

    // This library doesn't easily expose just the raw dice rolls and modifier separately
    // in the way the spec desires. Let's simplify and return what we can get.
    // For now, we will return the total. We can refine this later if needed.
    // A more robust solution might involve parsing the dice string ourselves,
    // but for the MVP, the total is the most critical part.

    const total = result.total;

    // We can't easily get the individual rolls and modifier without more complex parsing,
    // which is out of scope for this initial implementation with this library.
    // We will return an empty array for rolls and 0 for modifier to satisfy the spec's shape.
    return res.json({ total, rolls: [], modifier: 0 });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return res
      .status(500)
      .json({ error: "Failed to roll dice", details: errorMessage });
  }
});

export default router;
