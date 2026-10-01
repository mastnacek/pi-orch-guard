import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LOCALE, LOCALES, normalizeLocale, stringsFor } from "../src/shared/i18n.js";

test("every locale has a complete string table", () => {
	for (const locale of LOCALES) {
		const s = stringsFor(locale);
		for (const key of ["title", "deny", "allowOnce", "allowSession", "headlessNotice", "langDesc"] as const) {
			assert.equal(typeof s[key], "string", `${locale}.${key} must be a string`);
			assert.ok(s[key].trim().length > 0, `${locale}.${key} must not be empty`);
		}
		assert.equal(typeof s.status("guard", 1, 2), "string");
		assert.equal(typeof s.statusShort(1, 2), "string");
		assert.ok(s.modal("read", "a.lss", undefined, "why").includes("a.lss"));
		assert.ok(s.modal("read", "a.lss", "lines 1-20", "why").includes("lines 1-20"));
	}
});

test("the modal shows both the target and the stated reason", () => {
	const s = stringsFor("cs");
	const rendered = s.modal("read", "src/a.lss", undefined, "chybová hláška z bodu 12");
	assert.ok(rendered.includes("src/a.lss"));
	assert.ok(rendered.includes("chybová hláška z bodu 12"));
});

test("the Czech locale really is Czech, so a regression is visible", () => {
	assert.notEqual(stringsFor("cs").deny, stringsFor("en").deny);
	assert.notEqual(stringsFor("cs").allowSession, stringsFor("en").allowSession);
});

test("an unknown locale is English, never a crash", () => {
	assert.equal(normalizeLocale("klingon"), "en");
	assert.equal(normalizeLocale(undefined), "en");
	assert.equal(normalizeLocale("cz"), "cs");
	assert.equal(stringsFor("nonsense").title, stringsFor("en").title);
	assert.equal(stringsFor(DEFAULT_LOCALE).title, "pi-orch-guard");
});