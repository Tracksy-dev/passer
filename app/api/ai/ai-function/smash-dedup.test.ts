/**
 * Edge-case tests for mergeByMinGap.
 *
 * Uses Node's built-in test runner (Node 18+), no extra dependencies.
 * Run with:  npx tsx --test app/api/ai/ai-function/smash-dedup.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeByMinGap } from "./route.js";

type E = { raw: string; sec: number; conf: number };
const e = (raw: string, sec: number, conf: number): E => ({ raw, sec, conf });

describe("mergeByMinGap", () => {
  // ── empty / single ──────────────────────────────────────────────────────

  it("returns empty array for empty input", () => {
    assert.deepEqual(mergeByMinGap([], 1.0), []);
  });

  it("passes a single event through unchanged", () => {
    const input = [e("0.05.00", 5.0, 0.8)];
    assert.deepEqual(mergeByMinGap(input, 1.0), input);
  });

  // ── exact-duplicate timestamps ──────────────────────────────────────────

  it("merges exact-duplicate timestamps, keeps the first when confidence equal", () => {
    const input = [e("0.05.00", 5.0, 0.7), e("0.05.00", 5.0, 0.7)];
    const result = mergeByMinGap(input, 1.0);
    assert.equal(result.length, 1);
    assert.equal(result[0].raw, "0.05.00");
  });

  it("exact duplicates — higher confidence second event wins", () => {
    const input = [e("0.05.00", 5.0, 0.3), e("0.05.00", 5.0, 0.9)];
    const result = mergeByMinGap(input, 1.0);
    assert.equal(result.length, 1);
    assert.equal(result[0].conf, 0.9);
  });

  // ── gap < window (0.99 s) → merged ──────────────────────────────────────

  it("merges events 0.99 s apart", () => {
    const input = [e("0.05.00", 5.0, 0.5), e("0.05.99", 5.99, 0.8)];
    const result = mergeByMinGap(input, 1.0);
    assert.equal(result.length, 1);
    assert.equal(result[0].raw, "0.05.99");  // higher-confidence wins
    assert.equal(result[0].conf, 0.8);
  });

  // ── gap == window (1.00 s) → merged (boundary is inclusive) ─────────────

  it("merges events exactly 1.00 s apart (boundary inclusive)", () => {
    const input = [e("0.05.00", 5.0, 0.6), e("0.06.00", 6.0, 0.7)];
    const result = mergeByMinGap(input, 1.0);
    assert.equal(result.length, 1);
    assert.equal(result[0].conf, 0.7);
  });

  // ── gap > window (1.01 s) → separate ────────────────────────────────────

  it("keeps events 1.01 s apart as separate points", () => {
    const input = [e("0.05.00", 5.0, 0.6), e("0.06.01", 6.01, 0.7)];
    const result = mergeByMinGap(input, 1.0);
    assert.equal(result.length, 2);
  });

  // ── mixed-confidence cluster ─────────────────────────────────────────────

  it("three events in a cluster — highest confidence survives", () => {
    const input = [
      e("0.10.00", 10.0,  0.40),
      e("0.10.50", 10.5,  0.90),  // highest
      e("0.10.80", 10.8,  0.55),
    ];
    const result = mergeByMinGap(input, 1.0);
    assert.equal(result.length, 1);
    assert.equal(result[0].conf, 0.90);
    assert.equal(result[0].raw, "0.10.50");
  });

  it("cluster with highest confidence at end", () => {
    const input = [
      e("0.10.00", 10.0, 0.30),
      e("0.10.40", 10.4, 0.50),
      e("0.10.90", 10.9, 0.99),  // highest, also shifts anchor
    ];
    const result = mergeByMinGap(input, 1.0);
    assert.equal(result.length, 1);
    assert.equal(result[0].conf, 0.99);
  });

  // ── two genuinely separate rallies ───────────────────────────────────────

  it("two events 2.0 s apart are both kept", () => {
    const input = [e("0.05.00", 5.0, 0.7), e("0.07.00", 7.0, 0.8)];
    const result = mergeByMinGap(input, 1.0);
    assert.equal(result.length, 2);
  });

  // ── order preservation ────────────────────────────────────────────────────

  it("output preserves ascending order of representative timestamps", () => {
    const input = [
      e("0.03.00", 3.0, 0.8),
      e("0.03.50", 3.5, 0.7),  // merges with 3.0 (3.0 wins, higher conf)
      e("0.06.00", 6.0, 0.9),  // separate
      e("0.06.80", 6.8, 0.6),  // merges with 6.0 (6.0 wins, higher conf)
    ];
    const result = mergeByMinGap(input, 1.0);
    assert.equal(result.length, 2);
    assert.equal(result[0].sec, 3.0);
    assert.equal(result[1].sec, 6.0);
  });
});
