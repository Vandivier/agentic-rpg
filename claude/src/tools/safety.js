export class SafetyTool {
  static contentFilters = {
    explicit: [
      /\b(?:explicit sexual|graphic violence|gore|torture)\b/i,
      /\b(?:rape|sexual assault|abuse)\b/i
    ],
    profanity: [
      /\b(?:fuck|shit|damn|hell|bitch|asshole)\b/i
    ],
    inappropriate: [
      /\b(?:suicide|self-harm|drug abuse)\b/i
    ]
  };

  static ageRatings = {
    Teen: {
      allowedThemes: ['adventure', 'fantasy', 'mystery', 'friendship'],
      forbiddenContent: ['explicit', 'profanity', 'inappropriate'],
      maxViolenceLevel: 'mild'
    },
    Adult: {
      allowedThemes: ['adventure', 'fantasy', 'mystery', 'friendship', 'romance', 'political'],
      forbiddenContent: ['explicit'],
      maxViolenceLevel: 'moderate'
    }
  };

  static check(text, ageRating = 'Teen') {
    const result = {
      ok: true,
      redactions: [],
      warnings: [],
      ageRating
    };

    const rating = this.ageRatings[ageRating] || this.ageRatings.Teen;

    rating.forbiddenContent.forEach(category => {
      const filters = this.contentFilters[category] || [];
      filters.forEach(filter => {
        const matches = text.match(filter);
        if (matches) {
          result.ok = false;
          result.redactions.push({
            category,
            match: matches[0],
            position: matches.index
          });
        }
      });
    });

    if (text.length > 500) {
      result.warnings.push('Content is quite long, consider breaking into smaller sections');
    }

    const violenceKeywords = /\b(?:kill|murder|blood|death|weapon|sword|fight)\b/gi;
    const violenceMatches = text.match(violenceKeywords) || [];
    if (violenceMatches.length > 3 && rating.maxViolenceLevel === 'mild') {
      result.warnings.push('High violence content detected');
    }

    return result;
  }

  static sanitize(text, ageRating = 'Teen') {
    const checkResult = this.check(text, ageRating);

    if (!checkResult.ok) {
      let sanitized = text;

      checkResult.redactions.forEach(redaction => {
        const replacement = this.getRedactionReplacement(redaction.category);
        sanitized = sanitized.replace(redaction.match, replacement);
      });

      return {
        ok: true,
        original: text,
        sanitized,
        redactions: checkResult.redactions,
        warnings: checkResult.warnings
      };
    }

    return {
      ok: true,
      original: text,
      sanitized: text,
      redactions: [],
      warnings: checkResult.warnings
    };
  }

  static getRedactionReplacement(category) {
    const replacements = {
      explicit: '[content removed]',
      profanity: '[expletive]',
      inappropriate: '[sensitive content]'
    };

    return replacements[category] || '[redacted]';
  }

  static validateImagePrompt(prompt) {
    const inappropriateImageContent = [
      /\b(?:nude|naked|sexual|explicit|nsfw)\b/i,
      /\b(?:gore|graphic violence|blood)\b/i,
      /\b(?:hate|nazi|racist)\b/i
    ];

    const warnings = [];
    let safe = true;

    inappropriateImageContent.forEach(filter => {
      if (filter.test(prompt)) {
        safe = false;
        warnings.push(`Inappropriate image content detected: ${filter.source}`);
      }
    });

    return {
      safe,
      warnings,
      prompt: safe ? prompt : this.sanitizeImagePrompt(prompt)
    };
  }

  static sanitizeImagePrompt(prompt) {
    let sanitized = prompt;

    sanitized = sanitized.replace(/\b(?:nude|naked|sexual|explicit|nsfw)\b/gi, 'clothed');
    sanitized = sanitized.replace(/\b(?:gore|graphic violence|blood)\b/gi, 'action');
    sanitized = sanitized.replace(/\b(?:hate|nazi|racist)\b/gi, '');

    return sanitized.trim();
  }

  static moderatePlayerInput(input, context = {}) {
    const result = this.check(input, context.ageRating);

    if (!result.ok) {
      return {
        allowed: false,
        reason: 'Content violates community guidelines',
        redactions: result.redactions,
        alternative: 'Please rephrase your action in a more appropriate way'
      };
    }

    const spamPattern = /(.)\1{10,}/;
    if (spamPattern.test(input)) {
      return {
        allowed: false,
        reason: 'Spam detected',
        alternative: 'Please provide a meaningful action'
      };
    }

    if (input.length > 1000) {
      return {
        allowed: false,
        reason: 'Input too long',
        alternative: 'Please keep your action under 1000 characters'
      };
    }

    return {
      allowed: true,
      input: input.trim()
    };
  }
}