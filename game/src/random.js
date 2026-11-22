// A tiny seeded random generator (mulberry32) so the screenshot scenes and the
// playtests are reproducible: the same seed always deals the same night.
export function makeRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a number in [min, max) from a seeded generator. */
export function range(random, min, max) {
  return min + random() * (max - min);
}
