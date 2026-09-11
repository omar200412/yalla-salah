/**
 * Pure layout maths - deliberately free of any React or React Native import so
 * it can be unit-tested directly. The hook that feeds it live device
 * dimensions lives in `useMetrics.ts`.
 *
 * Size tokens for the dashboard, derived from the device width and the user's
 * system font-size setting.
 *
 * React Native already multiplies every `fontSize` by the system `fontScale`,
 * so we deliberately do NOT shrink type to fight that - that would defeat the
 * accessibility setting. Instead we grow the fixed-size boxes alongside it and
 * drop optional detail once the row genuinely runs out of room.
 */
export type Metrics = {
  width: number;
  fontScale: number;
  /** Very narrow: small/old phones, split-screen. */
  tiny: boolean;
  /** Tablet or landscape - extra breathing room. */
  wide: boolean;
  /** Row is tight enough that optional detail must go. */
  dense: boolean;
  /** Render the Arabic name beside the English one. */
  showArabic: boolean;
  /** Render the small completion-time stamp under each checkbox. */
  showStamp: boolean;
  /** Stack the banner headline above the countdown instead of side by side. */
  stackBanner: boolean;
  pagePadding: number;
  cardPadding: number;
  rowPaddingH: number;
  rowPaddingV: number;
  columnGap: number;
  rowGap: number;
  slotWidth: number;
  boxSize: number;
  checkFontSize: number;
  bannerTitleSize: number;
  /** Width left for the prayer name after padding and both slots. */
  nameRoom: number;
};

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(value, lo), hi);
}

export function computeMetrics(width: number, fontScale: number): Metrics {
  const fs = clamp(Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1, 1, 2);
  const tiny = width < 340;
  const wide = width >= 600;

  const pagePadding = tiny ? 12 : 16;
  const cardPadding = tiny ? 10 : 12;
  const rowPaddingH = tiny ? 10 : 12;
  const columnGap = tiny ? 6 : 10;

  // Fixed-size views do not scale with the system font setting, so grow them by
  // hand - capped, so a 2x font setting does not eat the whole row.
  const boxSize = Math.round((tiny ? 26 : 30) * clamp(fs, 1, 1.35));
  const slotWidth = Math.round((tiny ? 40 : 46) * clamp(fs, 1, 1.3));

  const nameRoom =
    width -
    pagePadding * 2 -
    cardPadding * 2 -
    rowPaddingH * 2 -
    slotWidth * 2 -
    columnGap * 3;

  // Width "Maghrib  المغرب" needs on one line. Both halves are real text, so
  // this requirement grows with the system font scale - comparing `nameRoom`
  // against a fixed number would keep the Arabic visible at 1.3x-1.5x, where it
  // no longer fits and collides with the checkbox column.
  const inlineNameNeed = Math.round(112 * fs + 10);
  const dense = nameRoom < inlineNameNeed;

  return {
    width,
    fontScale: fs,
    tiny,
    wide,
    dense,
    showArabic: !dense,
    showStamp: !dense && fs < 1.35,
    stackBanner: tiny || fs >= 1.3,
    pagePadding,
    cardPadding,
    rowPaddingH,
    rowPaddingV: tiny ? 9 : 11,
    columnGap,
    rowGap: tiny ? 6 : 8,
    slotWidth,
    boxSize,
    checkFontSize: Math.round(boxSize * 0.55),
    bannerTitleSize: tiny ? 22 : 26,
    nameRoom,
  };
}
