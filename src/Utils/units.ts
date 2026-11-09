// Download sizes and speeds in the player's language. The scripts write them
// the French way ("5,7 / 13,3 Go · 102 Mo/s"), the Xbox engine already in
// the Steam language: rewrite any of them at display time, same rules as the
// Xbox engine (xbox.py STEPS) so every store reads the same.
export type UnitLocale = "en" | "fr" | "de" | "es" | "it" | "pt" | "nl" | "pl" | "ru";

interface UnitStyle { dec: string; kb: string; mb: string; gb: string; perSec: string }

const LATIN = { kb: "KB", mb: "MB", gb: "GB", perSec: "/s" };
const STYLES: Record<UnitLocale, UnitStyle> = {
    en: { dec: ".", ...LATIN },
    fr: { dec: ",", kb: "Ko", mb: "Mo", gb: "Go", perSec: "/s" },
    de: { dec: ",", ...LATIN },
    es: { dec: ",", ...LATIN },
    it: { dec: ",", ...LATIN },
    pt: { dec: ",", ...LATIN },
    nl: { dec: ",", ...LATIN },
    pl: { dec: ",", ...LATIN },
    ru: { dec: ",", kb: "КБ", mb: "МБ", gb: "ГБ", perSec: "/с" },
};

const style = (locale: string): UnitStyle => STYLES[locale as UnitLocale] ?? STYLES.en;

// Every spelling the stores and our scripts write, by size.
const UNIT = "Ko|KB|KiB|КБ|Mo|MB|MiB|МБ|Go|GB|GiB|ГБ";
const kind = (u: string) => /^(Ko|KB|KiB|КБ)$/i.test(u) ? "kb" : /^(Mo|MB|MiB|МБ)$/i.test(u) ? "mb" : "gb";
const num = (s: string) => parseFloat(s.replace(",", "."));

// "12,6 / 120,1 Go", "1.5 GB", "48 Mo/s"... A number, optionally "/ number",
// then a unit not followed by another letter (so "Mode" is left alone).
const AMOUNT = new RegExp(`(\\d+(?:[.,]\\d+)?)(\\s*\\/\\s*(\\d+(?:[.,]\\d+)?))?(\\s*)(${UNIT})(\\/[sс])?(?![A-Za-zА-Яа-я])`, "g");

const decimal = (n: string, s: UnitStyle) => n.replace(/[.,]/, s.dec);

export function localizeUnits(text: string, locale: string): string {
    if (!text) return text;
    const s = style(locale);
    return text.replace(AMOUNT, (_m, a, slash, b, space, unit, rate) => {
        const name = s[kind(unit)] + (rate ? s.perSec : "");
        const second = slash ? slash.replace(b, decimal(b, s)) : "";
        return `${decimal(a, s)}${second}${space}${name}`;
    });
}

export function formatRate(mbPerSec: number, locale: string, digits = 1): string {
    const s = style(locale);
    return `${mbPerSec.toFixed(digits).replace(".", s.dec)} ${s.mb}${s.perSec}`;
}

// Speed (MB/s) and amount from a progress text, whatever language wrote it.
export function parseDesc(desc: string, locale: string) {
    const plain = (desc || "").replace(/<[^>]+>/g, " ");
    const sp = plain.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${UNIT})\\/[sс]`, "i"));
    const speed = sp ? num(sp[1]) * (kind(sp[2]) === "gb" ? 1024 : kind(sp[2]) === "kb" ? 1 / 1024 : 1) : null;
    const am = plain.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${UNIT})?\\s*\\/\\s*(\\d+(?:[.,]\\d+)?)\\s*(${UNIT})(?!\\/)`, "i"));
    // Both sides with their unit, like Steam ("28,8 Go / 120,1 Go").
    const amount = am ? localizeUnits(`${am[1]} ${am[2] || am[4]} / ${am[3]} ${am[4]}`, locale) : null;
    const eta = plain.match(/~\s*([\d]+\s*(?:min|h|s)[^·]*)/i);
    return { speed, amount, eta: eta ? eta[1].trim() : null };
}

// Size on disk: one decimal in GB, whole MB below.
export function formatSize(bytes: number, locale: string): string {
    const s = style(locale);
    return bytes >= 1 << 30 ? `${(bytes / (1 << 30)).toFixed(1).replace(".", s.dec)} ${s.gb}`
        : `${Math.max(1, Math.round(bytes / (1 << 20)))} ${s.mb}`;
}
