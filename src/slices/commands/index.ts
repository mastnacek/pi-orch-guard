/**
 * Commands slice for pi-orch-guard.
 *
 * `/orch-guard on|off|status [--global]` — one switch, because the guard must be
 * trivially reversible. Without `--global` the setting lands in the project's
 * `.pi/pi-orch-guard.json`, so a repo can require the guard for everyone.
 * `lang` is non-terminal: it opens its own value level (Trailing Space Contract).
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { LOCALES, normalizeLocale, stringsFor, type Locale } from "../../shared/i18n.js";
import { saveConfig, type Mode } from "../../shared/config.js";
import type { PluginState } from "../../shared/state.js";

const MODE_HELP: Record<Mode | "status", string> = {
	on: "Block writes, ask before every read",
	off: "No enforcement",
	status: "Show counters",
};

export function registerCommands(pi: ExtensionAPI, state: PluginState): void {
	pi.registerCommand("orch-guard", {
		getArgumentCompletions: (prefix: string) => completions(prefix, state.config.lang),
		handler: async (args: string, ctx: ExtensionCommandContext) => {
			const s = stringsFor(state.config.lang);
			const isGlobal = /(^|\s)--global(\s|$)/.test(args);
			const tokens = args.trim().split(/\s+/).filter((t) => t !== "--global");
			const sub = (tokens[0] ?? "status").toLowerCase();

			if (sub === "lang") {
				const requested = tokens[1]?.toLowerCase();
				if (!requested || !(LOCALES as readonly string[]).includes(requested)) {
					if (ctx.hasUI) ctx.ui.notify(`Usage: /orch-guard lang <${LOCALES.join("|")}>`, "warning");
					return;
				}
				state.config.lang = normalizeLocale(requested);
				saveConfig(state.config, isGlobal, ctx.cwd);
				if (ctx.hasUI) ctx.ui.notify(`${s.title}: ${state.config.lang}`, "info");
				return;
			}

			if (sub === "on" || sub === "off") {
				state.config.mode = sub;
				saveConfig(state.config, isGlobal, ctx.cwd);
				if (ctx.hasUI) ctx.ui.setStatus("pi-orch-guard", s.statusShort(state.approvedReads, state.blockedWrites));
				return;
			}

			if (!ctx.hasUI) return;
			ctx.ui.notify(s.status(state.config.mode, state.approvedReads, state.blockedWrites), "info");
		},
	});
}

function completions(prefix: string, lang: Locale): { value: string; label: string; description: string }[] | null {
	const text = prefix.trimStart();
	const head = text.split(/\s+/)[0]?.toLowerCase() ?? "";
	const s = stringsFor(lang);

	if (head === "lang") {
		const typed = text.slice("lang".length).trim().toLowerCase();
		const rows = LOCALES.map((locale) => ({
			value: `lang ${locale}`,
			label: lang === locale ? `${locale} ✓` : locale,
			description: `${s.langDesc}${lang === locale ? " · ● AKTIVNÍ" : ""}`,
		})).filter((row) => row.value.toLowerCase().startsWith(`lang ${typed}`));
		return rows.length > 0 ? rows : null;
	}

	if (head === "on" || head === "off") {
		return [{ value: head, label: head, description: MODE_HELP[head as Mode] }];
	}
	if (head === "status") return null;

	if (head !== "" && !["on", "off", "status", "lang"].some((m) => m.startsWith(head))) return null;
	return [
		// `on` and `off` are terminal modes; `lang ` takes a value, so it keeps the space.
		{ value: "on", label: "on", description: MODE_HELP.on },
		{ value: "off", label: "off", description: MODE_HELP.off },
		{ value: "status", label: "status", description: MODE_HELP.status },
		{ value: "lang ", label: "lang", description: s.langDesc },
	];
}