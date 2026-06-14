/**
 * A-FORGE TUI Theme — Federation Colors & Style Constants
 *
 * F9 ANTI-HANTU: These are visual constants, not behavioral rules.
 * Colors follow the federation palette: forge orange, amanah green, hold red.
 */

export const THEME = {
  // Federation palette
  colors: {
    forge: "\x1b[38;5;208m",     // orange — A-FORGE primary
    amanah: "\x1b[38;5;77m",     // green — F1 AMANAH
    gold: "\x1b[38;5;220m",      // gold — sovereign/SEAL
    crimson: "\x1b[38;5;196m",   // red — HOLD/error
    blue: "\x1b[38;5;39m",       // blue — info/link
    dim: "\x1b[38;5;240m",       // gray — secondary
    white: "\x1b[38;5;255m",     // white — text
    yellow: "\x1b[38;5;184m",    // yellow — warning
    magenta: "\x1b[38;5;200m",   // magenta — special
  },

  // Blessed widget styles
  styles: {
    header: { fg: 208, bg: 0, border: { fg: 208 } },      // forge orange
    success: { fg: 77, bg: 0, border: { fg: 77 } },       // amanah green
    warning: { fg: 184, bg: 0, border: { fg: 184 } },     // yellow
    error: { fg: 196, bg: 0, border: { fg: 196 } },       // red
    info: { fg: 39, bg: 0, border: { fg: 39 } },          // blue
    dim: { fg: 240, bg: 0, border: { fg: 240 } },         // gray
    gold: { fg: 220, bg: 0, border: { fg: 220 } },        // gold
  },

  // Blessed widget style variants
  table: {
    header: { fg: 208, bg: 236, bold: true },
    cell: { fg: 255, bg: 0 },
    selected: { fg: 0, bg: 208 },
  },

  // Layout dimensions
  layout: {
    headerRows: 1,
    jobsRows: 6,
    govRows: 6,
    logRows: 4,
    footerRows: 1,
    totalRows: 12,
    cols: 12,
    jobsCols: 8,
    govCols: 4,
  },
} as const;

export type FederationColor = keyof typeof THEME.colors;
