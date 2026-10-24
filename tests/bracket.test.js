import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { BracketEngine } from '../src/domain/BracketEngine.js';

describe('BracketEngine', () => {
  const sampleItems = [
    { id: '1', name: 'Thai Food' },
    { id: '2', name: 'Mexican Tacos' },
    { id: '3', name: 'Ramen' },
    { id: '4', name: 'Burgers' },
  ];

  test('should initialize an 4-item bracket with 2 rounds', () => {
    const engine = new BracketEngine({ shuffle: false });
    const state = engine.startTournament(sampleItems);

    assert.equal(state.rounds.length, 2); // Round 0 (Semis), Round 1 (Finals)
    assert.equal(state.rounds[0].length, 2); // 2 matches in round 1
    assert.equal(state.rounds[1].length, 1); // 1 match in finals
    assert.equal(state.isComplete, false);
    assert.equal(state.champion, null);
  });

  test('should handle non-power-of-2 pools (e.g. 3 items) using byes', () => {
    const engine = new BracketEngine({ shuffle: false });
    const items = [
      { id: '1', name: 'Thai Food' },
      { id: '2', name: 'Tacos' },
      { id: '3', name: 'Ramen' },
    ];
    const state = engine.startTournament(items);

    assert.equal(state.rounds.length, 2);
    // 4 slots total (1 bye)
    const match = engine.getCurrentMatch();
    assert.ok(match, 'Should have a playable match');
    assert.ok(match.itemA && match.itemB);
  });

  test('should progress through matches and crown champion', () => {
    const engine = new BracketEngine({ shuffle: false });
    engine.startTournament(sampleItems);

    // Match 1: Thai vs Mexican -> Thai wins
    let match = engine.getCurrentMatch();
    assert.equal(match.itemA.name, 'Thai Food');
    engine.chooseWinner(match.itemA);

    // Match 2: Ramen vs Burgers -> Burgers wins
    match = engine.getCurrentMatch();
    assert.equal(match.itemA.name, 'Ramen');
    engine.chooseWinner(match.itemB);

    // Finals: Thai vs Burgers -> Burgers wins
    match = engine.getCurrentMatch();
    assert.equal(engine.getRoundName(), 'Championship Finals 🏆');
    assert.equal(match.itemA.name, 'Thai Food');
    assert.equal(match.itemB.name, 'Burgers');
    
    const finalState = engine.chooseWinner(match.itemB);
    assert.equal(finalState.isComplete, true);
    assert.equal(finalState.champion.name, 'Burgers');
  });

  test('should support undoing the previous match decision', () => {
    const engine = new BracketEngine({ shuffle: false });
    engine.startTournament(sampleItems);

    // Match 1: Thai vs Mexican
    const match1 = engine.getCurrentMatch();
    engine.chooseWinner(match1.itemA);

    // In Match 2 now
    assert.equal(engine.getProgress().completed, 1);

    // Undo
    const undone = engine.undoLastDecision();
    assert.equal(undone, true);
    assert.equal(engine.getProgress().completed, 0);

    const matchAfterUndo = engine.getCurrentMatch();
    assert.equal(matchAfterUndo.itemA.name, 'Thai Food');
  });
});
