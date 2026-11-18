// Pre-commit safety net (run by .githooks/pre-commit):
// 1. refuses staged secret-bearing or build files (.env, node_modules, build output, local settings);
// 2. refuses staged content containing real keys;
// 3. runs the fast checks listed in FAST_CHECKS.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// Add cheap project checks here (each runs with `node <script>`); keep the hook under a few seconds.
const FAST_CHECKS = [];

// The default 1 MB buffer overflows (ENOBUFS) on large staged diffs, e.g. vendored skills.
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const staged = git('diff', '--cached', '--name-only', '--diff-filter=ACMR').split('\n').filter(Boolean);
const problems = [];

const BLOCKED_PATHS = [
  [/(^|\/)\.env(\.[^/]*)?$/, 'environment file (keys)'],
  [/(^|\/)node_modules\//, 'node_modules'],
  [/(^|\/)\.expo\//, 'Expo build cache'],
  [/(^|\/)(dist|build|web-build|\.next|\.vercel|coverage)\//, 'build output'],
  [/^supabase\/\.temp\//, 'Supabase CLI temp files'],
  [/^\.claude\/settings\.local\.json$/, 'personal Claude settings'],
];
for (const file of staged) {
  if (file.endsWith('.env.example')) continue;
  for (const [re, why] of BLOCKED_PATHS) if (re.test(file)) problems.push(`${file}: ${why} must not be committed`);
}

const SECRET_PATTERNS = [
  [/sb_secret_[A-Za-z0-9_-]{10,}/, 'Supabase secret key'],
  [/\bsk_(live|test)_[A-Za-z0-9]{10,}/, 'Stripe secret key'],
  [/\brk_(live|test)_[A-Za-z0-9]{10,}/, 'Stripe restricted key'],
  [/whsec_[A-Za-z0-9]{10,}/, 'Stripe webhook secret'],
  [/\bsk-ant-[A-Za-z0-9_-]{20,}/, 'Anthropic API key'],
  [/\bsk-(proj-)?[A-Za-z0-9]{32,}/, 'OpenAI-style API key'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, 'GitHub token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/eyJhbGciOiJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, 'JWT (e.g. a service_role key)'],
];
const diff = git('diff', '--cached', '-U0', '--diff-filter=ACMR');
let file = '';
for (const line of diff.split('\n')) {
  if (line.startsWith('+++ b/')) file = line.slice(6);
  if (!line.startsWith('+') || line.startsWith('+++')) continue;
  for (const [re, what] of SECRET_PATTERNS) if (re.test(line)) problems.push(`${file}: looks like a ${what}`);
}

if (problems.length) {
  console.error('Commit blocked:\n  ' + [...new Set(problems)].join('\n  '));
  console.error('Unstage the file (git restore --staged <file>) or remove the secret. Do not use --no-verify.');
  process.exit(1);
}

for (const script of FAST_CHECKS) {
  if (!existsSync(script)) continue;
  try {
    execFileSync('node', [script], { stdio: 'inherit' });
  } catch {
    console.error(`Commit blocked: ${script} failed.`);
    process.exit(1);
  }
}
