const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const sourceRoots = ["app", "components", "lib"];
const excluded = new Set([
  "lib/i18n/additional-dictionaries.ts",
  "lib/i18n/config.ts",
  "lib/i18n/interface-phrases.ts",
]);
const phrases = new Set();

function normalize(value) {
  return value
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeInterfaceText(value) {
  const text = normalize(value);
  if (!text || text.length > 650 || !/[A-Za-z]/.test(text)) return false;
  if (/^(https?:|mailto:|tel:|\/|@\/|[.#?_,{(-]|\[|[A-Z0-9_]{3,}$)/.test(text)) return false;
  if (/\b(example\.(com|org|edu)|school\.edu|students\.example|staff\.example)\b/i.test(text)) return false;
  const numericTokens = text.split(/\s+/);
  if (numericTokens.every((token) => /^\d+(?:px|vh|rem|s)?$/.test(token)) || /rgb\(|hsl\(/.test(text)) return false;
  if (/^[a-z0-9_.-]+\.(tsx?|jsx?|css|json|sql|md|png|jpg|svg)$/i.test(text)) return false;
  if (/^(GET|POST|PUT|PATCH|DELETE|Bearer|Content-Type|application\/|image\/)/.test(text)) return false;
  if (/^[a-z]+(?:_[a-z0-9]+)+$/.test(text)) return false;
  if (/^(yyyy|MMMM|MMM|MM|dd|EEEE|EEE|h:mm|HH:mm|PP)/.test(text)) return false;
  if (/^(flex|grid|block|inline|hidden|absolute|relative|fixed|sticky|container|space-|gap-|items-|justify-|rounded|border|bg-|text-|font-|shadow|hover:|focus:|dark:|sm:|md:|lg:|xl:)/.test(text)) return false;
  const tokens = text.split(/\s+/);
  const utilityTokens = tokens.filter((token) => /^(?:[a-z]+:)*(?:p[trblxy]?|m[trblxy]?|w|h|min-w|max-w|min-h|max-h|gap|space-[xy]|grid-cols|col-span|row-span|top|left|right|bottom|inset|z|opacity|scale|translate-[xy]|duration)-/.test(token));
  if (tokens.length > 1 && utilityTokens.length / tokens.length > 0.25) return false;
  const utilityMarkers = text.match(/(?:^|\s)(?:[a-z]+:)*(?:flex|grid|block|inline|hidden|absolute|relative|fixed|sticky|rounded(?:-[a-z0-9[\]/.-]+)?|border(?:-[a-z0-9[\]/.-]+)?|bg-[a-z0-9[\]/.-]+|text-[a-z0-9[\]/.-]+|font-[a-z0-9[\]/.-]+|shadow(?:-[a-z0-9[\]/.-]+)?|items-[a-z]+|justify-[a-z]+|overflow-[a-z]+|transition(?:-[a-z[\]-]+)?)(?=\s|$)/g) ?? [];
  return utilityMarkers.length < 2;
}

function add(value) {
  const text = normalize(value);
  if (looksLikeInterfaceText(text)) phrases.add(text);
}

function isVisibleContext(node) {
  let current = node.parent;
  while (current) {
    if (ts.isJsxAttribute(current)) {
      return /^(title|placeholder|aria-label|aria-description|alt)$/i.test(current.name.getText());
    }
    if (ts.isJsxExpression(current)) return true;
    if (ts.isCallExpression(current)) {
      const name = current.expression.getText();
      if (/(^|\.)(toast|notify|alert|confirm|setError|setMessage|setStatus|setNotice|setSuccess)$/i.test(name)) return true;
    }
    if (ts.isNewExpression(current) && current.expression.getText() === "Error") return true;
    if (ts.isPropertyAssignment(current)) {
      const name = current.name.getText().replace(/["']/g, "");
      if (!/^(href|url|path|slug|id|status|role|type|source|event|kind|value|key|code|className|route|table|column|method|scope)$/i.test(name)) return true;
    }
    if (ts.isSourceFile(current) || ts.isFunctionLike(current) || ts.isVariableDeclaration(current)) break;
    current = current.parent;
  }
  return false;
}

function inspect(absolute) {
  const relative = path.relative(root, absolute);
  if (excluded.has(relative)) return;
  const source = fs.readFileSync(absolute, "utf8");
  const file = ts.createSourceFile(
    absolute,
    source,
    ts.ScriptTarget.Latest,
    true,
    absolute.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  function visit(node) {
    if (ts.isJsxText(node)) add(node.getText(file));
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && isVisibleContext(node)) add(node.text);
    if (ts.isTemplateExpression(node) && isVisibleContext(node)) {
      add([node.head.text, ...node.templateSpans.map((span) => `{value}${span.literal.text}`)].join(""));
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) inspect(absolute);
  }
}

for (const sourceRoot of sourceRoots) walk(path.join(root, sourceRoot));

for (const relative of ["lib/i18n/interface-phrases.ts", "lib/i18n/config.ts"]) {
  let source = fs.readFileSync(path.join(root, relative), "utf8");
  for (const match of source.matchAll(/^\s*\["((?:\\.|[^"\\])*)",/gm)) add(JSON.parse(`"${match[1]}"`));
  if (relative.endsWith("config.ts")) {
    source = source.slice(source.indexOf("const english ="), source.indexOf("} as const;", source.indexOf("const english =")));
    for (const match of source.matchAll(/^\s*"[^"]+":\s*"((?:\\.|[^"\\])*)",?$/gm)) add(JSON.parse(`"${match[1]}"`));
  }
}

const locales = ["es", "fr", "zh", "ar", "hi", "de", "pt", "vi", "ja", "ko"];
let failed = false;
for (const locale of locales) {
  const dictionary = JSON.parse(fs.readFileSync(path.join(root, "lib/i18n/generated", `${locale}.json`), "utf8"));
  const missing = [...phrases].filter((phrase) => !dictionary[phrase]);
  if (missing.length) {
    failed = true;
    console.error(`${locale}: ${missing.length} missing interface translations`);
    console.error(missing.slice(0, 20).map((phrase) => `  - ${phrase}`).join("\n"));
  }
}

if (failed) process.exit(1);
console.log(`Internationalization coverage complete: ${phrases.size} phrases × ${locales.length} languages.`);
