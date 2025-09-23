import { RNGTool } from './rng.js';

export class CombatTool {
  static resolveTurn({ seed, attacker, target, attack, targetAC }) {
    if (!attacker || !target || !attack) {
      throw new Error('Missing required combat parameters');
    }

    const toHitRoll = RNGTool.d20(seed, attack.toHitMod);
    const hit = toHitRoll.total >= targetAC;

    let damage = null;
    let status = [];

    if (hit) {
      const damageRoll = RNGTool.roll(seed + 1, attack.damage);
      damage = {
        rolls: damageRoll.rolls,
        modifier: damageRoll.modifier,
        total: damageRoll.total,
        type: attack.damageType || 'physical'
      };

      if (toHitRoll.roll === 20) {
        const critDamage = RNGTool.roll(seed + 2, attack.damage);
        damage.total += critDamage.total;
        damage.critical = true;
        status.push('critical_hit');
      }

      if (target.takeDamage) {
        target.takeDamage(damage.total);
      }

      if (target.hp && target.hp.current <= 0) {
        status.push('target_defeated');
      }
    }

    return {
      hit,
      toHitRoll: toHitRoll.roll,
      total: toHitRoll.total,
      targetAC,
      damage,
      status,
      attacker: attacker.id || attacker.name,
      target: target.id || target.name,
      seed
    };
  }

  static rollInitiative(seed, actors) {
    const results = [];

    actors.forEach((actor, index) => {
      const dexMod = actor.getAbilityModifier ? actor.getAbilityModifier('DEX') : 0;
      const initiative = RNGTool.d20(seed + index, dexMod);

      results.push({
        actor: actor.id || actor.name,
        initiative: initiative.total,
        roll: initiative.roll,
        modifier: dexMod
      });
    });

    return results.sort((a, b) => b.initiative - a.initiative);
  }

  static resolveSpell({ seed, caster, target, spell, saveDC }) {
    if (spell.requiresSave) {
      const save = RNGTool.d20(seed, target.getSaveModifier(spell.saveAbility));
      const success = save.total >= saveFC;

      let damage = null;
      if (spell.damage) {
        const damageRoll = RNGTool.roll(seed + 1, spell.damage);
        const finalDamage = success && spell.halfOnSave ?
          Math.floor(damageRoll.total / 2) : damageRoll.total;

        damage = {
          rolls: damageRoll.rolls,
          total: finalDamage,
          type: spell.damageType,
          save: { success, roll: save.roll, total: save.total, dc: saveFC }
        };

        if (target.takeDamage) {
          target.takeDamage(finalDamage);
        }
      }

      return {
        spell: spell.name,
        caster: caster.id || caster.name,
        target: target.id || target.name,
        save: { success, roll: save.roll, total: save.total, dc: saveFC },
        damage,
        seed
      };
    } else {
      return this.resolveTurn({
        seed,
        attacker: caster,
        target,
        attack: {
          toHitMod: spell.spellAttackBonus,
          damage: spell.damage,
          damageType: spell.damageType
        },
        targetAC: target.ac || 10
      });
    }
  }

  static applyCondition(target, condition, duration = null) {
    if (!target.conditions) {
      target.conditions = [];
    }

    const existing = target.conditions.find(c => c.type === condition);
    if (existing) {
      if (duration) existing.duration = Math.max(existing.duration, duration);
    } else {
      target.conditions.push({
        type: condition,
        duration: duration,
        appliedAt: new Date().toISOString()
      });
    }

    return target.conditions;
  }

  static removeCondition(target, condition) {
    if (!target.conditions) return [];

    target.conditions = target.conditions.filter(c => c.type !== condition);
    return target.conditions;
  }
}