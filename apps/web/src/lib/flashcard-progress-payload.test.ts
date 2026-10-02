import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { resultsBefore } from "./flashcard-results";

// Execute the real screen's account snapshot expression. This regression is in
// the callers, not the already-tested serializers: results used to be omitted.
function snapshotFromScreen(path: string, scope: Record<string, unknown>, target = "account") {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (target === "account" && ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && node.left.getText(source) === "accountPushRef.current") expression = node.right;
    if (target === "local" && ts.isCallExpression(node) && node.expression.getText(source) === "saveSessionProgress") expression = node.arguments[2];
    if (target !== "account" && target !== "local" && ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) && node.name.elements[0]?.getText(source) === target) expression = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!expression) throw new Error("Account progress snapshot missing from screen");
  const code = ts.transpileModule(`(${expression.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  return new Function(...Object.keys(scope), `return ${code}`)(...Object.values(scope));
}
const cards = [{ id: "a" }, { id: "b" }, { id: "c" }];
const results = { a: { correct: false, overridden: false }, b: { correct: true, overridden: false } };
const shared = { cards, index: 2, results, roundResults: results };

describe("flashcard callers preserve answers in the newer account bookmark (#697)", () => {
  it("mobile keeps the prior correct and incorrect answers", () => {
    const snapshot = snapshotFromScreen(resolve(import.meta.dirname, "../../../mobile/app/(tabs)/learn.tsx"), {
      ...shared, deckId: "deck", source: "all", completed: false, currentCard: cards[2], showBackFirst: false,
      history: [0, 1], ratingHistory: ["again", "good"], storedResultsFrom: () => results,
    });
    expect(snapshot.results).toEqual(results);
  });
  it("web keeps the prior correct and incorrect answers", () => {
    const snapshot = snapshotFromScreen(resolve(import.meta.dirname, "../components/app/learn-session.tsx"), {
      ...shared, done: false, progressDeckId: "deck", progressSource: "all", reverse: false, total: 3,
    });
    expect(snapshot.results).toEqual(results);
  });
  it("web local bookmark and account snapshot carry identical answers", () => {
    const scope = { ...shared, done: false, progressDeckId: "deck", progressSource: "all", reverse: false, total: 3, card: cards[2] };
    const path = resolve(import.meta.dirname, "../components/app/learn-session.tsx");
    expect(snapshotFromScreen(path, scope, "local").results).toEqual(snapshotFromScreen(path, scope).results);
  });
  it("web initializes its visible correct count and retry pile from the resume answers", () => {
    const path = resolve(import.meta.dirname, "../components/app/learn-session.tsx");
    const scope = { pool: cards, startIndex: 2, startResults: results, resultsBefore, useState: (init: () => unknown) => [init()] };
    const [priorResults] = snapshotFromScreen(path, scope, "priorResults");
    expect(snapshotFromScreen(path, { ...scope, priorResults }, "correct")[0]).toBe(1);
    expect(snapshotFromScreen(path, { ...scope, priorResults }, "notKnown")[0]).toEqual([cards[0]]);
  });

});
