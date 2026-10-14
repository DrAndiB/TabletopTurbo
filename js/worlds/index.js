// World registry. Each world module exports a definition with track, bounds, lighting and build(kit).
import breakfast from './breakfast.js';
import desk from './desk.js';
import pool from './pool.js';
import garden from './garden.js';
import workshop from './workshop.js';

// Beta: pool and workshop are still stubs, so they are left out of the menu for now.
export const WORLDS = [breakfast, desk, garden];
void pool; void workshop;
export function worldById(id) { return WORLDS.find((w) => w.id === id) || WORLDS[0]; }
