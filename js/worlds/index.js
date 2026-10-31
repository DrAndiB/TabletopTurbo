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
import moselle from './moselle.js';
import fouer from './fouer.js';
import grund from './grund.js';
import oldtown from './oldtown.js';
import butter from './butter.js';
import pass from './pass.js';
import bowling from './bowling.js';
import rooftop from './rooftop.js';
import sushi from './sushi.js';
import vinyl from './vinyl.js';
import stage from './stage.js';
import volcano from './volcano.js';
import giza from './giza.js';
import nile from './nile.js';
import tomb from './tomb.js';
import valley from './valley.js';

// Cups of four tables, easiest cup first and easiest table first within each cup (Mario Kart style).
// `level` (1-4) is the difficulty shown in the menu, `color` the cup's accent. Worlds that are not in
// WORLDS (still under construction) are skipped wherever cups are used, so a cup simply shows fewer
// tables until they are done.
export const CUPS = [
  { id: 'crumb', name: 'Crumb Cup', level: 1, color: '#2fae5a', blurb: 'Easy rides for warming up', worlds: ['breakfast', 'garden', 'gingerbread', 'toybox'] },
  { id: 'doodle', name: 'Doodle Cup', level: 2, color: '#2f6fe0', blurb: 'Slippery and splashy', worlds: ['desk', 'bathroom', 'pool', 'watertable'] },
  { id: 'turbo', name: 'Turbo Cup', level: 3, color: '#f07b1d', blurb: 'Jumps, trains and tight bends', worlds: ['workshop', 'boardroom', 'mars', 'railway'] },
  { id: 'chaos', name: 'Chaos Cup', level: 4, color: '#8a4fd8', blurb: 'For experts only', worlds: ['pinball', 'chemlab', 'dollhouse', 'watchmaker'] },
  // a tour of Luxembourg, easy to expert within the cup
  { id: 'duchy', name: 'Grand Duchy Cup', level: 3, color: '#00a1de', blurb: 'A tour of Luxembourg, easy to expert', worlds: ['moselle', 'fouer', 'grund', 'oldtown'] },
  // drift cars only: tap the brake while steering to slide, hold the slide to charge a boost
  { id: 'drift', name: 'Drift Cup', level: 3, color: '#e8337a', blurb: 'Slide sideways, charge sparks, boost out', worlds: ['butter', 'pass', 'bowling', 'rooftop'] },
  // the moving-floor cup: conveyor belts, spinning decks, trapdoors and lava
  { id: 'mayhem', name: 'Mayhem Cup', level: 4, color: '#ff5a1f', blurb: 'Moving floors, spinning decks, trapdoors and lava', worlds: ['sushi', 'vinyl', 'stage', 'volcano'] },
  // ancient Egypt, easy to expert: a Giza sandpit, the Nile, inside a pyramid and a sandstorm in the valley
  { id: 'egypt', name: 'Pharaoh Cup', level: 3, color: '#d9a21b', blurb: 'Sand, the Nile and a pharaoh\'s tomb', worlds: ['giza', 'nile', 'tomb', 'valley'] },
];

// menu order = cup order (also the order of the "Grand Tour" championship)
const ALL = [
  breakfast, garden, gingerbread, toybox,
  desk, bathroom, pool, watertable,
  workshop, boardroom, mars, railway,
  pinball, chemlab, dollhouse, watchmaker,
  moselle, fouer, grund, oldtown,
  butter, pass, bowling, rooftop,
  sushi, vinyl, stage, volcano,
  giza, nile, tomb, valley,
];
// Worlds still under construction can be listed here: they stay out of the menu but load with ?world=<id>.
const IN_PROGRESS = new Set([]);
export const WORLDS = ALL.filter((w) => !IN_PROGRESS.has(w.id));
export function worldById(id) { return ALL.find((w) => w.id === id) || WORLDS[0]; }
// the playable tables of a cup, in cup order
export function cupWorlds(cup) { return cup ? cup.worlds.map((id) => WORLDS.find((w) => w.id === id)).filter(Boolean) : []; }
export function cupById(id) { return CUPS.find((c) => c.id === id) || null; }
