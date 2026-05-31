import { cp, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

export async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

export async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function copyFileSafe(fromPath, toPath) {
  await ensureDir(path.dirname(toPath));
  await cp(fromPath, toPath, { force: true, recursive: false });
}

export async function copyDirectorySafe(fromPath, toPath) {
  await ensureDir(path.dirname(toPath));
  await cp(fromPath, toPath, { force: true, recursive: true });
}
