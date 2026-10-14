// World registry. Each world module exports a definition with track, bounds, lighting and build(kit).
import breakfast from './breakfast.js';
import desk from './desk.js';
import pool from './pool.js';
import garden from './garden.js';
import workshop from './workshop.js';
import mars from './mars.js';
import watertable from './watertable.js';
import pinball from './pinball.js';
import railway from './railway.js';
import bathroom from './bathroom.js';
import gingerbread from './gingerbread.js';
import toybox from './toybox.js';
import boardroom from './boardroom.js';
import watchmaker from './watchmaker.js';
import dollhouse from './dollhouse.js';
import chemlab from './chemlab.js';

const ALL = [breakfast, desk, pool, garden, workshop, mars, watertable, pinball, railway, bathroom, gingerbread, toybox, boardroom, watchmaker, dollhouse, chemlab];
// Worlds still under construction can be listed here: they stay out of the menu but load with ?world=<id>.
const IN_PROGRESS = new Set(['watchmaker', 'dollhouse', 'chemlab']);
export const WORLDS = ALL.filter((w) => !IN_PROGRESS.has(w.id));
export function worldById(id) { return ALL.find((w) => w.id === id) || WORLDS[0]; }
