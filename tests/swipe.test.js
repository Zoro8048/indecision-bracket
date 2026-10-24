import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SwipeMatcher } from '../src/domain/SwipeMatcher.js';

describe('SwipeMatcher', () => {
  const items = [
    { id: '1', name: 'Thai' },
    { id: '2', name: 'Tacos' },
    { id: '3', name: 'Ramen' },
  ];

  test('should trigger instant match when Player 2 likes what Player 1 liked', () => {
    const matcher = new SwipeMatcher({ instantMatch: true });
    matcher.startSession(items);

    // Player 1: likes Thai (1), passes Tacos (2), likes Ramen (3)
    matcher.swipe(true);  // likes Thai
    matcher.swipe(false); // passes Tacos
    matcher.swipe(true);  // likes Ramen

    let state = matcher.getState();
    assert.equal(state.activePlayer, 2);
    assert.equal(state.currentIndex, 0);

    // Player 2: passes Thai, likes Tacos, likes Ramen -> MATCH on Ramen!
    matcher.swipe(false); // passes Thai
    matcher.swipe(true);  // likes Tacos (P1 disliked it, so no match yet)
    state = matcher.swipe(true);  // likes Ramen (P1 liked it -> MATCH!)

    assert.equal(state.isComplete, true);
    assert.ok(state.matchedItem);
    assert.equal(state.matchedItem.name, 'Ramen');
  });

  test('should complete with no match if players agree on nothing', () => {
    const matcher = new SwipeMatcher({ instantMatch: true });
    matcher.startSession(items);

    // Player 1 likes only Thai
    matcher.swipe(true);
    matcher.swipe(false);
    matcher.swipe(false);

    // Player 2 dislikes Thai
    matcher.swipe(false);
    matcher.swipe(true);
    const state = matcher.swipe(true);

    assert.equal(state.isComplete, true);
    assert.equal(state.matchedItem, null);
  });
});
