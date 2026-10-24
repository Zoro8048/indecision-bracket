import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { StorageManager } from '../src/storage/StorageManager.js';

describe('StorageManager', () => {
  test('should initialize with default presets when no storage exists', () => {
    // In Node test environment, window.localStorage is undefined, so it uses defaults
    const storage = new StorageManager('test_storage_key');
    const pools = storage.getPools();
    assert.ok(pools.length >= 4);

    const takeoutPool = storage.getPool('pool_takeout');
    assert.ok(takeoutPool);
    assert.equal(takeoutPool.name, 'Quick Takeout & Casual');
    assert.ok(takeoutPool.items.length >= 8);
  });

  test('should record and clear history', () => {
    const storage = new StorageManager('test_storage_key');
    storage.recordHistory({ id: 'item_1', name: 'Sushi Bar' }, 123456789);

    const history = storage.getHistory();
    assert.equal(history['item_1'], 123456789);

    storage.clearHistory();
    assert.deepEqual(storage.getHistory(), {});
  });

  test('should export and import valid JSON backups', () => {
    const storage = new StorageManager('test_storage_key');
    const exported = storage.exportJSON();
    assert.ok(typeof exported === 'string');
    assert.ok(exported.includes('pool_takeout'));

    const imported = storage.importJSON(exported);
    assert.ok(imported.customPools.length >= 4);
  });
});
