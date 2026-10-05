// Art direction knobs for the cozy, smooth look: soft coloured outlines, gentle ground texture, flat (undithered) shading.
// Everything that draws sprites reads these, so the whole game's feel can be tuned in one place.
export const STYLE = {
  outline: 0.62, // multiplies how dark every sprite outline is (1 = the original near-black ink)
  groundNoise: 0.45, // multiplies how many speckles each ground tile gets
  groundContrast: 0.55, // how far speckles stray from the base colour (1 = the original contrast)
  waterContrast: 0.6, // how strongly waves and ripples stand out from the water colour (1 = the original)
  dither: 0, // checkerboard dither in the shading bands of round things (trees, bushes, rocks)
};
