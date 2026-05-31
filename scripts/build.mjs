import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, rm, writeFile } from 'node:fs/promises';
import {
  copyDirectorySafe,
  copyFileSafe,
  ensureDir,
  pathExists
} from './copy-static.mjs';
import { validateManifestPath } from './validate-manifest.mjs';

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
const outputDir = path.join(rootDir, 'dist', target);
const dictionaryManifestUrl = process.env.DICTIONARY_MANIFEST_URL?.trim() || '';

await rm(outputDir, { recursive: true, force: true });
await ensureDir(outputDir);

const fileMap = [
  { from: 'src/common/content/contentScript.js', to: 'contentScript.js', required: true },
  { from: 'src/common/popup/popup.html', to: 'popup.html', required: true },
  { from: 'src/common/popup/popup.js', to: 'popup.js', required: true },
  { from: 'src/common/options/options.html', to: 'options.html', required: true },
  { from: 'src/common/options/options.js', to: 'options.js', required: true },
  { from: 'src/common/modal/popup-modal.html', to: 'popup-modal.html', required: true },
  { from: 'src/common/modal/popup-modal.css', to: 'popup-modal.css', required: true },
  { from: 'src/common/modal/popup-modal.js', to: 'popup-modal.js', required: true },
  { from: 'src/common/modal/modal.js', to: 'modal.js', required: true },
  { from: 'src/common/services/services.js', to: 'services.js', required: true },
  { from: 'src/common/pages/cw.html', to: 'cw.html', required: false }
];

for (const entry of fileMap) {
  const sourcePath = path.join(rootDir, entry.from);
  const targetPath = path.join(outputDir, entry.to);
  const sourceExists = await pathExists(sourcePath);

  if (!sourceExists) {
    if (entry.required) {
      throw new Error(`Missing required source file: ${entry.from}`);
    }

    continue;
  }

  await copyFileSafe(sourcePath, targetPath);
}

const builtServicesPath = path.join(outputDir, 'services.js');
if (await pathExists(builtServicesPath)) {
  if (dictionaryManifestUrl) {
    const servicesSource = await readFile(builtServicesPath, 'utf8');
    const placeholderDeclaration = "const DICTIONARY_MANIFEST_PLACEHOLDER = '__DICTIONARY_MANIFEST_URL__';";
    const patchedServices = servicesSource.replace(
      placeholderDeclaration,
      `const DICTIONARY_MANIFEST_PLACEHOLDER = ${JSON.stringify(dictionaryManifestUrl)};`
    );

    if (patchedServices === servicesSource) {
      throw new Error('Failed to inject DICTIONARY_MANIFEST_URL: placeholder declaration was not found.');
    }

    await writeFile(builtServicesPath, patchedServices, 'utf8');
    console.log('[build] Injected dictionary manifest URL from DICTIONARY_MANIFEST_URL');
  } else {
    console.warn('[build] DICTIONARY_MANIFEST_URL is not set. Manifest URL must be provided at runtime.');
  }
}

const iconsSourcePath = path.join(rootDir, 'assets', 'icons');
if (!(await pathExists(iconsSourcePath))) {
  throw new Error('Missing icons directory: assets/icons');
}
await copyDirectorySafe(iconsSourcePath, path.join(outputDir, 'icons'));

const manifestSourcePath = path.join(rootDir, 'src', target, 'manifest.json');
if (!(await pathExists(manifestSourcePath))) {
  throw new Error(`Missing manifest for target: ${target}`);
}

const manifestTargetPath = path.join(outputDir, 'manifest.json');
await copyFileSafe(manifestSourcePath, manifestTargetPath);
await validateManifestPath(manifestTargetPath);

console.log(`[build] ${target} build is ready at dist/${target}`);
