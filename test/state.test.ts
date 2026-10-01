import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, grantPath, isGranted, pathGrantKey, recordDeny } from "../src/shared/state.js";

test("an approval is per path and dies with the session", () => {
	const state = createInitialState();
	assert.equal(isGranted(state, "src/a.lss"), false);
	grantPath(state, "src/a.lss");
	assert.equal(isGranted(state, "src/a.lss"), true);
	assert.equal(isGranted(state, "src/b.lss"), false);
});

test("Windows paths grant the same file however they are spelled", () => {
	assert.equal(pathGrantKey("D:\\Work\\A.lss"), pathGrantKey("d:/work/a.lss"));
	const state = createInitialState();
	grantPath(state, "D:\\Work\\A.lss");
	assert.equal(isGranted(state, "d:/work/a.lss"), true);
});

test("the deny log is bounded, newest first", () => {
	const state = createInitialState();
	for (let i = 0; i < 60; i++) {
		recordDeny(state, { tool: "read", intent: "read", target: `f${i}`, reason: "r" });
	}
	assert.equal(state.history.length, 50);
	assert.equal(state.history[0].target, "f59");
});