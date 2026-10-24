import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CooldownManager } from '../src/domain/CooldownManager.js';

describe('CooldownManager', () => {
  const itemA = { id: 'item_a', name: 'Sushi Bar' };
  const itemB = { id: 'item_b', name: 'Pizza Hub' };

  test('should detect item on cooldown within time window', () => {
    const manager = new CooldownManager();
    const now = 1700000000000;
    manager.recordVisit(itemA, now);

    // 1 day later (86,400,000 ms)
    const oneDayLater = now + 86400000;
    assert.equal(manager.isOnCooldown(itemA, 3, oneDayLater), true);

    // 4 days later (cooldown 3 days expired)
    const fourDaysLater = now + (4 * 86400000);
    assert.equal(manager.isOnCooldown(itemA, 3, fourDaysLater), false);
  });

  test('should partition items into available and cooling down', () => {
    const now = Date.now();
    const manager = new CooldownManager();
    manager.recordVisit(itemA, now);

    const result = manager.partition([itemA, itemB], 3);
    assert.equal(result.coolingDown.length, 1);
    assert.equal(result.coolingDown[0].name, 'Sushi Bar');
    assert.equal(result.available.length, 1);
    assert.equal(result.available[0].name, 'Pizza Hub');
  });

  test('should return human readable remaining cooldown time', () => {
    const now = 1700000000000;
    const manager = new CooldownManager();
    manager.recordVisit(itemA, now);

    // 2 days later, 1 day left
    const twoDaysLater = now + (2 * 86400000);
    const remaining = manager.getRemainingCooldown(itemA, 3, twoDaysLater);
    assert.ok(remaining.includes('d left') || remaining.includes('h left'));
  });
});
