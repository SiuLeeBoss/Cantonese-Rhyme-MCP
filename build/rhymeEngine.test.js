import assert from "node:assert/strict";
import test from "node:test";
import { CantoneseRhymeEngine } from "./rhymeEngine.js";
test("analyzeTextEnd extracts final and tone", () => {
    const engine = new CantoneseRhymeEngine();
    const result = engine.analyzeTextEnd("我愛你");
    assert.equal(result.matchedText, "我愛你");
    assert.equal(result.final, "ei");
    assert.equal(result.tone, "5");
    assert.equal(result.rhymeKeys?.finalTone, "ei5");
});
test("rhymeCandidates returns matching finals", () => {
    const engine = new CantoneseRhymeEngine();
    const candidates = engine.rhymeCandidates({
        rhymeKey: "ung",
        strictness: "final",
        limit: 50
    });
    const texts = new Set(candidates.map((c) => c.text));
    assert.ok(texts.has("風"));
    assert.ok(texts.has("夢"));
});
test("analyzeTextEnd returns unmatchedTail when unknown", () => {
    const engine = new CantoneseRhymeEngine();
    const result = engine.analyzeTextEnd("XYZ");
    assert.equal(result.rhymeKeys, null);
    assert.equal(result.unmatchedTail, "XYZ");
});
test("rhymeCandidates wide matches near finals", () => {
    const engine = new CantoneseRhymeEngine();
    const candidates = engine.rhymeCandidates({
        rhymeKey: "am",
        strictness: "wide",
        limit: 200
    });
    const texts = new Set(candidates.map((c) => c.text));
    assert.ok(texts.has("心"));
    assert.ok(texts.has("分"));
});
test("rhymeCandidates can filter by tone", () => {
    const engine = new CantoneseRhymeEngine();
    const candidates = engine.rhymeCandidates({
        rhymeKey: "ung",
        strictness: "final",
        tone: 6,
        limit: 50
    });
    const texts = new Set(candidates.map((c) => c.text));
    assert.ok(texts.has("夢"));
    assert.ok(!texts.has("風"));
});
