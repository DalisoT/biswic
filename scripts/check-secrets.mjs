#!/usr/bin/env node
/**
 * check-secrets.mjs
 * ----------------------------------------------------------------------------
 * Fails the build if the Supabase SERVICE_ROLE_KEY is referenced from any
 * file that ships to the browser (anything under src/app/** or
 * src/components/**).
 *
 * The service role key bypasses RLS. If a frontend file ever imports it,
 * the entire database becomes public to anyone with that build. This
 * check enforces the runbook's §4 "Service-role key: server-only" rule.
 *
 * Run via: pnpm check:secrets
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const FORBIDDEN_ROOTS = ['src/app', 'src/components'];
const SEARCH_PATTERNS = [
  /SUPABASE_SERVICE_ROLE_KEY/g,
  /process\.env\.SUPABASE_SERVICE_ROLE_KEY/g,
];

const errors = [];

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) {
      continue;
    }
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry)) {
      const rel = relative(projectRoot, full).replace(/\\/g, '/');
      const inForbiddenRoot = FORBIDDEN_ROOTS.some(
        (root) => rel === root || rel.startsWith(root + '/')
      );
      if (!inForbiddenRoot) continue;

      const content = readFileSync(full, 'utf8');
      for (const pattern of SEARCH_PATTERNS) {
        if (pattern.test(content)) {
          errors.push(rel);
          break;
        }
      }
    }
  }
}

walk(projectRoot);

if (errors.length > 0) {
  console.error('\n[check:secrets] FAIL: SUPABASE_SERVICE_ROLE_KEY referenced in browser-shipped files:');
  for (const file of errors) {
    console.error(`  - ${file}`);
  }
  console.error('\nThe service role key bypasses RLS. Move this code to a server-only path (src/lib/supabase/admin.ts, a server action, a route handler, or src/server/**).');
  process.exit(1);
} else {
  console.log('[check:secrets] OK: no service-role key references in src/app or src/components.');
}
