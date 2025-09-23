export class Character {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    this.name = data.name || '';
    this.level = data.level || 1;
    this.abilities = data.abilities || {
      STR: 10,
      DEX: 10,
      CON: 10,
      INT: 10,
      WIS: 10,
      CHA: 10
    };
    this.proficiencies = data.proficiencies || [];
    this.hp = data.hp || { current: 20, max: 20 };
    this.resources = data.resources || {
      gold: 50,
      spellSlots: { 1: 0, 2: 0, 3: 0 },
      stamina: { current: 10, max: 10 }
    };
    this.inventory = data.inventory || [];
    this.background = data.background || '';
    this.faction = data.faction || '';
    this.traits = data.traits || [];
    this.experience = data.experience || 0;
  }

  getAbilityModifier(ability) {
    return Math.floor((this.abilities[ability] - 10) / 2);
  }

  getProficiencyBonus() {
    return Math.ceil(this.level / 4) + 1;
  }

  getSkillModifier(skill, ability) {
    const abilityMod = this.getAbilityModifier(ability);
    const profBonus = this.proficiencies.includes(skill) ? this.getProficiencyBonus() : 0;
    return abilityMod + profBonus;
  }

  addItem(item) {
    this.inventory.push(item);
  }

  removeItem(itemId) {
    this.inventory = this.inventory.filter(item => item.id !== itemId);
  }

  updateResource(resource, amount) {
    if (this.resources[resource] !== undefined) {
      if (typeof this.resources[resource] === 'object' && this.resources[resource].current !== undefined) {
        this.resources[resource].current += amount;
        this.resources[resource].current = Math.max(0, Math.min(this.resources[resource].current, this.resources[resource].max));
      } else {
        this.resources[resource] += amount;
        this.resources[resource] = Math.max(0, this.resources[resource]);
      }
    }
  }

  takeDamage(amount) {
    this.hp.current = Math.max(0, this.hp.current - amount);
  }

  heal(amount) {
    this.hp.current = Math.min(this.hp.max, this.hp.current + amount);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      level: this.level,
      abilities: this.abilities,
      proficiencies: this.proficiencies,
      hp: this.hp,
      resources: this.resources,
      inventory: this.inventory,
      background: this.background,
      faction: this.faction,
      traits: this.traits,
      experience: this.experience
    };
  }

  static fromJSON(data) {
    return new Character(data);
  }
}