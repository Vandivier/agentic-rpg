import { SafetyTool } from '../tools/index.js';

export class CriticAgent {
  constructor(options = {}) {
    this.options = {
      strictMode: options.strictMode || false,
      maxNarrationLength: options.maxNarrationLength || 500,
      requireCanonicalConsistency: options.requireCanonicalConsistency !== false,
      ageRating: options.ageRating || 'Teen',
      ...options
    };
  }

  async validateDMOutput(output, context) {
    const validation = {
      approved: true,
      warnings: [],
      errors: [],
      suggestions: [],
      requiresRevision: false
    };

    try {
      this.validateSafety(output, validation);
      this.validateLength(output, validation);
      this.validateConsistency(output, context, validation);
      this.validateMechanics(output, context, validation);
      this.validateChoices(output, validation);

      validation.requiresRevision = validation.errors.length > 0;
      validation.approved = !validation.requiresRevision;

      return validation;

    } catch (error) {
      console.error('Critic Agent validation error:', error);
      validation.approved = false;
      validation.errors.push('Validation system error');
      validation.requiresRevision = true;
      return validation;
    }
  }

  validateSafety(output, validation) {
    if (output.narration) {
      const safetyCheck = SafetyTool.check(output.narration, this.options.ageRating);

      if (!safetyCheck.ok) {
        validation.errors.push('Content violates safety guidelines');
        safetyCheck.redactions.forEach(redaction => {
          validation.errors.push(`Safety violation (${redaction.category}): ${redaction.match}`);
        });
      }

      safetyCheck.warnings.forEach(warning => {
        validation.warnings.push(`Safety warning: ${warning}`);
      });
    }

    if (output.imageRequest && output.imageRequest.prompt) {
      const imageValidation = SafetyTool.validateImagePrompt(output.imageRequest.prompt);
      if (!imageValidation.safe) {
        validation.warnings.push('Image prompt may need adjustment');
        imageValidation.warnings.forEach(warning => {
          validation.warnings.push(`Image safety: ${warning}`);
        });
      }
    }
  }

  validateLength(output, validation) {
    if (output.narration) {
      const wordCount = output.narration.split(/\s+/).length;

      if (wordCount > this.options.maxNarrationLength) {
        validation.errors.push(`Narration too long: ${wordCount} words (max: ${this.options.maxNarrationLength})`);
      }

      if (wordCount < 10) {
        validation.warnings.push('Narration is very short, consider adding more detail');
      }
    }
  }

  validateConsistency(output, context, validation) {
    if (!this.options.requireCanonicalConsistency) return;

    if (context.scene && context.scene.canonicalFacts) {
      const narration = output.narration?.toLowerCase() || '';

      context.scene.canonicalFacts.forEach(fact => {
        if (fact.contradictions) {
          fact.contradictions.forEach(contradiction => {
            if (narration.includes(contradiction.toLowerCase())) {
              validation.errors.push(`Contradicts canonical fact: ${fact.description}`);
            }
          });
        }
      });
    }

    if (context.character && output.actionLog) {
      output.actionLog.forEach(action => {
        if (action.type === 'check' && action.ability) {
          const maxPossible = 20 + context.character.getAbilityModifier(action.ability) +
                            context.character.getProficiencyBonus();

          if (action.total > maxPossible) {
            validation.errors.push(`Impossible roll result: ${action.total} > ${maxPossible}`);
          }
        }
      });
    }

    if (context.lorebook && output.narration) {
      const conflicts = this.checkLorebook(output.narration, context.lorebook);
      conflicts.forEach(conflict => {
        validation.warnings.push(`Potential lore conflict: ${conflict}`);
      });
    }
  }

  validateMechanics(output, context, validation) {
    if (output.actionLog) {
      output.actionLog.forEach(action => {
        switch (action.type) {
          case 'check':
            this.validateCheckMechanics(action, validation);
            break;
          case 'combat':
            this.validateCombatMechanics(action, validation);
            break;
          case 'inventory':
            this.validateInventoryMechanics(action, context, validation);
            break;
        }
      });
    }

    if (output.stateUpdates) {
      this.validateStateChanges(output.stateUpdates, context, validation);
    }
  }

  validateCheckMechanics(action, validation) {
    if (action.roll < 1 || action.roll > 20) {
      validation.errors.push(`Invalid d20 roll: ${action.roll}`);
    }

    if (action.dc && (action.dc < 5 || action.dc > 30)) {
      validation.warnings.push(`Unusual DC: ${action.dc}`);
    }

    if (action.total !== action.roll + (action.modifier || 0)) {
      validation.errors.push(`Roll math error: ${action.total} ≠ ${action.roll} + ${action.modifier}`);
    }
  }

  validateCombatMechanics(action, validation) {
    if (action.damage && action.damage.total < 0) {
      validation.errors.push('Negative damage is not allowed');
    }

    if (action.toHitRoll < 1 || action.toHitRoll > 20) {
      validation.errors.push(`Invalid attack roll: ${action.toHitRoll}`);
    }
  }

  validateInventoryMechanics(action, context, validation) {
    if (action.gold && context.character) {
      const newTotal = context.character.resources.gold + action.gold;
      if (newTotal < 0) {
        validation.errors.push('Character cannot afford this transaction');
      }
    }
  }

  validateStateChanges(stateUpdates, context, validation) {
    if (stateUpdates.flags) {
      Object.keys(stateUpdates.flags).forEach(flagKey => {
        if (flagKey.length > 50) {
          validation.warnings.push(`Very long flag key: ${flagKey}`);
        }
      });
    }

    if (stateUpdates.timeAdvance) {
      const hours = stateUpdates.timeAdvance;
      if (hours < 0) {
        validation.errors.push('Cannot advance time backwards');
      }
      if (hours > 24) {
        validation.warnings.push(`Large time advance: ${hours} hours`);
      }
    }
  }

  validateChoices(output, validation) {
    if (output.choices) {
      if (output.choices.length < 2) {
        validation.warnings.push('Consider providing more choices for player agency');
      }

      if (output.choices.length > 6) {
        validation.warnings.push('Too many choices may overwhelm the player');
      }

      const duplicates = this.findDuplicateChoices(output.choices);
      if (duplicates.length > 0) {
        validation.warnings.push(`Duplicate choices: ${duplicates.join(', ')}`);
      }

      output.choices.forEach((choice, index) => {
        if (choice.length > 100) {
          validation.warnings.push(`Choice ${index + 1} is very long`);
        }

        if (choice.length < 5) {
          validation.warnings.push(`Choice ${index + 1} is very short`);
        }
      });
    }
  }

  findDuplicateChoices(choices) {
    const seen = new Set();
    const duplicates = [];

    choices.forEach(choice => {
      const normalized = choice.toLowerCase().trim();
      if (seen.has(normalized)) {
        duplicates.push(choice);
      } else {
        seen.add(normalized);
      }
    });

    return duplicates;
  }

  checkLorebook(narration, lorebook) {
    const conflicts = [];
    const text = narration.toLowerCase();

    if (lorebook.entities) {
      Object.entries(lorebook.entities).forEach(([key, entity]) => {
        if (entity.contradictions) {
          entity.contradictions.forEach(contradiction => {
            if (text.includes(contradiction.toLowerCase())) {
              conflicts.push(`Conflicts with ${key}: ${contradiction}`);
            }
          });
        }
      });
    }

    return conflicts;
  }

  generateRevisionSuggestions(validation, output) {
    const suggestions = [];

    if (validation.errors.some(e => e.includes('too long'))) {
      suggestions.push('Shorten the narration while maintaining key story elements');
    }

    if (validation.errors.some(e => e.includes('safety'))) {
      suggestions.push('Revise content to comply with content guidelines');
    }

    if (validation.errors.some(e => e.includes('canonical'))) {
      suggestions.push('Ensure consistency with established lore and facts');
    }

    if (validation.errors.some(e => e.includes('mechanics'))) {
      suggestions.push('Verify all mechanical calculations and constraints');
    }

    if (validation.warnings.some(w => w.includes('choices'))) {
      suggestions.push('Adjust the number and variety of player choices');
    }

    return suggestions;
  }

  approveWithConditions(validation) {
    if (validation.warnings.length > 0 && validation.errors.length === 0) {
      return {
        approved: true,
        conditional: true,
        conditions: validation.warnings,
        message: 'Approved with minor concerns noted'
      };
    }

    return {
      approved: validation.approved,
      conditional: false,
      message: validation.approved ? 'Fully approved' : 'Requires revision'
    };
  }
}