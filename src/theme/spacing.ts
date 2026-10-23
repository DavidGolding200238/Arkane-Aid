// Spacing and corner radius tokens, in Figma units (360-wide design).
// Pass them through `s()` from ./scale when laying out a screen.
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const radius = {
  panel: 5, // parchment panels and cards
  stat: 2, // stat box headers
  button: 8,
  pill: 999,
} as const;

export const stroke = {
  hairline: 1, // panel and card borders, rules
  portrait: 3, // old smooth portrait ring; Ledger now uses the inked outline art
} as const;
