/**
 * Global + project config cascade: defaults <- ~/.pi/agent/<plugin>.json <- <cwd>/.pi/<plugin>.json.
 * The guard must still be on tomorrow for the session it was switched on for, so it is
 * persisted; session approvals do NOT live here (see `state.ts`).
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { DEFAULT_LOCALE, normalizeLocale, type Locale } from "./i18n.js";

export type Mode = "on" | "off";

export interface GuardConfig {
	mode: Mode;
	lang: Locale;
	/** Hard cap on lines handed to the orchestrator for one approved read. */
	maxLines: number;
	/** Hard cap on characters, because lines are not the real cost. */
	maxChars: number;
	/** A dismissed or timed-out dialog is a deny, so it needs a deadline. */
	timeoutMs: number;
}

export const DEFAULT_CONFIG: GuardConfig = {
	mode: "off",
	lang: DEFAULT_LOCALE,
	maxLines: 400,
	maxChars: 20_000,
	timeoutMs: 120_000,
};

export function globalConfigPath(): string {
	const base = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
	return join(base, "pi-orch-guard.json");
}

export function projectConfigPath(cwd: string): string {
	return join(cwd, ".pi", "pi-orch-guard.json");
}

function readOne(path: string): Partial<GuardConfig> {
	try {
		return JSON.parse(readFileSync(path, "utf8")) as Partial<GuardConfig>;
	} catch {
		return {};
	}
}

/** Missing or corrupt layers fall through; a bad file is never a crash. */
export function loadConfig(cwd?: string): GuardConfig {
	const global = readOne(globalConfigPath());
	const project = cwd ? readOne(projectConfigPath(cwd)) : {};
	const merged = { ...global, ...project };
	return {
		mode: merged.mode === "on" ? "on" : "off",
		lang: normalizeLocale(merged.lang),
		maxLines: positive(merged.maxLines, DEFAULT_CONFIG.maxLines),
		maxChars: positive(merged.maxChars, DEFAULT_CONFIG.maxChars),
		timeoutMs: positive(merged.timeoutMs, DEFAULT_CONFIG.timeoutMs),
	};
}

/** `--global` writes the personal layer; without it the project's layer is written. */
export function saveConfig(config: GuardConfig, isGlobal: boolean, cwd?: string): string {
	const path = isGlobal || !cwd ? globalConfigPath() : projectConfigPath(cwd);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
	return path;
}

function positive(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}