// Run by the package "prepare" script: points git at .githooks so the pre-commit check runs.
// Skips quietly where there is no git checkout (a Vercel build may have no .git folder), so
// `npm install` doesn't fail there. In a real checkout a failure still fails the install.
import { execFileSync } from 'node:child_process';

try {
  execFileSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' });
} catch {
  process.exit(0);
}
execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'inherit' });
