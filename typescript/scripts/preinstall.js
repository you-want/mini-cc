#!/usr/bin/env node

/**
 * Preinstall script for mini-cc
 * 
 * This script prevents installation with npm or yarn in local development,
 * but allows global installation.
 */

const { env } = process;

// Skip if:
// 1. It's a global installation (npm_config_global is set)
// 2. It's running in CI environment
// 3. It's running with bun
if (env.npm_config_global || env.CI || env.BUN_INSTALL) {
  process.exit(0);
}

// Check if using pnpm
const userAgent = env.npm_config_user_agent || '';
if (userAgent.startsWith('pnpm')) {
  process.exit(0);
}

// Warn and exit if not using pnpm
console.error(
  '\x1b[31m',
  'Error: mini-cc requires pnpm for local development. Please install with:',
  '\x1b[0m',
  '\n\n  pnpm install\n'
);
process.exit(1);
