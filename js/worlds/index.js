// World registry. Each world module exports a definition with track, bounds, lighting and build(kit).
import breakfast from './breakfast.js';
import desk from './desk.js';
import pool from './pool.js';
import garden from './garden.js';
import workshop from './workshop.js';

export const WORLDS = [breakfast, desk, pool, garden, workshop];
export function worldById(id) { return WORLDS.find((w) => w.id === id) || WORLDS[0]; }
