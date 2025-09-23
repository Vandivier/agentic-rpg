import seedrandom from 'seedrandom';

export class RNGTool {
  static roll(seed, dice) {
    const rng = seedrandom(seed.toString());

    const match = dice.match(/^(\d+)d(\d+)(?:\+(\d+))?$/);
    if (!match) {
      throw new Error(`Invalid dice format: ${dice}`);
    }

    const [, numDice, dieSize, modifier] = match;
    const num = parseInt(numDice);
    const size = parseInt(dieSize);
    const mod = parseInt(modifier) || 0;

    const rolls = [];
    let total = 0;

    for (let i = 0; i < num; i++) {
      const roll = Math.floor(rng() * size) + 1;
      rolls.push(roll);
      total += roll;
    }

    total += mod;

    return {
      total,
      rolls,
      modifier: mod,
      dice,
      seed
    };
  }

  static d20(seed, modifier = 0) {
    const rng = seedrandom(seed.toString());
    const roll = Math.floor(rng() * 20) + 1;
    return {
      roll,
      modifier,
      total: roll + modifier,
      seed
    };
  }

  static advantage(seed, modifier = 0) {
    const rng = seedrandom(seed.toString());
    const roll1 = Math.floor(rng() * 20) + 1;
    const roll2 = Math.floor(rng() * 20) + 1;
    const roll = Math.max(roll1, roll2);

    return {
      roll,
      rolls: [roll1, roll2],
      modifier,
      total: roll + modifier,
      advantage: true,
      seed
    };
  }

  static disadvantage(seed, modifier = 0) {
    const rng = seedrandom(seed.toString());
    const roll1 = Math.floor(rng() * 20) + 1;
    const roll2 = Math.floor(rng() * 20) + 1;
    const roll = Math.min(roll1, roll2);

    return {
      roll,
      rolls: [roll1, roll2],
      modifier,
      total: roll + modifier,
      disadvantage: true,
      seed
    };
  }
}