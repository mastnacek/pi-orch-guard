/**
 * Tools slice for pi-orch-guard.
 *
 * The one sanctioned way for source to enter the orchestrator's context: the
 * model supplies the reason, the user sees it next to the exact target and
 * decides. Nothing here is clever — read the file, clip it, hand it back.
 *
 * Model-facing text (tool description, result text, deny reasons) stays English
 * in every locale — the agent is being instructed, the auditor exempts registerTool.
 */

import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { stringsFor } from "../../shared/i18n.js";
import { grantPath, recordDeny, type PluginState } from "../../shared/state.js";

const DENY = 0;
const ALLOW_ONCE = 1;
const ALLOW_SESSION = 2;

const DESCRIPTION =
	"Ask the user to approve reading one file, showing them your stated reason; returns content only if approved. " +
	"Before calling this, exhaust the structural tools (symbol_search, module_report, project_report, " +
	"lotusscript_lsp_lsp_diagnostics) — they cost nothing and often answer the question outright.";

const DENIED = "The user declined this read. The refusal covers the request, not just this call — do not retry through another tool or another spelling of the path. Answer from a structural tool, or dispatch a child agent that reads the body and returns a brief.";

interface Clip {
	body: string;
	clipped: boolean;
}

/** A clipped read must never look like a whole file. */
function clip(text: string, maxChars: number, maxLines: number): Clip {
	const lines = text.split("\n");
	const kept = lines.slice(0, maxLines);
	let body = kept.join("\n");
	let clipped = kept.length < lines.length;
	if (body.length > maxChars) {
		body = body.slice(0, maxChars);
		clipped = true;
	}
	return { body, clipped };
}

export function registerTools(pi: ExtensionAPI, state: PluginState): void {
	pi.registerTool({
		name: "request_read",
		label: "Request Read",
		description: DESCRIPTION,
		parameters: Type.Object({
			path: Type.String({ description: "File to read, relative to the project root or absolute" }),
			reason: Type.String({
				description: "Why you need the content, in one sentence. The user reads this verbatim.",
			}),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx: ExtensionContext) {
			const s = stringsFor(state.config.lang);

			// Guard off: behave like a plain read rather than inventing policy.
			if (state.config.mode !== "on") {
				return {
					content: [{ type: "text" as const, text: await readPlain(params.path) }],
					details: { approved: false, mode: "off" },
				};
			}

			state.readRequests++;
			if (!ctx.hasUI) {
				recordDeny(state, { tool: "request_read", intent: "read", target: params.path, reason: "no UI to ask" });
				return denyResult(s.headlessNotice, params.path);
			}

			const choice = await ctx.ui.select(s.modal("read", params.path, undefined, params.reason), [s.deny, s.allowOnce, s.allowSession], {
				timeout: state.config.timeoutMs,
			});

			const picked = choice === s.allowOnce ? ALLOW_ONCE : choice === s.allowSession ? ALLOW_SESSION : DENY;

			if (picked === DENY) {
				recordDeny(state, { tool: "request_read", intent: "read", target: params.path, reason: "user denied" });
				ctx.ui.setStatus("pi-orch-guard", s.statusShort(state.approvedReads, state.blockedWrites));
				return denyResult(DENIED, params.path);
			}

			if (picked === ALLOW_SESSION) grantPath(state, params.path);
			state.approvedReads++;

			const target = isAbsolute(params.path) ? params.path : resolve(ctx.cwd, params.path);
			let raw: string;
			try {
				raw = await readFile(target, "utf8");
			} catch (error) {
				return denyResult(`Could not read ${params.path}: ${(error as Error).message}`, params.path);
			}

			const { body, clipped } = clip(raw, state.config.maxChars, state.config.maxLines);
			ctx.ui.setStatus("pi-orch-guard", s.statusShort(state.approvedReads, state.blockedWrites));
			return {
				content: [
					{
						type: "text" as const,
						text: clipped
							? `${body}\n\n[truncated by pi-orch-guard at ${state.config.maxLines} lines / ${state.config.maxChars} chars — the file continues]`
							: body,
					},
				],
				details: { approved: true, target: params.path, truncated: clipped },
			};
		},
	});
}

function denyResult(message: string, path: string) {
	return {
		content: [{ type: "text" as const, text: `${message}\n(target: ${path})` }],
		isError: true as const,
		details: { approved: false, target: path },
	};
}

async function readPlain(path: string): Promise<string> {
	try {
		return await readFile(path, "utf8");
	} catch (error) {
		return `Could not read ${path}: ${(error as Error).message}`;
	}
}