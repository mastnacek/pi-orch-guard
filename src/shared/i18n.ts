/**
 * One table per locale, one lookup, no environment sniffing (Windows has no
 * LANG). The persisted `lang` setting is the only source of truth.
 *
 *   - what the USER reads lives here;
 *   - what the MODEL reads (tool description, tool result, block reasons)
 *     stays English — the agent is the one being instructed.
 */

export const LOCALES = ["en", "cs"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export interface GuardStrings {
	title: string;
	/** `/orch-guard status` answer. */
	status: (mode: string, reads: number, writes: number) => string;
	/** Footer/statusline text. */
	statusShort: (approved: number, blocked: number) => string;
	/** Dialog options, in order. Index 0 is the highlighted default. */
	deny: string;
	allowOnce: string;
	allowSession: string;
	/** Dialog title for an approved-read request. */
	modal: (tool: string, target: string, span: string | undefined, reason: string) => string;
	/** Asked when the model reads raw instead of requesting. */
	rawReadTitle: (tool: string, target: string) => string;
	writeBlockedTitle: (tool: string, target: string) => string;
	headlessNotice: string;
	langDesc: string;
}

const STRINGS: Record<Locale, GuardStrings> = {
	en: {
		title: "pi-orch-guard",
		status: (mode, reads, writes) =>
			`orchestrator guard ${mode === "guard" ? "ON" : "off"} · ${reads} read(s) approved · ${writes} write(s) blocked`,
		statusShort: (approved, blocked) => `orch-guard · ${approved} approved · ${blocked} write(s) blocked`,
		deny: "Deny — keep working from briefs (default)",
		allowOnce: "Allow this read",
		allowSession: "Allow this file for the rest of the session",
		modal: (tool, target, span, reason) =>
			`${tool} wants to read\n  ${target}${span ? `\n  ${span}` : ""}\n\nReason given:\n  ${reason}`,
		rawReadTitle: (tool, target) =>
			`${tool} is not an approved route.\n\n  ${target}\n\nThe guard requires a stated reason before source enters the orchestrator's context.`,
		writeBlockedTitle: (tool, target) =>
			`${tool} would change\n  ${target}\n\nA guarded orchestrator decides; a worker edits.`,
		headlessNotice: "No UI to ask — denied.",
		langDesc: "UI language",
	},
	cs: {
		title: "pi-orch-guard",
		status: (mode, reads, writes) =>
			`stráž orchestrátoru ${mode === "guard" ? "ZAPNUTA" : "vypnuta"} · ${reads} čtení schváleno · ${writes} zápisů zablokováno`,
		statusShort: (approved, blocked) => `orch-guard · ${approved} schváleno · ${blocked} zápisů zablokováno`,
		deny: "Odmítnout — pracovat dál z briefů (výchozí)",
		allowOnce: "Povolit toto čtení",
		allowSession: "Povolit tento file na celou relaci",
		modal: (tool, target, span, reason) =>
			`${tool} chce číst\n  ${target}${span ? `\n  ${span}` : ""}\n\nUvedený důvod:\n  ${reason}`,
		rawReadTitle: (tool, target) =>
			`${tool} není schválená cesta.\n\n  ${target}\n\nStráž vyžaduje uvedený důvod, než zdroj vstoupí do kontextu orchestrátoru.`,
		writeBlockedTitle: (tool, target) =>
			`${tool} by změnil\n  ${target}\n\nStrážený orchestrátor rozhoduje, pracovník edituje.`,
		headlessNotice: "Není UI, na které by se dalo zeptat — zamítnuto.",
		langDesc: "Jazyk uživatelského rozhraní",
	},
};

/** The table for a locale; anything unknown falls back to the default. */
export function stringsFor(locale: string | undefined): GuardStrings {
	return STRINGS[normalizeLocale(locale)];
}

/** Accept the obvious spellings; a typo is English, never a crash. */
export function normalizeLocale(raw: string | undefined): Locale {
	const token = (raw ?? "").trim().toLowerCase();
	if (token === "cs" || token === "cz" || token === "cze") return "cs";
	return DEFAULT_LOCALE;
}