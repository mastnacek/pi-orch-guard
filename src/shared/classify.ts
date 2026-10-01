/**
 * What a tool call wants to touch, reduced to three answers.
 *
 * This is the whole policy in one pure function: no I/O, no state, no engine
 * types — which is why it is the one file here worth testing hard.
 *
 * `read`   source is about to enter the orchestrator's context -> needs a human
 * `write`  the filesystem is about to change -> never allowed while guarded
 * `neutral` neither: running tests, asking a child agent, reading a structure map
 */

export type Intent = "read" | "write" | "neutral";

export interface Call {
	tool: string;
	intent: Intent;
	/** One line the user can judge at a glance in a modal title. */
	target: string;
}

/**
 * Tools that move file CONTENT into the model's context. Every one of these
 * costs the orchestrator tokens it cannot spend on thinking, so every one
 * needs a human to say yes first.
 */
const READ_TOOLS = new Set([
	"read",
	"read_all",
	"grep",
	"read_symbol",
	"read_enclosing",
	"fetch_content",
	"get_search_content",
	"lotusscript_lsp_lsp_hover",
	"lotusscript_lsp_lsp_completion",
	"lotusscript_lsp_lsp_definition",
	"lotusscript_lsp_lsp_references",
	"lotusscript_lsp_lsp_format",
]);

/**
 * Tools that return NAMES and COUNTS, not content: the structural tier the
 * orchestrator is supposed to exhaust before it asks for anything. Stays
 * neutral, so the tier-1-first protocol costs the user nothing.
 */
const MAP_TOOLS = new Set([
	"glob",
	"find",
	"ls",
	"symbol_search",
	"module_report",
	"project_report",
	"effective_config",
	"lens_diagnostics",
	"lotusscript_lsp_lsp_diagnostics",
	"lotusscript_lsp_lsp_symbols",
	"lotusscript_lsp_lsp_workspace_symbols",
]);

/** Tools that change the filesystem. A guarded orchestrator never runs these. */
const WRITE_TOOLS = new Set([
	"edit",
	"write",
	"apply_patch",
	"multi_edit",
	"notebook_edit",
]);

/**
 * `bash` is neutral by default — the orchestrator still runs tests and git.
 * These two patterns are the whole shell-shaped hole in the table.
 * ponytail: no redirect detection and no shell parsing; `>` and `$(…)` still
 * bypass this. It buys visibility, not a sandbox.
 */
const SHELL_READ = /\b(cat|head|tail|less|more|type|Get-Content|strings)\b/;
const SHELL_WRITE =
	/\b(rm|mv|cp|mkdir|rmdir|touch|tee|chmod|chown|truncate|install|git\s+(add|commit|push|checkout|switch|reset|clean|merge|rebase|apply|stash))\b/;

/** Keep every modal title inside one terminal line. */
const MAX_TARGET = 120;

function firstString(input: unknown, keys: string[]): string | undefined {
	if (!input || typeof input !== "object") return undefined;
	const record = input as Record<string, unknown>;
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string" && value.trim().length > 0) return value.trim();
	}
	return undefined;
}

function target(tool: string, input: unknown): string {
	const path = firstString(input, ["path", "paths", "file", "filePath"]);
	const pattern = firstString(input, ["pattern", "query", "search"]);
	const line = firstString(input, ["command", "cmd"]);

	if (tool === "bash") return line ?? "(no command)";
	if (path && pattern) return `${path} ← ${pattern}`;
	if (path) return path;
	if (pattern) return pattern;
	return tool;
}

function clip(value: string): string {
	return value.length > MAX_TARGET ? `${value.slice(0, MAX_TARGET - 1)}…` : value;
}

/** Classify one tool call. Unknown tools are neutral: deny by omission, not by guess. */
export function classify(tool: string, input: unknown): Call {
	let intent: Intent = "neutral";

	if (MAP_TOOLS.has(tool)) {
		intent = "neutral";
	} else if (READ_TOOLS.has(tool)) {
		intent = "read";
	} else if (WRITE_TOOLS.has(tool)) {
		intent = "write";
	} else if (tool === "bash") {
		const command = firstString(input, ["command", "cmd"]) ?? "";
		if (SHELL_WRITE.test(command)) intent = "write";
		else if (SHELL_READ.test(command)) intent = "read";
	}

	const label = clip(target(tool, input));
	return { tool, intent, target: label };
}

/** Line span for a read, so the modal can say *which part* of a long file. */
export function readSpan(input: unknown): string | undefined {
	const offset = firstString(input, ["offset"]);
	const limit = firstString(input, ["limit"]);
	if (offset && limit) return `lines ${offset}–${Number(offset) + Number(limit)}`;
	if (offset) return `from line ${offset}`;
	if (limit) return `first ${limit} lines`;
	return undefined;
}