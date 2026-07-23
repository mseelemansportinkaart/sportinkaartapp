#!/usr/bin/env node
/**
 * Pre-build guard. Run automatically by `npm run build:ios` / `build:android`
 * before EAS is invoked.
 *
 * EAS builds from your committed git state. If your local clone is behind
 * origin, on the wrong branch, has uncommitted changes, or still points at a
 * retired Supabase project, the build ships the wrong code — which is exactly
 * how a stale build once went all the way to the App Store. This refuses to
 * build in any of those cases.
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const RETIRED_SUPABASE_REFS = ['pbcshmfqtncdvupsfdjq']; // old paused/dead projects
const REQUIRED_BRANCH = 'main';

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function fail(msg, fix) {
  console.error(`\n[31m✖ Pre-build check failed:[0m ${msg}`);
  if (fix) console.error(`  [33m→ ${fix}[0m`);
  console.error('');
  process.exit(1);
}

// 1. Correct branch
let branch;
try {
  branch = sh('git rev-parse --abbrev-ref HEAD');
} catch {
  fail('not inside a git repository.');
}
if (branch !== REQUIRED_BRANCH) {
  fail(
    `you are on "${branch}", not "${REQUIRED_BRANCH}".`,
    `Store builds ship from ${REQUIRED_BRANCH}: git checkout ${REQUIRED_BRANCH}`,
  );
}

// 2. Clean working tree (EAS ignores uncommitted changes — they silently won't ship)
if (sh('git status --porcelain')) {
  fail(
    'you have uncommitted changes; EAS builds only committed code, so they would NOT be in the build.',
    'Commit or stash them first: git status',
  );
}

// 3. In sync with origin (the failure mode that shipped a stale build)
try {
  sh('git fetch origin ' + REQUIRED_BRANCH);
} catch {
  fail('could not reach origin to check for updates.', 'Check your network and retry.');
}
const local = sh('git rev-parse HEAD');
const remote = sh(`git rev-parse origin/${REQUIRED_BRANCH}`);
if (local !== remote) {
  const behind = sh(`git rev-list --count HEAD..origin/${REQUIRED_BRANCH}`);
  const ahead = sh(`git rev-list --count origin/${REQUIRED_BRANCH}..HEAD`);
  fail(
    `local ${REQUIRED_BRANCH} is out of sync with origin (behind ${behind}, ahead ${ahead}).`,
    `Pull the latest before building: git pull origin ${REQUIRED_BRANCH}`,
  );
}

// 4. Not pointing at a retired Supabase project
const supabasePath = path.join(__dirname, '..', 'lib', 'supabase.js');
const supabaseSrc = fs.readFileSync(supabasePath, 'utf8');
const retired = RETIRED_SUPABASE_REFS.find((ref) => supabaseSrc.includes(ref));
if (retired) {
  fail(
    `lib/supabase.js still references the retired Supabase project "${retired}".`,
    'Point it at the live project before building.',
  );
}

// Surface what will actually ship, so it is visible in the build log.
const urlMatch = supabaseSrc.match(/https:\/\/[a-z0-9]+\.supabase\.co/i);
console.log(
  `[32m✓ Pre-build checks passed[0m — ${REQUIRED_BRANCH} @ ${local.slice(0, 7)}, ` +
    `Supabase ${urlMatch ? urlMatch[0] : '(url not found)'}\n`,
);
