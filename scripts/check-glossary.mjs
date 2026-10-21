// Fails when code under src/ uses a term GLOSSARY.md lists under _Avoid_. Runs as part of `npm run lint`.
// Identifiers are split into words (StockAvailability -> stock availability), so names, comments and UI copy are all checked.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Avoid-terms that are also programming or library vocabulary, so a match says nothing about the domain language.
const exempt = new Map([
  ["anonymous user", "Better Auth's own term for a Guest's user row (ADR 0001)"],
  ["account", "Better Auth's account table and 'sign in to an account'"],
  ["client", "React client components and the Better Auth client"],
  ["line", "lines of text and CSS"],
  ["entry", "IntersectionObserver entries and map entries"],
]);

const glossary = readFileSync("GLOSSARY.md", "utf8");
const terms = [...glossary.matchAll(/^_Avoid_:\s*(.+)$/gm)]
  .flatMap(([, list]) => list.split(","))
  .map((term) => term.trim().toLowerCase())
  .filter((term) => term && !exempt.has(term));

// A term matches as whole words, also in the plural (inventory -> inventories).
const plural = (term) => (term.endsWith("y") ? `${term.slice(0, -1)}ies` : `${term}s`);
const patterns = terms.map((term) => ({ term, regex: new RegExp(`(^| )(${term}|${plural(term)})( |$)`) }));

const words = (text) =>
  ` ${text.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().replace(/[^a-z]+/g, " ")} `.replace(/ +/g, " ");

const files = readdirSync("src", { recursive: true })
  .map(String)
  .filter((file) => /\.(ts|tsx)$/.test(file));

const findings = [];
for (const file of files) {
  readFileSync(join("src", file), "utf8")
    .split("\n")
    .forEach((line, i) => {
      for (const { term, regex } of patterns) {
        if (regex.test(words(line))) findings.push(`src/${file.replaceAll("\\", "/")}:${i + 1}: "${term}"`);
      }
    });
}

if (findings.length) {
  console.error(`GLOSSARY.md lists these terms under _Avoid_; use the glossary term instead:\n${findings.join("\n")}`);
  process.exit(1);
}
