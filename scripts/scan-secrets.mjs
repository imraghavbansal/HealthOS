#!/usr/bin/env node
// Blocks commits that introduce hardcoded high-entropy secrets. Scans only
// staged additions (git diff --cached), not the whole tree, so it's fast
// and only flags what's actually about to be committed.
import { execSync } from "node:child_process";

function shannonEntropy(str) {
  const freq = {};
  for (const c of str) freq[c] = (freq[c] || 0) + 1;
  let entropy = 0;
  for (const c in freq) {
    const p = freq[c] / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

// Known-safe patterns that are legitimately public or just look random:
// dependency lockfile integrity hashes, Supabase's publishable anon key
// prefix (RLS-protected by design, meant to be public), CSS/URL/MIME noise.
const ALLOWLIST_PREFIX = /^(sha512-|sha384-|sha256-|sha1-|sb_publishable_)/;
const ALLOWLIST_LINE = /^(node_modules|https?:|www\.|application\/|image\/|text\/)/;
const PLAIN_WORD = /^[a-z][a-z-]*$/; // css classes, kebab-case identifiers etc.

const TOKEN_RE = /["'`]([A-Za-z0-9+/_=.-]{20,})["'`]/g;

// Known secret-shaped formats worth calling out by name even below the
// entropy bar (JWTs, common provider key prefixes).
const NAMED_PATTERNS = [
  { name: "JWT", re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: "Anthropic API key", re: /sk-ant-[A-Za-z0-9-]{20,}/ },
  { name: "OpenAI-style API key", re: /sk-[A-Za-z0-9]{20,}/ },
  { name: "Google API key", re: /AIza[0-9A-Za-z_-]{35}/ },
  { name: "Razorpay live key", re: /rzp_live_[A-Za-z0-9]+/ },
  { name: "Postgres/Mongo connection string with credentials", re: /(postgres(ql)?|mongodb(\+srv)?):\/\/[^\s'"]+:[^\s'"]+@/ },
];

function getStagedDiff() {
  try {
    return execSync("git diff --cached -U0", { maxBuffer: 1024 * 1024 * 50 }).toString();
  } catch {
    return "";
  }
}

function main() {
  const diff = getStagedDiff();
  if (!diff) return 0;

  const findings = [];
  let currentFile = null;

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice(6);
      continue;
    }
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    if (/\.(lock|lockb)$/.test(currentFile || "") || /package-lock\.json$/.test(currentFile || "")) continue;

    for (const { name, re } of NAMED_PATTERNS) {
      const m = line.match(re);
      if (m) findings.push({ file: currentFile, kind: name, snippet: m[0].slice(0, 12) + "…" });
    }

    let m;
    while ((m = TOKEN_RE.exec(line))) {
      const tok = m[1];
      if (ALLOWLIST_PREFIX.test(tok) || ALLOWLIST_LINE.test(tok) || PLAIN_WORD.test(tok)) continue;
      if (/^[0-9.]+$/.test(tok)) continue;

      // Pure lowercase-hex tokens of common secret/hash lengths (128/160/256-bit)
      // are flagged outright — hex's 16-symbol alphabet caps entropy at 4.0,
      // so a fixed threshold tuned for base64-ish secrets misses these.
      if (/^[0-9a-f]+$/.test(tok) && [32, 40, 64, 128].includes(tok.length)) {
        findings.push({ file: currentFile, kind: `hex string (${tok.length} chars)`, snippet: tok.slice(0, 10) + "…" });
        continue;
      }

      // Normalize entropy against the alphabet actually observed, so a
      // hex string (max 4.0) and a base64 string (max ~6.0) are judged on
      // the same relative scale instead of one fixed absolute cutoff.
      const alphabetSize = new Set(tok).size;
      const maxEntropy = Math.log2(Math.max(alphabetSize, 2));
      const ent = shannonEntropy(tok);
      if (tok.length >= 28 && maxEntropy > 0 && ent / maxEntropy > 0.85) {
        findings.push({ file: currentFile, kind: "high-entropy string", snippet: tok.slice(0, 10) + "…" });
      }
    }
  }

  if (findings.length === 0) return 0;

  console.error("\n🔒 scan-secrets: possible hardcoded secret(s) in staged changes:\n");
  for (const f of findings) {
    console.error(`  ${f.file}: ${f.kind} (${f.snippet})`);
  }
  console.error(
    "\nIf this is a real secret: don't commit it — read it from an env var instead."
  );
  console.error(
    "If this is a false positive: add its exact pattern to the ALLOWLIST in scripts/scan-secrets.mjs,"
  );
  console.error("or bypass once with: git commit --no-verify\n");
  return 1;
}

process.exit(main());
