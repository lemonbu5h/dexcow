import { mkdir, rename, unlink, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { paths } from "./paths.ts";

export async function moveToTrash(rolloutPath: string): Promise<string | null> {
  if (!(await exists(rolloutPath))) return null;

  const stamp = new Date().toISOString().slice(0, 10);
  const bucket = join(paths.trash, stamp);
  await mkdir(bucket, { recursive: true });

  const dest = join(bucket, basename(rolloutPath));
  await rename(rolloutPath, dest);
  return dest;
}

export async function hardDelete(rolloutPath: string): Promise<boolean> {
  if (!(await exists(rolloutPath))) return false;
  await unlink(rolloutPath);
  return true;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
