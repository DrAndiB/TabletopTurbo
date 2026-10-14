// World registry. Each world module exports a definition with track, bounds, lighting and build(kit).
import breakfast from './breakfast.js';
import desk from './desk.js';
import pool from './pool.js';
import garden from './garden.js';
import workshop from './workshop.js';
import mars from './mars.js';

const ALL = [breakfast, desk, pool, garden, workshop, mars];
// Worlds still under construction can be listed here: they stay out of the menu but load with ?world=<id>.
const IN_PROGRESS = new Set([]);
export const WORLDS = ALL.filter((w) => !IN_PROGRESS.has(w.id));
export function worldById(id) { return ALL.find((w) => w.id === id) || WORLDS[0]; }
