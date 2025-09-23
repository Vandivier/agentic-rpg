import { RNGTool } from './rng.js';

export class RulesTool {
  static check({ seed, actor, ability, proficient = false, dc, advantage = false, disadvantage = false, context = '' }) {
    const character = actor; // Assume actor is a Character object

    if (!character || !character.abilities || !character.abilities[ability]) {
      throw new Error(`Invalid actor or ability: ${ability}`);
    }

    const abilityMod = character.getAbilityModifier(ability);
    const profBonus = proficient ? character.getProficiencyBonus() : 0;
    const totalMod = abilityMod + profBonus;

    let rollResult;
    if (advantage && !disadvantage) {
      rollResult = RNGTool.advantage(seed, totalMod);
    } else if (disadvantage && !advantage) {
      rollResult = RNGTool.disadvantage(seed, totalMod);
    } else {
      rollResult = RNGTool.d20(seed, totalMod);
    }

    const success = rollResult.total >= dc;
    const criticalSuccess = rollResult.roll === 20;
    const criticalFailure = rollResult.roll === 1;

    return {
      result: success ? 'success' : 'fail',
      roll: rollResult.roll,
      total: rollResult.total,
      dc,
      ability,
      proficient,
      abilityModifier: abilityMod,
      proficiencyBonus: profBonus,
      advantage,
      disadvantage,
      criticalSuccess,
      criticalFailure,
      context,
      seed
    };
  }

  static savingThrow({ seed, actor, ability, dc, advantage = false, disadvantage = false }) {
    return this.check({
      seed,
      actor,
      ability,
      proficient: actor.savingThrowProficiencies?.includes(ability) || false,
      dc,
      advantage,
      disadvantage,
      context: 'saving_throw'
    });
  }

  static skillCheck({ seed, actor, skill, dc, advantage = false, disadvantage = false }) {
    const skillAbilityMap = {
      'Athletics': 'STR',
      'Acrobatics': 'DEX',
      'Sleight of Hand': 'DEX',
      'Stealth': 'DEX',
      'Arcana': 'INT',
      'History': 'INT',
      'Investigation': 'INT',
      'Nature': 'INT',
      'Religion': 'INT',
      'Animal Handling': 'WIS',
      'Insight': 'WIS',
      'Medicine': 'WIS',
      'Perception': 'WIS',
      'Survival': 'WIS',
      'Deception': 'CHA',
      'Intimidation': 'CHA',
      'Performance': 'CHA',
      'Persuasion': 'CHA'
    };

    const ability = skillAbilityMap[skill];
    if (!ability) {
      throw new Error(`Unknown skill: ${skill}`);
    }

    const proficient = actor.proficiencies?.includes(skill) || false;

    return this.check({
      seed,
      actor,
      ability,
      proficient,
      dc,
      advantage,
      disadvantage,
      context: `skill_check_${skill.toLowerCase().replace(' ', '_')}`
    });
  }

  static getDifficultyClass(difficulty) {
    const dcMap = {
      'Trivial': 5,
      'Easy': 10,
      'Routine': 12,
      'Moderate': 15,
      'Hard': 18,
      'Very Hard': 20,
      'Extreme': 25
    };

    return dcMap[difficulty] || 15;
  }
}