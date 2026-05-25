import { mkdir, readdir, rename, rm, stat, unlink } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { paths } from "./paths.ts";

export interface TrashOptions {
  sessionsRoot?: string;
  trashRoot?: string;
}

export interface TrashManageOptions {
  trashRoot?: string;
  expectedTrashRoot?: string;
  codexRoot?: string;
}

export interface TrashBucket {
  name: string;
  path: string;
  files: number;
  bytes: number;
}

export interface TrashSummary {
  root: string;
  buckets: TrashBucket[];
  files: number;
  bytes: number;
}

export async function moveToTrash(rolloutPath: string, opts: TrashOptions = {}): Promise<string | null> {
  assertSessionRolloutPath(rolloutPath, opts.sessionsRoot ?? paths.sessions);
  if (!(await exists(rolloutPath))) return null;

  const stamp = new Date().toISOString().slice(0, 10);
  const bucket = join(opts.trashRoot ?? paths.trash, stamp);
  await mkdir(bucket, { recursive: true });

  const dest = join(bucket, basename(rolloutPath));
  await rename(rolloutPath, dest);
  return dest;
}

export async function hardDelete(rolloutPath: string, opts: TrashOptions = {}): Promise<boolean> {
  assertSessionRolloutPath(rolloutPath, opts.sessionsRoot ?? paths.sessions);
  if (!(await exists(rolloutPath))) return false;
  await unlink(rolloutPath);
  return true;
}

export async function inspectTrash(opts: TrashManageOptions = {}): Promise<TrashSummary> {
  const trashRoot = opts.trashRoot ?? paths.trash;
  assertTrashPath(trashRoot, opts.expectedTrashRoot ?? paths.trash, opts.codexRoot ?? paths.codexHome);
  const buckets = await listBuckets(trashRoot);
  const files = buckets.reduce((total, bucket) => total + bucket.files, 0);
  const bytes = buckets.reduce((total, bucket) => total + bucket.bytes, 0);
  return { root: trashRoot, buckets, files, bytes };
}

export async function emptyTrash(opts: TrashManageOptions = {}): Promise<TrashSummary> {
  const summary = await inspectTrash(opts);
  if (summary.files === 0) return summary;
  await rm(summary.root, { recursive: true, force: true });
  return summary;
}

function assertSessionRolloutPath(rolloutPath: string, sessionsRootPath: string): void {
  // Rollout paths come from Codex state; constrain destructive operations to the session tree.
  const sessionsRoot = resolve(sessionsRootPath);
  const candidate = resolve(rolloutPath);
  const pathFromRoot = relative(sessionsRoot, candidate);
  const isInsideSessions = pathFromRoot !== "" && !pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot);
  if (!isInsideSessions) {
    throw new Error(`refusing to delete rollout outside Codex sessions: ${rolloutPath}`);
  }
}

function assertTrashPath(trashRoot: string, expectedTrashRoot: string, codexRootPath: string): void {
  const codexRoot = resolve(codexRootPath);
  const trashPath = resolve(trashRoot);
  const expected = resolve(expectedTrashRoot);
  const pathFromCodex = relative(codexRoot, trashPath);
  const isInsideCodex = pathFromCodex !== "" && !pathFromCodex.startsWith("..") && !isAbsolute(pathFromCodex);
  if (!isInsideCodex || trashPath !== expected) {
    throw new Error(`refusing to manage trash outside dexcow trash: ${trashRoot}`);
  }
}

async function listBuckets(trashRoot: string): Promise<TrashBucket[]> {
  let entries: Awaited<ReturnType<typeof readDirents>>;
  try {
    entries = await readDirents(trashRoot);
  } catch (err) {
    if (isMissingPath(err)) return [];
    throw err;
  }

  const buckets: TrashBucket[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const bucketPath = join(trashRoot, entry.name);
    const size = await directorySize(bucketPath);
    buckets.push({ name: entry.name, path: bucketPath, files: size.files, bytes: size.bytes });
  }
  return buckets.sort((a, b) => b.name.localeCompare(a.name));
}

async function readDirents(path: string) {
  return readdir(path, { withFileTypes: true });
}

async function directorySize(root: string): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      const child = await directorySize(path);
      files += child.files;
      bytes += child.bytes;
      continue;
    }
    if (entry.isFile()) {
      const file = await stat(path);
      files++;
      bytes += file.size;
    }
  }
  return { files, bytes };
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function isMissingPath(err: unknown): boolean {
  const code = (err as { code?: unknown }).code;
  return code === "ENOENT";
}
