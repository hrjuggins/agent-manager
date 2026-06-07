import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { basename, dirname, join } from 'path';

export interface WorktreeResult {
	success: boolean;
	worktreePath?: string;
	message: string;
}

function getWorktreeBase(repoPath: string): string {
	const repoName = basename(repoPath);
	const parentDir = dirname(repoPath);
	return join(parentDir, `${repoName}-worktrees`);
}

function sanitizeBranchName(branch: string): string {
	return branch.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+|-+$/g, '');
}

export function createWorktree(repoPath: string, branch: string): WorktreeResult {
	if (!existsSync(repoPath)) {
		return { success: false, message: `Repository not found: ${repoPath}` };
	}

	const worktreeBase = getWorktreeBase(repoPath);
	const worktreeName = sanitizeBranchName(branch);
	const worktreePath = join(worktreeBase, worktreeName);

	if (existsSync(worktreePath)) {
		return { success: true, worktreePath, message: `Worktree already exists at ${worktreePath}` };
	}

	try {
		// Check if branch exists on remote or locally
		let branchExists = false;
		try {
			execSync(`git -C "${repoPath}" rev-parse --verify "${branch}"`, { stdio: 'pipe' });
			branchExists = true;
		} catch {
			// Branch doesn't exist locally, check remote
			try {
				execSync(`git -C "${repoPath}" rev-parse --verify "origin/${branch}"`, {
					stdio: 'pipe'
				});
				branchExists = true;
			} catch {
				// Branch doesn't exist anywhere — will be created
			}
		}

		if (branchExists) {
			execSync(`git -C "${repoPath}" worktree add "${worktreePath}" "${branch}"`, {
				stdio: 'pipe'
			});
		} else {
			execSync(`git -C "${repoPath}" worktree add -b "${branch}" "${worktreePath}"`, {
				stdio: 'pipe'
			});
		}

		return { success: true, worktreePath, message: `Worktree created at ${worktreePath}` };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { success: false, message: `Failed to create worktree: ${msg}` };
	}
}

export function removeWorktree(repoPath: string, worktreePath: string): WorktreeResult {
	if (!existsSync(worktreePath)) {
		return { success: true, message: 'Worktree already removed' };
	}

	try {
		execSync(`git -C "${repoPath}" worktree remove "${worktreePath}" --force`, {
			stdio: 'pipe'
		});
		return { success: true, message: `Worktree removed: ${worktreePath}` };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { success: false, message: `Failed to remove worktree: ${msg}` };
	}
}

export function listWorktrees(repoPath: string): string[] {
	try {
		const output = execSync(`git -C "${repoPath}" worktree list --porcelain`, {
			encoding: 'utf-8',
			stdio: 'pipe'
		});
		const paths: string[] = [];
		for (const line of output.split('\n')) {
			if (line.startsWith('worktree ')) {
				paths.push(line.slice('worktree '.length));
			}
		}
		return paths;
	} catch {
		return [];
	}
}
