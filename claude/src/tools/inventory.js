export class InventoryTool {
  static update(actor, delta) {
    if (!actor || !delta) {
      throw new Error('Actor and delta are required');
    }

    const result = {
      ok: true,
      changes: {},
      errors: []
    };

    if (delta.gold !== undefined) {
      const newGold = (actor.resources.gold || 0) + delta.gold;
      if (newGold < 0) {
        result.ok = false;
        result.errors.push('Insufficient gold');
        return result;
      }
      actor.resources.gold = newGold;
      result.changes.gold = newGold;
    }

    if (delta.itemsAdd && Array.isArray(delta.itemsAdd)) {
      delta.itemsAdd.forEach(item => {
        if (typeof item === 'string') {
          actor.addItem({ id: crypto.randomUUID(), name: item, quantity: 1 });
        } else {
          actor.addItem(item);
        }
      });
      result.changes.itemsAdded = delta.itemsAdd;
    }

    if (delta.itemsRemove && Array.isArray(delta.itemsRemove)) {
      delta.itemsRemove.forEach(itemId => {
        actor.removeItem(itemId);
      });
      result.changes.itemsRemoved = delta.itemsRemove;
    }

    if (delta.resources) {
      Object.keys(delta.resources).forEach(resource => {
        if (actor.resources[resource] !== undefined) {
          actor.updateResource(resource, delta.resources[resource]);
          result.changes[resource] = actor.resources[resource];
        }
      });
    }

    result.newGold = actor.resources.gold;
    result.items = actor.inventory;
    result.resources = actor.resources;

    return result;
  }

  static shopTransaction({ buyer, seller, item, quantity = 1, price }) {
    if (!buyer || !item || !price) {
      throw new Error('Buyer, item, and price are required');
    }

    const totalCost = price * quantity;

    if (buyer.resources.gold < totalCost) {
      return {
        ok: false,
        error: 'Insufficient gold',
        required: totalCost,
        available: buyer.resources.gold
      };
    }

    const itemToAdd = {
      ...item,
      quantity: quantity,
      purchasedAt: new Date().toISOString(),
      purchasePrice: price
    };

    buyer.resources.gold -= totalCost;
    buyer.addItem(itemToAdd);

    if (seller && seller.resources) {
      seller.resources.gold = (seller.resources.gold || 0) + totalCost;
    }

    return {
      ok: true,
      transaction: {
        buyer: buyer.id || buyer.name,
        seller: seller?.id || seller?.name || 'shop',
        item: item.name,
        quantity,
        price,
        totalCost
      },
      buyerGold: buyer.resources.gold,
      sellerGold: seller?.resources?.gold
    };
  }

  static getInventoryValue(actor) {
    if (!actor.inventory) return 0;

    return actor.inventory.reduce((total, item) => {
      const value = item.value || item.purchasePrice || 0;
      const quantity = item.quantity || 1;
      return total + (value * quantity);
    }, 0);
  }

  static findItem(actor, itemName) {
    if (!actor.inventory) return null;

    return actor.inventory.find(item =>
      item.name.toLowerCase() === itemName.toLowerCase()
    );
  }

  static hasItem(actor, itemName, quantity = 1) {
    const item = this.findItem(actor, itemName);
    if (!item) return false;

    return (item.quantity || 1) >= quantity;
  }

  static consumeItem(actor, itemName, quantity = 1) {
    const item = this.findItem(actor, itemName);
    if (!item) {
      return {
        ok: false,
        error: 'Item not found'
      };
    }

    const available = item.quantity || 1;
    if (available < quantity) {
      return {
        ok: false,
        error: 'Insufficient quantity',
        available,
        requested: quantity
      };
    }

    if (available === quantity) {
      actor.removeItem(item.id);
    } else {
      item.quantity -= quantity;
    }

    return {
      ok: true,
      consumed: quantity,
      remaining: Math.max(0, available - quantity)
    };
  }
}