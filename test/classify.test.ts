import test from "node:test";
import assert from "node:assert/strict";
import { classify, readSpan } from "../src/shared/classify.js";

test("source-moving tools are reads", () => {
	for (const tool of ["read", "read_all", "grep", "read_symbol", "read_enclosing"]) {
		assert.equal(classify(tool, { path: "a.lss" }).intent, "read", tool);
	}
});

test("structural tools stay neutral, so tier 1 costs the user nothing", () => {
	for (const tool of [
		"symbol_search",
		"module_report",
		"project_report",
		"find",
		"glob",
		"ls",
		"lotusscript_lsp_lsp_diagnostics",
	]) {
		assert.equal(classify(tool, {}).intent, "neutral", tool);
	}
});

test("filesystem tools are writes", () => {
	for (const tool of ["edit", "write", "apply_patch", "multi_edit"]) {
		assert.equal(classify(tool, { path: "a.lss" }).intent, "write", tool);
	}
});

test("bash is neutral until the command says otherwise", () => {
	assert.equal(classify("bash", { command: "npm test" }).intent, "neutral");
	assert.equal(classify("bash", { command: "cat src/a.lss" }).intent, "read");
	assert.equal(classify("bash", { command: "Get-Content a.lss" }).intent, "read");
	assert.equal(classify("bash", { command: "git commit -m x" }).intent, "write");
	assert.equal(classify("bash", { command: "rm -rf dist" }).intent, "write");
});

test("an unknown tool is neutral, never a guess", () => {
	assert.equal(classify("some_future_tool", { path: "a" }).intent, "neutral");
});

test("the target reads as a sentence a human can judge", () => {
	assert.equal(classify("read", { path: "src/a.lss" }).target, "src/a.lss");
	assert.equal(classify("grep", { path: "src", pattern: "Initialize" }).target, "src ← Initialize");
	assert.equal(classify("bash", { command: "npm test" }).target, "npm test");
});

test("a very long target is clipped to one line", () => {
	const long = "x".repeat(500);
	assert.ok(classify("read", { path: long }).target.length <= 120);
});

test("readSpan reads the offset/limit pair", () => {
	assert.equal(readSpan({ offset: "10", limit: "20" }), "lines 10–30");
	assert.equal(readSpan({ limit: "20" }), "first 20 lines");
	assert.equal(readSpan({}), undefined);
});

test("a call with no input at all does not throw", () => {
	assert.equal(classify("read", undefined).intent, "read");
	assert.equal(classify("read", null).target, "read");
});