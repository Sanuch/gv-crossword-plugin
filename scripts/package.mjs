import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { pathExists } from './copy-static.mjs';

const SUPPORTED_TARGETS = new Set(['chrome', 'firefox']);

function parseTarget(argv) {
  let target;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument.startsWith('--target=')) {
      target = argument.slice('--target='.length);
    }

    if (argument === '--target' && argv[index + 1]) {
      target = argv[index + 1];
    }
  }

  const resolvedTarget = target ?? 'chrome';

  if (!SUPPORTED_TARGETS.has(resolvedTarget)) {
    throw new Error(`Unsupported target \"${resolvedTarget}\". Use chrome or firefox.`);
  }

  return resolvedTarget;
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = parseTarget(process.argv.slice(2));
const buildDir = path.join(rootDir, 'dist', target);

if (!(await pathExists(buildDir))) {
  throw new Error(`Build directory does not exist: dist/${target}. Run build first.`);
}

const archivePath = path.join(rootDir, 'dist', `crossword-${target}.zip`);
await rm(archivePath, { force: true });

const result = spawnSync('zip', ['-r', archivePath, '.'], {
  cwd: buildDir,
  stdio: 'inherit'
});

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  throw new Error(`zip command failed with exit code ${result.status}`);
}

console.log(`[package] Archive created: dist/crossword-${target}.zip`);
