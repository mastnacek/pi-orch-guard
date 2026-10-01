/**
 * Shared state kernel for pi-orch-guard.
 * Slices never import each other; they read and mutate this object.
 */

import { DEFAULT_CONFIG, type GuardConfig } from "./config.js";
import type { Locale } from "./i18n.js";

export interface DenyRecord {
	tool: string;
	intent: string;
	target: string;
	reason: string;
	at: number;
}

export interface PluginState {
	config: GuardConfig;
	/** Paths already approved this session, so plain `read` of them stops asking. */
	sessionGrants: Set<string>;
	readRequests: number;
	approvedReads: number;
	blockedWrites: number;
	history: DenyRecord[];
}

export function createInitialState(config: GuardConfig = DEFAULT_CONFIG): PluginState {
	return {
		config,
		sessionGrants: new Set(),
		readRequests: 0,
		approvedReads: 0,
		blockedWrites: 0,
		history: [],
	};
}

/** Grants are per path, case-insensitive — Windows paths are not case-stable. */
export function pathGrantKey(path: string): string {
	return path.replace(/\\/g, "/").toLowerCase();
}

export function isGranted(state: PluginState, path: string): boolean {
	return state.sessionGrants.has(pathGrantKey(path));
}

export function grantPath(state: PluginState, path: string): void {
	state.sessionGrants.add(pathGrantKey(path));
}

export function recordDeny(state: PluginState, record: Omit<DenyRecord, "at">): void {
	state.history.unshift({ ...record, at: Date.now() });
	if (state.history.length > 50) state.history.length = 50;
}

export function lang(state: PluginState): Locale {
	return state.config.lang;
}