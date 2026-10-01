/**
 * The enforcement hook.
 *
 * `tool_call` is the only place a plugin can stop a call, so it is the whole
 * guard. Two rules, no third:
 *
 *   write  -> always blocked while guarded. The orchestrator decides; a worker edits.
 *   read   -> blocked unless the path already carries a session approval, because
 *             an approval without a stated reason is worth nothing at review time.
 *
 * The human-facing dialog lives in the `request_read` tool instead: only there
 * does the plugin know WHY. Keeping the modal out of the hook is what lets the
 * dialog show a real reason instead of a reconstruction.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { classify } from "../../shared/classify.js";
import { stringsFor } from "../../shared/i18n.js";
import { isGranted, recordDeny, type PluginState } from "../../shared/state.js";
import { loadConfig } from "../../shared/config.js";

/** Block reasons are read by the model, so they stay English in every locale. */
const SANCTIONED_ROUTE = [
	"BLOCKED by pi-orch-guard: this route puts source into your context without a stated reason.",
	"Call request_read(path, reason) instead — it shows the user the exact target and your reason,",
	"and returns the content only if they approve. If a structural tool answers the question",
	"(symbol_search, module_report, project_report, lsp_diagnostics), use that instead and never ask.",
].join(" ");

const DELEGATE_ROUTE = [
	"BLOCKED by pi-orch-guard: a guarded orchestrator does not change the workspace.",
	"You have already resolved the facts; hand the concrete targets to a worker subagent",
	"(agent: worker) with the exact file:line edits it must make, then verify its result yourself.",
	"Do not retry this call through bash, another tool, or another spelling of the path.",
].join(" ");

function pathOf(input: unknown): string | undefined {
	if (!input || typeof input !== "object") return undefined;
	const value = (input as Record<string, unknown>).path;
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function footer(state: PluginState): string {
	const s = stringsFor(state.config.lang);
	return state.config.mode === "on"
		? s.statusShort(state.approvedReads, state.blockedWrites)
		: `${s.title}: off`;
}

export function registerHooks(pi: ExtensionAPI, state: PluginState): Array<() => void> {
	const unsubs: Array<() => void> = [];

	unsubs.push(
		pi.on("session_start", (_event, ctx) => {
			// cwd is per-session; the project config layer depends on it.
			state.config = loadConfig(ctx.cwd);
			if (ctx.hasUI) ctx.ui.setStatus("pi-orch-guard", footer(state));
		}),

		pi.on("tool_call", async (event, ctx: ExtensionContext) => {
			if (state.config.mode !== "on") return;

			const call = classify(event.toolName, event.input);

			if (call.intent === "write") {
				state.blockedWrites++;
				recordDeny(state, {
					tool: call.tool,
					intent: call.intent,
					target: call.target,
					reason: "orchestrator may not change the workspace",
				});
				if (ctx.hasUI) ctx.ui.setStatus("pi-orch-guard", footer(state));
				return { block: true, reason: `${DELEGATE_ROUTE}\n\nBlocked call: ${call.tool} → ${call.target}` };
			}

			if (call.intent !== "read") return;

			// An approved path stays readable for the rest of the session.
			const path = pathOf(event.input);
			if (path && isGranted(state, path)) return;

			state.readRequests++;
			recordDeny(state, {
				tool: call.tool,
				intent: call.intent,
				target: call.target,
				reason: "read without a stated reason",
			});
			if (ctx.hasUI) {
				const s = stringsFor(state.config.lang);
				ctx.ui.notify(s.rawReadTitle(call.tool, call.target), "warning");
				ctx.ui.setStatus("pi-orch-guard", footer(state));
			}
			return {
				block: true,
				reason: `${SANCTIONED_ROUTE}\n\nBlocked call: ${call.tool} → ${call.target}`,
			};
		}),
	);

	return unsubs;
}