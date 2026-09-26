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
  // Application code only. Tests are counted separately so an option is not
  // penalised for being better tested.
  added: number;
  removed: number;
  files: string[];
  test_added: number;
  test_files: string[];
}

export function isTestFile(file: string): boolean {
  return /(^|\/)(test|tests|__tests__|spec)\//.test(file) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(file);
}

export function diffStats(dir: string, base: string, path: string): DiffStats {
  const numstat = git(dir, ["diff", "--numstat", base, "HEAD", "--", path]);
  const stats: DiffStats = { added: 0, removed: 0, files: [], test_added: 0, test_files: [] };
  for (const line of numstat.split("\n").filter(Boolean)) {
    const [a, r, file] = line.split("\t");
    if (file.endsWith("package-lock.json")) continue;
    if (isTestFile(file)) {
      stats.test_added += Number(a) || 0;
      stats.test_files.push(file);
      continue;
    }
    stats.added += Number(a) || 0;
    stats.removed += Number(r) || 0;
    stats.files.push(file);
  }
  return stats;
}

export function showFile(dir: string, rev: string, file: string): string | null {
  try {
    return git(dir, ["show", `${rev}:${file}`]);
  } catch {
    return null;
  }
}
