/**
 * Brand colour helpers.
 *
 * The brand colour is entered through a free-text field as well as a colour
 * picker, so anything can end up in the column: empty strings, "purple",
 * half-typed hex, or a value crafted to break out of a style attribute. Every
 * read path goes through `normalizeBrandColor` so the raw value is never
 * interpolated into CSS.
 */

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Returns a safe `#rrggbb` string, or null when the value is unusable. */
export function normalizeBrandColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!HEX.test(v)) return null;
  if (v.length === 4) {
    // Expand #abc so callers can always assume six digits.
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase();
  }
  return v.toLowerCase();
}

/** The same colour at a given opacity, for tints and borders. */
export function brandTint(value: string | null | undefined, alpha: number): string | null {
  const hex = normalizeBrandColor(value);
  if (!hex) return null;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Whether white text is legible on this colour.
 *
 * Uses the WCAG relative-luminance formula rather than a naive average, since
 * a mid green and a mid blue have very different perceived brightness.
 */
export function isDarkBrandColor(value: string | null | undefined): boolean {
  const hex = normalizeBrandColor(value);
  if (!hex) return false;
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(hex.slice(1, 3), 16));
  const g = channel(parseInt(hex.slice(3, 5), 16));
  const b = channel(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5;
}
