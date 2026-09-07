/**
 * Turns the free-text `description` Yogo gives us into a fixed shape: at most one
 * short subtitle plus a few bullet lines. Without this the cards inherit whatever
 * the gym typed — one plan has an empty description, another has a headed list of
 * emoji-prefixed perks — and no two cards end up the same height.
 */

// Horizontal whitespace only: \s would swallow the newline and glue the next line
// onto this one, so a line dropped as noise would take its neighbour with it.
const POPULAR_MARKER = /\*?[ \t]*most[ \t]+popular[ \t]*:?/gi;
const LEADING_ORNAMENT = /^[\p{Extended_Pictographic}️‍\s\-–—•*]+/u;
/** Per-class claims typed by hand: duration-blind, and they contradict what we compute. */
const PER_CLASS_CLAIM = /por aula|por sess[ãa]o|per class|per session/i;

const MAX_SUBTITLE_CHARS = 90;
const MAX_BULLET_CHARS = 80;
const MAX_DESCRIPTION_BULLETS = 3;

export interface PlanContent {
  subtitle: string | null;
  bullets: string[];
}

export function stripLeadingOrnament(line: string): string {
  return line.replace(LEADING_ORNAMENT, "").trim();
}

/** Must run on the raw text: Hero carries its marker inside the description. */
export function isMostPopular(item: { name: string; description?: string }): boolean {
  return /most popular/i.test(`${item.name} ${item.description ?? ""}`);
}

/**
 * Drops the leading emoji, the popular marker and a short trailing parenthetical.
 * The parenthetical is almost always the class quota — "(12 passes)", "(UNLIMITED)" —
 * which the card now states in its eyebrow, and dropping it keeps every title on one
 * line so the price rows line up across the row.
 */
export function cleanPlanName(name: string): string {
  return stripLeadingOrnament(name.replace(/-?[ \t]*most popular/gi, ""))
    .replace(/\s*\([^)]{1,20}\)\s*$/, "")
    .trim();
}

function normalizeLine(line: string): string {
  let text = stripLeadingOrnament(line);
  // Yogo copy wraps the lead line in parentheses: "(Treina sem limites…)".
  const wrapped = text.match(/^\((.*)\)$/);
  if (wrapped) text = wrapped[1];
  return text.replace(/\s+/g, " ").trim();
}

/** A bare heading such as "VIP Perks:" carries no information on a compact card. */
function isSectionHeading(text: string): boolean {
  return text.endsWith(":") && text.split(" ").length <= 4;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const kept = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${kept.trimEnd()}…`;
}

export function derivePlanContent(
  description: string,
  opts: {
    maxBullets?: number;
    maxSubtitleChars?: number;
    maxBulletChars?: number;
  } = {}
): PlanContent {
  const maxBullets = opts.maxBullets ?? MAX_DESCRIPTION_BULLETS;
  const maxSubtitleChars = opts.maxSubtitleChars ?? MAX_SUBTITLE_CHARS;
  const maxBulletChars = opts.maxBulletChars ?? MAX_BULLET_CHARS;

  const lines = (description || "")
    .replace(/\r\n/g, "\n")
    .replace(POPULAR_MARKER, "")
    .split(/\n+/)
    .map(normalizeLine)
    .filter((text) => text.length > 0 && !isSectionHeading(text) && !PER_CLASS_CLAIM.test(text));

  if (!lines.length) return { subtitle: null, bullets: [] };

  const [lead, ...rest] = lines;
  const subtitleFits = lead.length <= maxSubtitleChars;

  return {
    subtitle: subtitleFits ? lead : null,
    bullets: (subtitleFits ? rest : lines)
      .slice(0, maxBullets)
      .map((text) => truncate(text, maxBulletChars)),
  };
}
