import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function repoRoot(cwd: string): string {
  return git(cwd, ["rev-parse", "--show-toplevel"]);
}

export function headCommit(cwd: string): string {
  return git(cwd, ["rev-parse", "HEAD"]);
}

// Uncommitted changes under `path` would be missing from every option's
// worktree, so the run would measure something other than what the user sees.
export function dirtyFiles(cwd: string, path: string): string[] {
  const out = git(cwd, ["status", "--porcelain", "--", path]);
  return out ? out.split("\n") : [];
}

export function addWorktree(root: string, dir: string, branch: string, base: string): void {
  mkdirSync(join(dir, ".."), { recursive: true });
  if (existsSync(dir)) throw new Error(`worktree directory already exists: ${dir}`);
  git(root, ["worktree", "add", "-b", branch, dir, base]);
}

export function commitAll(dir: string, message: string): boolean {
  git(dir, ["add", "-A"]);
  const staged = git(dir, ["diff", "--cached", "--name-only"]);
  if (!staged) return false;
  git(dir, ["-c", "user.name=settle", "-c", "user.email=settle@localhost", "commit", "-q", "-m", message]);
  return true;
}

export interface DiffStats {
  added: number;
  removed: number;
  files: string[];
}

export function diffStats(dir: string, base: string, path: string): DiffStats {
  const numstat = git(dir, ["diff", "--numstat", base, "HEAD", "--", path]);
  let added = 0;
  let removed = 0;
  const files: string[] = [];
  for (const line of numstat.split("\n").filter(Boolean)) {
    const [a, r, file] = line.split("\t");
    if (file.endsWith("package-lock.json")) continue;
    added += Number(a) || 0;
    removed += Number(r) || 0;
    files.push(file);
  }
  return { added, removed, files };
}

export function showFile(dir: string, rev: string, file: string): string | null {
  try {
    return git(dir, ["show", `${rev}:${file}`]);
  } catch {
    return null;
  }
}
