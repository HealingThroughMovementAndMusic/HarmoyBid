#!/usr/bin/env node
// Static audit for Harmony WS — checks the conventions documented in CLAUDE.md:
// money math must use bignumber.js, inputs must be Zod-validated before they're
// persisted, the app stays RTL-only, and the WhatsApp/signature conversion
// features exist. Heuristic AST scan via @babel/parser + @babel/traverse (TSX-
// aware, synchronous, pure JS) — not a full data-flow analysis, so treat
// "warn"/"info" findings as leads to check by hand rather than hard failures.
// Only "error" findings fail the run.
//
// Note: this deliberately does NOT use the `typescript` package's compiler
// API. TypeScript 7's package no longer ships the classic synchronous
// createSourceFile/forEachChild API (parsing now goes through the native
// tsgo binary) — @babel/parser is the stable, synchronous, pure-JS
// alternative for a standalone script like this one.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

const traverse = typeof _traverse === 'function' ? _traverse : _traverse.default;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');

const MONEY_KEYWORDS = [
  'price', 'total', 'revenue', 'cost', 'amount', 'vat', 'subtotal',
  'payroll', 'wage', 'commission', 'discount', 'grandtotal', 'fee', 'margin',
];
const HEBREW_MONEY_KEYWORDS = ['מחיר', 'סכום', 'עלות', 'שכר', 'עמלה', 'מעמ', 'סהכ'];

function walk(dir, exts, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, out);
    else if (exts.includes(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function relPath(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function matchesMoneyKeyword(name) {
  const n = name.toLowerCase();
  return MONEY_KEYWORDS.some((k) => n.includes(k)) || HEBREW_MONEY_KEYWORDS.some((k) => name.includes(k));
}

function isEventHandlerAttrName(name) {
  return /^on[A-Z]/.test(name);
}

const findings = [];

function addFinding(file, line, rule, severity, message) {
  findings.push({ file: relPath(file), line, rule, severity, message });
}

const files = walk(SRC_DIR, ['.ts', '.tsx']);

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');

  let ast;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      allowImportExportEverywhere: true,
    });
  } catch (err) {
    addFinding(file, 1, 'parse-error', 'warn', `Could not parse file, skipped: ${err.message}`);
    continue;
  }

  let hasReactHookForm = false;
  let hasZodResolver = false;

  traverse(ast, {
    ImportDeclaration(p) {
      if (p.node.source.value === 'react-hook-form') hasReactHookForm = true;
    },
    Identifier(p) {
      if (p.node.name === 'zodResolver') hasZodResolver = true;
    },
    CallExpression(p) {
      const { callee } = p.node;

      // Check: raw numeric coercion inside an event handler, not guarded by
      // a Zod parse/safeParse in the same statement.
      if (callee.type === 'Identifier' && ['parseFloat', 'parseInt', 'Number'].includes(callee.name)) {
        const attrPath = p.findParent((anc) => anc.isJSXAttribute());
        if (attrPath && attrPath.node.name?.type === 'JSXIdentifier' && isEventHandlerAttrName(attrPath.node.name.name)) {
          const stmtPath = p.getStatementParent();
          const stmtText = stmtPath ? code.slice(stmtPath.node.start, stmtPath.node.end) : code.slice(p.node.start, p.node.end);
          if (!/\.(parse|safeParse)\s*\(/.test(stmtText)) {
            addFinding(
              file, p.node.loc.start.line, 'validation-bypass', 'error',
              `Raw ${callee.name}(...) coercion inside "${attrPath.node.name.name}" handler without a Zod .parse()/.safeParse() in the same statement — value can reach state/localStorage unvalidated. See CLAUDE.md → Input validation.`,
            );
          }
        }
      }

      // Check: localStorage round-trip — flag so it's checked for schema validation.
      if (
        callee.type === 'MemberExpression'
        && callee.object.type === 'Identifier' && callee.object.name === 'localStorage'
        && callee.property.type === 'Identifier' && ['setItem', 'getItem'].includes(callee.property.name)
      ) {
        addFinding(
          file, p.node.loc.start.line, 'localstorage-unvalidated', 'warn',
          `localStorage.${callee.property.name}(...) call — ensure the value is Zod-validated on both write and read (CLAUDE.md → Input validation).`,
        );
      }
    },
    BinaryExpression(p) {
      if (!['+', '-', '*', '/'].includes(p.node.operator)) return;
      const nameOf = (node) => {
        if (node.type === 'Identifier') return node.name;
        if (node.type === 'MemberExpression' && node.property.type === 'Identifier') return node.property.name;
        return null;
      };
      const leftName = nameOf(p.node.left);
      const rightName = nameOf(p.node.right);
      const moneyName = [leftName, rightName].find((n) => n && matchesMoneyKeyword(n));
      if (moneyName) {
        const stmtPath = p.getStatementParent();
        const stmtText = stmtPath ? code.slice(stmtPath.node.start, stmtPath.node.end) : code.slice(p.node.start, p.node.end);
        if (!/BigNumber|\.times\(|\.plus\(|\.minus\(|\.dividedBy\(/.test(stmtText)) {
          addFinding(
            file, p.node.loc.start.line, 'money-math-outside-bignumber', 'warn',
            `Arithmetic on "${moneyName}" outside a BigNumber chain — money math must use bignumber.js (CLAUDE.md → Money math).`,
          );
        }
      }
    },
  });

  if (hasReactHookForm && !hasZodResolver) {
    addFinding(
      file, 1, 'rhf-zod-not-wired', 'info',
      'react-hook-form is used here but zodResolver is not — form isn\'t wired to its Zod schema (CLAUDE.md → Input validation).',
    );
  }

  // Text-based checks: XSS surface + RTL-only invariant.
  code.split('\n').forEach((lineText, idx) => {
    if (
      /dangerouslySetInnerHTML/.test(lineText)
      || /\.innerHTML\s*=/.test(lineText)
      || /\beval\s*\(/.test(lineText)
      || /new Function\s*\(/.test(lineText)
    ) {
      addFinding(
        file, idx + 1, 'xss-surface', 'error',
        `Potential XSS surface: "${lineText.trim().slice(0, 80)}"`,
      );
    }
    const rtlVariantMatch = lineText.match(/\b(rtl|ltr):[a-zA-Z0-9-]/);
    if (rtlVariantMatch) {
      addFinding(
        file, idx + 1, 'rtl-only-invariant', 'warn',
        `Tailwind "${rtlVariantMatch[0]}" variant found — app is RTL-only by convention, this shouldn't be needed (CLAUDE.md → RTL).`,
      );
    }
  });
}

// Project-level check: index.html must keep declaring dir="rtl".
const indexHtmlPath = path.join(ROOT, 'index.html');
if (fs.existsSync(indexHtmlPath)) {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  if (!/dir\s*=\s*["']rtl["']/.test(html)) {
    addFinding(
      indexHtmlPath, 1, 'rtl-only-invariant', 'error',
      'index.html no longer declares dir="rtl" on <html> — this breaks the RTL-only convention (CLAUDE.md → RTL).',
    );
  }
}

// Project-level presence checks: WhatsApp button + digital signature.
const allSrcText = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
if (!/wa\.me|whatsapp/i.test(allSrcText)) {
  addFinding(
    SRC_DIR, 0, 'missing-whatsapp', 'warn',
    'No WhatsApp contact button/link (wa.me) found anywhere in src/ — conversion feature not yet implemented (CLAUDE.md → Conversion features).',
  );
}
if (!/signature/i.test(allSrcText)) {
  addFinding(
    SRC_DIR, 0, 'missing-signature', 'warn',
    'No digital-signature capture component found anywhere in src/ — conversion feature not yet implemented (CLAUDE.md → Conversion features).',
  );
}

findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

const reportPath = path.join(ROOT, 'scripts', 'audit-report.json');
fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), findings }, null, 2));

const bySeverity = { error: 0, warn: 0, info: 0 };
for (const f of findings) bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;

console.log(`\nquote-audit — ${findings.length} finding(s)  (error: ${bySeverity.error}, warn: ${bySeverity.warn}, info: ${bySeverity.info})\n`);
for (const f of findings) {
  const tag = f.severity.toUpperCase().padEnd(5);
  console.log(`[${tag}] ${f.file}:${f.line}  (${f.rule})\n        ${f.message}`);
}
console.log(`\nFull report written to ${relPath(reportPath)}\n`);

process.exit(bySeverity.error > 0 ? 1 : 0);
