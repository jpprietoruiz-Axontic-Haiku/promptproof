import { describe, expect, it } from 'vitest';
import { SqliteRunStore } from '../../src/persistence/index.js';

describe('persistence barrel export', () => {
  it('exposes SqliteRunStore', () => {
    const store = new SqliteRunStore(':memory:');
    expect(store).toBeInstanceOf(SqliteRunStore);
    store.close();
  });
});
