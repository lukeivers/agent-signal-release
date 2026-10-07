#!/usr/bin/env node
// The shared JS/TS architecture gate: coverage, syntax, clones, dependency boundaries and
// cycles, responsibility ownership and same-name helpers, with a baseline that only shrinks.
// Run from a repository root: node "$DEVKIT/gates/js/architecture.mjs" [--update-baseline]
// [--allow-growth] [--root DIR]. Rules live in rules/architecture-js.json; see devkit's README.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { builtinModules, createRequire } from "node:module";
import { extname, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const CONFIG_PATH = "rules/architecture-js.json";
export const BASELINE_PATH = "rules/architecture-baseline-js.json";
const RESOLVED_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];
const PARSED = new Set(RESOLVED_EXTENSIONS);
const HANDWRITTEN = new Set([
  ...RESOLVED_EXTENSIONS,
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".html",
  ".vue",
  ".svelte",
  ".astro",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".swift",
  ".glsl",
  ".wgsl",
  ".sh",
]);
// Route-module exports that frameworks require under the same name in every route file.
const DEFAULT_SAME_NAME_EXEMPT = [
  "default",
  "main",
  "handler",
  "loader",
  "action",
  "clientLoader",
  "clientAction",
  "meta",
  "links",
  "headers",
  "ErrorBoundary",
  "HydrateFallback",
  "shouldRevalidate",
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
];
const CATEGORIES = ["clones", "boundaries", "cycles", "ownership", "sameName"];

export class ArchitectureError extends Error {}

const digest = (value) => createHash("sha256").update(value).digest("hex").slice(0, 16);
const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function stringList(value, key) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string"))
    throw new ArchitectureError(`${key} must be a list of strings`);
  return value;
}

function under(path, prefixes) {
  return prefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix.replace(/\/$/, "")}/`),
  );
}

export function readConfig(root) {
  const path = resolve(root, CONFIG_PATH);
  if (!existsSync(path)) throw new ArchitectureError(`missing ${CONFIG_PATH}`);
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const clones = raw.clones ?? {};
  const config = {
    components: stringList(raw.components, "components"),
    rootFiles: stringList(raw.rootFiles, "rootFiles"),
    excluded: stringList(raw.excluded, "excluded"),
    unscannedExtensions: new Set(stringList(raw.unscannedExtensions, "unscannedExtensions")),
    aliases: raw.aliases ?? {},
    externals: stringList(raw.externals, "externals"),
    clones: {
      minTokens: clones.minTokens ?? 50,
      minLines: clones.minLines ?? 5,
      minDistinctTokens: clones.minDistinctTokens ?? 12,
      excluded: stringList(clones.excluded, "clones.excluded"),
    },
    boundaries: raw.boundaries ?? [],
    owners: raw.owners ?? {},
    sameName: {
      exempt: new Set([
        ...DEFAULT_SAME_NAME_EXEMPT,
        ...stringList(raw.sameName?.exempt, "sameName.exempt"),
      ]),
      excluded: stringList(raw.sameName?.excluded, "sameName.excluded"),
    },
  };
  if (!config.components.length)
    throw new ArchitectureError("components must name at least one directory");
  for (const [index, rule] of config.boundaries.entries()) {
    if (typeof rule.concern !== "string" || !rule.concern.trim())
      throw new ArchitectureError(`boundaries[${index}] needs a concern`);
    rule.from = stringList(rule.from ?? [""], `boundaries[${index}].from`);
    rule.except = stringList(rule.except, `boundaries[${index}].except`);
    rule.forbid = stringList(rule.forbid, `boundaries[${index}].forbid`);
    if (!rule.forbid.length) throw new ArchitectureError(`boundaries[${index}] forbids nothing`);
  }
  for (const [concern, rule] of Object.entries(config.owners)) {
    if (
      typeof rule?.owner !== "string" ||
      !stringList(rule.names, `owners.${concern}.names`).length
    )
      throw new ArchitectureError(`owners.${concern} needs an owner file and names`);
    if (!existsSync(resolve(root, rule.owner)))
      throw new ArchitectureError(`owners.${concern}: owner ${rule.owner} does not exist`);
  }
  return config;
}

/** Tracked and new-but-unignored files, so nested worktrees and build output never count. */
function listedFiles(root) {
  const listed = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8",
  });
  if (listed.status !== 0)
    throw new ArchitectureError(`cannot list files: ${listed.stderr.trim()}`);
  return listed.stdout
    .split("\n")
    .filter(Boolean)
    .filter((path) => existsSync(resolve(root, path)) && statSync(resolve(root, path)).isFile());
}

function inventory(root, config) {
  const failures = [];
  const parsed = [];
  const listed = listedFiles(root);
  for (const path of listed) {
    const extension = extname(path);
    if (!HANDWRITTEN.has(extension) || under(path, config.excluded)) continue;
    if (!under(path, config.components) && !config.rootFiles.includes(path)) {
      failures.push(`coverage: ${path} is outside every component; add it to ${CONFIG_PATH}`);
    } else if (PARSED.has(extension)) {
      parsed.push(path);
    } else if (!config.unscannedExtensions.has(extension)) {
      failures.push(
        `coverage: ${path} is a ${extension} source no gate scans; cover or exclude it`,
      );
    }
  }
  for (const component of config.components) {
    if (!parsed.some((path) => under(path, [component])))
      failures.push(`coverage: component ${component} has no JS or TS files`);
  }
  for (const file of config.rootFiles) {
    if (!existsSync(resolve(root, file))) failures.push(`coverage: missing root file ${file}`);
  }
  return { failures, parsed, listed: new Set(listed) };
}

/** Every package a tracked package.json names or depends on, so a bare import must be one. */
function declaredPackages(root, listed) {
  const names = new Set();
  for (const path of listed) {
    if (posix.basename(path) !== "package.json") continue;
    const manifest = JSON.parse(readFileSync(resolve(root, path), "utf8"));
    if (manifest.name) names.add(manifest.name);
    for (const subpath of Object.keys(manifest.imports ?? {})) names.add(subpath);
    for (const field of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ])
      for (const name of Object.keys(manifest[field] ?? {})) names.add(name);
  }
  return names;
}

function loadTypeScript(root) {
  try {
    return createRequire(resolve(root, "package.json"))("typescript");
  } catch {
    throw new ArchitectureError("typescript is not installed; add it as a devDependency");
  }
}

function parse(ts, root, paths) {
  const failures = [];
  const sources = new Map();
  for (const path of paths) {
    const extension = extname(path);
    const kind = extension.endsWith("x")
      ? extension === ".tsx"
        ? ts.ScriptKind.TSX
        : ts.ScriptKind.JSX
      : [".ts", ".mts", ".cts"].includes(extension)
        ? ts.ScriptKind.TS
        : ts.ScriptKind.JS;
    const text = readFileSync(resolve(root, path), "utf8");
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
    for (const error of source.parseDiagnostics) {
      const { line } = source.getLineAndCharacterOfPosition(error.start ?? 0);
      failures.push(
        `syntax: ${path}:${line + 1} ${ts.flattenDiagnosticMessageText(error.messageText, " ")}`,
      );
    }
    sources.set(path, { source, kind, text });
  }
  return { failures, sources };
}

const lineOf = (source, position) => source.getLineAndCharacterOfPosition(position).line + 1;

function normalizedTokens(ts, { source, kind, text }) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text);
  if (kind === ts.ScriptKind.TSX || kind === ts.ScriptKind.JSX)
    scanner.setLanguageVariant(ts.LanguageVariant.JSX);
  const literal = new Set([
    ts.SyntaxKind.StringLiteral,
    ts.SyntaxKind.NumericLiteral,
    ts.SyntaxKind.BigIntLiteral,
    ts.SyntaxKind.NoSubstitutionTemplateLiteral,
    ts.SyntaxKind.TemplateHead,
    ts.SyntaxKind.TemplateMiddle,
    ts.SyntaxKind.TemplateTail,
    ts.SyntaxKind.RegularExpressionLiteral,
  ]);
  const tokens = [];
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    const start = scanner.getTokenStart?.() ?? scanner.getTokenPos();
    const name =
      token === ts.SyntaxKind.Identifier || token === ts.SyntaxKind.PrivateIdentifier
        ? "ID"
        : literal.has(token)
          ? "LIT"
          : (ts.tokenToString(token) ?? ts.SyntaxKind[token]);
    tokens.push({
      name,
      position: start,
      start: lineOf(source, start),
      end: lineOf(source, scanner.getTextPos()),
    });
  }
  return tokens;
}

/** Data tables and import lists repeat their shape without being copied logic. */
function ignoredSpans(ts, source) {
  const spans = [];
  const visit = (node) => {
    let holdsFunction = false;
    ts.forEachChild(node, (child) => {
      holdsFunction = visit(child) || holdsFunction;
    });
    const literal = ts.isArrayLiteralExpression(node) || ts.isObjectLiteralExpression(node);
    if ((literal && !holdsFunction) || ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      spans.push([node.getStart(source), node.end]);
    return holdsFunction || ts.isFunctionLike(node);
  };
  visit(source);
  return spans;
}

/**
 * Repeated windows of normalized tokens, merged into one region per run in each file. Regions are
 * counted per file, as lint findings are, so editing a recorded copy doesn't read as a new one.
 */
export function cloneFindings(ts, sources, settings) {
  const windows = new Map();
  for (const [path, parsed] of sources) {
    if (under(path, settings.excluded)) continue;
    const tokens = normalizedTokens(ts, parsed);
    const spans = ignoredSpans(ts, parsed.source);
    const kept = [0];
    for (const token of tokens) {
      const ignored = spans.some(([start, end]) => token.position >= start && token.position < end);
      kept.push(kept.at(-1) + (ignored ? 0 : 1));
    }
    for (let index = 0; index + settings.minTokens <= tokens.length; index += 1) {
      const window = tokens.slice(index, index + settings.minTokens);
      const first = window[0].start;
      const last = window.at(-1).end;
      if (last - first + 1 < settings.minLines) continue;
      const names = window.map((token) => token.name);
      if (new Set(names).size < settings.minDistinctTokens) continue;
      if (2 * (kept[index + settings.minTokens] - kept[index]) < settings.minTokens) continue;
      const fingerprint = digest(names.join(" "));
      const entries = windows.get(fingerprint) ?? [];
      entries.push({ path, index, first, last, fingerprint });
      windows.set(fingerprint, entries);
    }
  }
  const byPath = new Map();
  for (const entries of windows.values()) {
    if (entries.length < 2) continue;
    for (const entry of entries) byPath.set(entry.path, [...(byPath.get(entry.path) ?? []), entry]);
  }
  const findings = [];
  for (const [path, entries] of [...byPath].sort(([a], [b]) => byCodeUnit(a, b))) {
    entries.sort((a, b) => a.index - b.index);
    const regions = [];
    for (const entry of entries) {
      const region = regions.at(-1);
      if (region && entry.index === region.at(-1).index + 1) region.push(entry);
      else regions.push([entry]);
    }
    for (const region of regions)
      findings.push({
        id: path,
        message: `${path}:${region[0].first}-${region.at(-1).last} duplicated code region`,
      });
  }
  return findings;
}

function specifiers(ts, source) {
  const found = [];
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      const typeOnly = Boolean(node.importClause?.isTypeOnly || node.isTypeOnly);
      found.push({ node, specifier: node.moduleSpecifier, loaded: !typeOnly });
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      found.push({ node, specifier: node.moduleReference.expression, loaded: !node.isTypeOnly });
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      // A lazy import() runs after both modules load, which is how a cycle is broken.
      found.push({ node, specifier: node.arguments[0], loaded: false });
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require"
    ) {
      found.push({ node, specifier: node.arguments[0], loaded: true });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** A package.json "imports" subpath such as "#db" or "#lib/*". */
function packageImport(specifier, packages) {
  return (
    specifier.startsWith("#") &&
    [...packages].some((name) =>
      name.endsWith("*") ? specifier.startsWith(name.slice(0, -1)) : name === specifier,
    )
  );
}

function packageName(specifier) {
  const parts = specifier.replace(/^node:/, "").split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

/** The tracked file a local import reaches: null when none, undefined for a package. */
function resolveLocal(from, specifier, aliases, files, listed) {
  let base;
  const alias = Object.keys(aliases).find((prefix) => specifier.startsWith(prefix));
  if (alias !== undefined) base = posix.normalize(aliases[alias] + specifier.slice(alias.length));
  else if (specifier.startsWith("."))
    base = posix.normalize(posix.join(posix.dirname(from), specifier));
  else return undefined;
  const stem = base.replace(/\.(m|c)?js$/, "");
  const candidates = [
    base,
    ...RESOLVED_EXTENSIONS.map((extension) => stem + extension),
    ...RESOLVED_EXTENSIONS.map((extension) => `${base}/index${extension}`),
  ];
  return candidates.find((candidate) => files.has(candidate)) ?? (listed.has(base) ? base : null);
}

function cycles(graph) {
  let counter = 0;
  const index = new Map();
  const low = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];
  const connect = (node) => {
    index.set(node, counter);
    low.set(node, counter);
    counter += 1;
    stack.push(node);
    onStack.add(node);
    for (const next of graph.get(node) ?? []) {
      if (!index.has(next)) {
        connect(next);
        low.set(node, Math.min(low.get(node), low.get(next)));
      } else if (onStack.has(next)) low.set(node, Math.min(low.get(node), index.get(next)));
    }
    if (low.get(node) === index.get(node)) {
      const component = [];
      let member;
      do {
        member = stack.pop();
        onStack.delete(member);
        component.push(member);
      } while (member !== node);
      if (component.length > 1 || graph.get(node)?.has(node))
        components.push(component.sort(byCodeUnit));
    }
  };
  for (const node of [...graph.keys()].sort(byCodeUnit)) if (!index.has(node)) connect(node);
  return components;
}

export function dependencyFindings(ts, sources, config, listed, packages) {
  const files = new Set(sources.keys());
  const boundaries = [];
  const graph = new Map();
  for (const [path, { source }] of sources) {
    const edges = new Set();
    graph.set(path, edges);
    for (const { node, specifier, loaded } of specifiers(ts, source)) {
      const line = lineOf(source, node.getStart(source));
      if (!specifier || !ts.isStringLiteralLike(specifier)) {
        const text = node.getText(source).replace(/\s+/g, " ");
        boundaries.push({
          id: `${path}#unresolved#${digest(text)}`,
          message: `${path}:${line} import target isn't a string literal, so its boundary can't be checked`,
        });
        continue;
      }
      const name = specifier.text;
      const target = resolveLocal(path, name, config.aliases, files, listed);
      if (target === null) {
        boundaries.push({
          id: `${path}#unresolved#${name}`,
          message: `${path}:${line} imports ${name}, which resolves to no scanned file`,
        });
        continue;
      }
      if (
        target === undefined &&
        !name.startsWith("node:") &&
        !builtinModules.includes(name) &&
        !packages.has(packageName(name)) &&
        !packageImport(name, packages) &&
        !config.externals.some((prefix) => name.startsWith(prefix))
      ) {
        boundaries.push({
          id: `${path}#unresolved#${name}`,
          message: `${path}:${line} imports ${name}, which is neither a package.json dependency nor a configured alias`,
        });
        continue;
      }
      if (target && files.has(target) && loaded) edges.add(target);
      for (const rule of config.boundaries) {
        if (!under(path, rule.from.filter(Boolean)) && !rule.from.includes("")) continue;
        if (under(path, rule.except)) continue;
        const hit = rule.forbid.find((forbidden) =>
          target ? under(target, [forbidden]) : packageName(name) === packageName(forbidden),
        );
        if (hit)
          boundaries.push({
            id: `${path}#boundary#${rule.concern}#${target ?? packageName(name)}`,
            message: `${path}:${line} imports ${target ?? name}: ${rule.concern}`,
          });
      }
    }
  }
  const loops = cycles(graph).map((members) => ({
    id: `cycle#${members.join(">")}`,
    message: `import cycle: ${members.join(" -> ")}`,
  }));
  return { boundaries, cycles: loops };
}

/** Names declared at module level; with onlyCallable, variables must hold a function or class. */
function moduleDeclarations(ts, source, onlyCallable) {
  const declared = [];
  for (const statement of source.statements) {
    if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      statement.name
    ) {
      declared.push({ name: statement.name.text, node: statement });
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const value = declaration.initializer;
        const callable =
          value &&
          (ts.isArrowFunction(value) ||
            ts.isFunctionExpression(value) ||
            ts.isClassExpression(value));
        if (ts.isIdentifier(declaration.name) && (callable || !onlyCallable))
          declared.push({ name: declaration.name.text, node: declaration });
      }
    }
  }
  return declared;
}

/** Module-level names, plus functions and classes declared anywhere: a local variable is not a rival. */
function ownedCandidates(ts, source) {
  const declared = moduleDeclarations(ts, source, false);
  const seen = new Set(declared.map(({ node }) => node));
  const visit = (node) => {
    if (
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
      node.name &&
      !seen.has(node)
    )
      declared.push({ name: node.name.text, node });
    ts.forEachChild(node, visit);
  };
  visit(source);
  return declared;
}

export function ownershipFindings(ts, sources, owners) {
  const findings = [];
  for (const [path, { source }] of sources) {
    for (const { name, node } of ownedCandidates(ts, source)) {
      for (const [concern, rule] of Object.entries(owners)) {
        if (rule.names.includes(name) && path !== rule.owner)
          findings.push({
            id: `${path}#${concern}#${name}`,
            message: `${path}:${lineOf(source, node.getStart(source))} declares ${name}, which ${rule.owner} owns (${concern}); reuse it`,
          });
      }
    }
  }
  return findings;
}

/** A copied helper usually keeps its name even when its body drifts past the clone detector. */
export function sameNameFindings(ts, sources, settings) {
  const places = new Map();
  for (const [path, { source }] of sources) {
    if (under(path, settings.excluded)) continue;
    for (const { name, node } of moduleDeclarations(ts, source, true)) {
      if (settings.exempt.has(name)) continue;
      places.set(name, [
        ...(places.get(name) ?? []),
        { path, line: lineOf(source, node.getStart(source)) },
      ]);
    }
  }
  const findings = [];
  for (const [name, found] of [...places].sort(([a], [b]) => byCodeUnit(a, b))) {
    const paths = [...new Set(found.map((place) => place.path))].sort(byCodeUnit);
    if (paths.length < 2) continue;
    for (const { path, line } of found)
      findings.push({
        id: `${path}#${name}`,
        message: `${path}:${line} defines ${name}, also defined in ${paths.filter((other) => other !== path).join(", ")}`,
      });
  }
  return findings;
}

function counts(ids) {
  const result = new Map();
  for (const id of ids) result.set(id, (result.get(id) ?? 0) + 1);
  return result;
}

function compare(category, findings, before) {
  const failures = [];
  const now = counts(findings.map((finding) => finding.id));
  const reported = new Map();
  for (const finding of findings) {
    const added = (now.get(finding.id) ?? 0) - (before.get(finding.id) ?? 0);
    const shown = reported.get(finding.id) ?? 0;
    if (added > shown) {
      failures.push(`${category}: ${finding.message}`);
      reported.set(finding.id, shown + 1);
    }
  }
  for (const [id, count] of before) {
    if (count > (now.get(id) ?? 0))
      failures.push(
        `${category}: baseline entry ${id} is fixed; run with --update-baseline to record it`,
      );
  }
  return failures;
}

export function check(root, { updateBaseline = false, allowGrowth = false } = {}) {
  const config = readConfig(root);
  const found = inventory(root, config);
  const ts = loadTypeScript(root);
  const parsed = parse(ts, root, found.parsed);
  const dependencies = dependencyFindings(
    ts,
    parsed.sources,
    config,
    found.listed,
    declaredPackages(root, found.listed),
  );
  const current = {
    clones: cloneFindings(ts, parsed.sources, config.clones),
    boundaries: dependencies.boundaries,
    cycles: dependencies.cycles,
    ownership: ownershipFindings(ts, parsed.sources, config.owners),
    sameName: sameNameFindings(ts, parsed.sources, config.sameName),
  };
  const baselinePath = resolve(root, BASELINE_PATH);
  const stored = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : {};
  const recorded = Object.fromEntries(
    CATEGORIES.map((category) => [category, new Map(Object.entries(stored[category] ?? {}))]),
  );
  const failures = [...found.failures, ...parsed.failures];
  const refused = [];
  if (updateBaseline) {
    const next = {};
    for (const category of CATEGORIES) {
      const kept = new Map();
      for (const [id, count] of counts(current[category].map((finding) => finding.id))) {
        const allowed = allowGrowth ? count : Math.min(count, recorded[category].get(id) ?? 0);
        if (allowed < count) refused.push(`${category}: ${id}`);
        if (allowed) kept.set(id, allowed);
      }
      recorded[category] = kept;
      if (kept.size)
        next[category] = Object.fromEntries([...kept].sort(([a], [b]) => byCodeUnit(a, b)));
    }
    if (Object.keys(next).length || existsSync(baselinePath))
      writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
  }
  for (const category of CATEGORIES)
    failures.push(...compare(category, current[category], recorded[category]));
  return { failures, refused, files: parsed.sources.size, current };
}

function main(argv) {
  const rootIndex = argv.indexOf("--root");
  const root = resolve(rootIndex >= 0 ? argv[rootIndex + 1] : process.cwd());
  let result;
  try {
    result = check(root, {
      updateBaseline: argv.includes("--update-baseline"),
      allowGrowth: argv.includes("--allow-growth"),
    });
  } catch (error) {
    if (!(error instanceof ArchitectureError) && !(error instanceof SyntaxError)) throw error;
    console.error(`architecture js: ${error.message}`);
    return 1;
  }
  for (const id of result.refused)
    console.error(`architecture js: not added to the baseline without --allow-growth: ${id}`);
  for (const failure of result.failures) console.error(`architecture js: ${failure}`);
  if (result.failures.length) return 1;
  const debt = CATEGORIES.reduce((total, category) => total + result.current[category].length, 0);
  console.log(
    `architecture js: ok (${result.files} files; ${debt} findings, all within the baseline)`,
  );
  console.log(
    "architecture js: limits: clones need the same token shape, so a rewritten copy needs review; ownership and same-name catch only reused names",
  );
  return 0;
}

if (
  process.argv[1] &&
  realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])
)
  process.exitCode = main(process.argv.slice(2));
