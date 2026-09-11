import { computeMetrics } from '../src/lib/layout';

/**
 * Common Android widths in dp. 360 is by far the most common (Pixel, Galaxy A
 * series); 320 covers older/budget phones; 280 approximates split-screen.
 */
const DEVICE_WIDTHS = [280, 320, 360, 384, 392, 412, 428, 600, 800];

/**
 * Width the prayer name needs at the default font scale:
 * "Maghrib" (~62dp at 15px bold) + "المغرب" (~48dp at 13px) + spacing.
 */
const NAME_MIN_DP = 110;

describe('computeMetrics - name column has room (regression)', () => {
  // The original two-column layout left ~74dp for the name at 360dp, so the
  // prayer name and its time rendered on top of each other. Every supported
  // width must now leave a readable name column.
  it.each(DEVICE_WIDTHS)('leaves a readable name column at %idp, scale 1', (width) => {
    const m = computeMetrics(width, 1);
    expect(m.nameRoom).toBeGreaterThanOrEqual(NAME_MIN_DP);
  });

  it.each(DEVICE_WIDTHS)('still leaves room at %idp with 1.5x system font', (width) => {
    const m = computeMetrics(width, 1.5);
    expect(m.nameRoom).toBeGreaterThanOrEqual(90);
  });

  it('never returns a negative name column, even at the extremes', () => {
    for (const width of [240, 280, 320, 360]) {
      for (const scale of [1, 1.3, 1.6, 2, 3]) {
        expect(computeMetrics(width, scale).nameRoom).toBeGreaterThan(0);
      }
    }
  });
});

describe('computeMetrics - breakpoints', () => {
  it('flags narrow screens as tiny and tightens padding', () => {
    const small = computeMetrics(320, 1);
    const normal = computeMetrics(360, 1);

    expect(small.tiny).toBe(true);
    expect(normal.tiny).toBe(false);
    expect(small.pagePadding).toBeLessThan(normal.pagePadding);
    expect(small.slotWidth).toBeLessThan(normal.slotWidth);
  });

  it('flags tablets as wide', () => {
    expect(computeMetrics(412, 1).wide).toBe(false);
    expect(computeMetrics(600, 1).wide).toBe(true);
    expect(computeMetrics(800, 1).wide).toBe(true);
  });
});

describe('computeMetrics - system font scaling', () => {
  it('grows the fixed-size checkbox and slot as text grows', () => {
    const base = computeMetrics(360, 1);
    const large = computeMetrics(360, 1.3);

    expect(large.boxSize).toBeGreaterThan(base.boxSize);
    expect(large.slotWidth).toBeGreaterThan(base.slotWidth);
  });

  it('caps that growth so a 2x font setting cannot eat the row', () => {
    const capped = computeMetrics(360, 1.3);
    const huge = computeMetrics(360, 2);

    expect(huge.slotWidth).toBe(capped.slotWidth);
    expect(huge.boxSize).toBe(computeMetrics(360, 1.35).boxSize);
  });

  it('drops optional detail once text is scaled far up', () => {
    const normal = computeMetrics(360, 1);
    const huge = computeMetrics(360, 1.8);

    expect(normal.dense).toBe(false);
    expect(normal.showArabic).toBe(true);
    expect(normal.showStamp).toBe(true);

    expect(huge.dense).toBe(true);
    expect(huge.showArabic).toBe(false);
    expect(huge.showStamp).toBe(false);
  });

  // Regression: the `dense` threshold used to be a fixed 110dp, so at 1.3x-1.5x
  // the Arabic name was still rendered even though it no longer fit, and it
  // collided with the checkbox column.
  it('hides the Arabic name as soon as the scaled name outgrows its column', () => {
    for (const scale of [1.25, 1.3, 1.4, 1.5, 1.75, 2]) {
      const m = computeMetrics(360, scale);
      if (m.showArabic) {
        // If we still show it, it must genuinely fit.
        expect(m.nameRoom).toBeGreaterThanOrEqual(Math.round(112 * scale + 10));
      }
    }
    expect(computeMetrics(360, 1.3).showArabic).toBe(false);
    expect(computeMetrics(360, 1.5).showArabic).toBe(false);
  });

  it('keeps the inline name within its column at every supported size', () => {
    for (const width of DEVICE_WIDTHS) {
      for (const scale of [1, 1.15, 1.3, 1.5, 2]) {
        const m = computeMetrics(width, scale);
        if (m.showArabic) {
          expect(m.nameRoom).toBeGreaterThanOrEqual(Math.round(112 * scale + 10));
        }
      }
    }
  });

  it('stacks the banner headline when text is scaled up or the screen is narrow', () => {
    expect(computeMetrics(360, 1).stackBanner).toBe(false);
    expect(computeMetrics(360, 1.3).stackBanner).toBe(true);
    expect(computeMetrics(320, 1).stackBanner).toBe(true);
  });

  it('clamps a missing or nonsensical fontScale to a sane range', () => {
    expect(computeMetrics(360, 0).fontScale).toBe(1);
    expect(computeMetrics(360, Number.NaN).fontScale).toBe(1);
    expect(computeMetrics(360, -2).fontScale).toBe(1);
    expect(computeMetrics(360, 99).fontScale).toBe(2);
  });

  it('is monotonic: a larger font scale never shrinks the slots', () => {
    let previous = 0;
    for (const scale of [1, 1.1, 1.25, 1.5, 1.75, 2]) {
      const { slotWidth } = computeMetrics(360, scale);
      expect(slotWidth).toBeGreaterThanOrEqual(previous);
      previous = slotWidth;
    }
  });
});
