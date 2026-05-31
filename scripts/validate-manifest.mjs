import { readFile } from 'node:fs/promises';

const REQUIRED_FIELDS = ['manifest_version', 'name', 'version'];

export async function validateManifestPath(manifestPath) {
  const raw = await readFile(manifestPath, 'utf8');

  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Manifest is not valid JSON: ${error.message}`);
  }

  for (const field of REQUIRED_FIELDS) {
    if (!manifest[field]) {
      throw new Error(`Manifest validation failed: missing field \"${field}\"`);
    }
  }

  if (manifest.manifest_version !== 3) {
    throw new Error('Manifest validation failed: only manifest_version 3 is supported');
  }

  if (!manifest.action || !manifest.action.default_popup) {
    throw new Error('Manifest validation failed: action.default_popup is required');
  }

  if (!Array.isArray(manifest.content_scripts) || manifest.content_scripts.length === 0) {
    throw new Error('Manifest validation failed: content_scripts must be a non-empty array');
  }

  return manifest;
}
