#!/usr/bin/env node

/**
 * Pre-commit hook for SkolnieksAI
 * Catches critical mistakes before they reach the repo.
 *
 * Claude Code hook config: PreToolUse on Bash(git commit)
 * Blocks commit if checks fail.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execSync } = require('child_process');

const ERRORS = [];

// 1. Check for leaked secrets in staged files
const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

const SECRET_PATTERNS = [
  /sk-ant-[a-zA-Z0-9-_]+/,       // Anthropic API key
  /sk-[a-f0-9]{48,}/,             // DeepSeek-style key
  /sk_live_[a-zA-Z0-9]+/,         // Stripe live key
  /whsec_[a-zA-Z0-9]+/,           // Stripe webhook secret
  /AIza[a-zA-Z0-9-_]{35}/,        // Firebase API key (in server code)
];

for (const file of stagedFiles) {
  if (file.startsWith('.env') || file === '.env.local' || file === '.env.production') {
    ERRORS.push(`BLOCKED: ${file} — never commit env files`);
    continue;
  }

  // Skip binary and non-text files
  if (/\.(png|jpg|gif|pdf|woff|woff2|ttf|ico)$/.test(file)) continue;

  try {
    const content = execSync(`git show :${file}`, { encoding: 'utf8' });
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(content)) {
        ERRORS.push(`BLOCKED: ${file} contains what looks like a secret key`);
        break;
      }
    }
  } catch {
    // File might be deleted in this commit
  }
}

// 2. Check for VISC exam paper references
for (const file of stagedFiles) {
  if (/\.(ts|tsx|js|json|md)$/.test(file)) {
    try {
      const content = execSync(`git show :${file}`, { encoding: 'utf8' });
      if (/visc.*exam|eksamen.*visc|centralizet.*eksamen/i.test(content)) {
        ERRORS.push(`WARNING: ${file} references VISC exams — legal clearance pending`);
      }
    } catch {}
  }
}

// 3. Check for console.log in production code (not test files)
for (const file of stagedFiles) {
  if (/\.(ts|tsx)$/.test(file) && !file.includes('.test.') && !file.includes('scripts/')) {
    try {
      const content = execSync(`git show :${file}`, { encoding: 'utf8' });
      const matches = content.match(/console\.(log|debug)\(/g);
      if (matches && matches.length > 0) {
        ERRORS.push(`WARNING: ${file} has ${matches.length} console.log statement(s) — remove before production`);
      }
    } catch {}
  }
}

// Report
if (ERRORS.length > 0) {
  console.error('\n🚫 Pre-commit checks failed:\n');
  ERRORS.forEach(e => console.error(`  ❌ ${e}`));
  console.error('\nFix these issues before committing.\n');
  process.exit(1);
} else {
  console.log('✅ Pre-commit checks passed');
  process.exit(0);
}
