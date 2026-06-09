import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getRepoByPath, getTerminalApp } from '$lib/server/config';
import { listWorktrees } from '$lib/server/worktree';
import type { RepoConfig } from '$lib/types';

export function readRepoConfig(repoPath: string): RepoConfig | null {
	// Check app settings first (repo configured via Settings UI)
	const repoSettings = getRepoByPath(repoPath);
	if (repoSettings) {
		const lines = repoSettings.setupScript
			? repoSettings.setupScript.split('\n').filter((l) => l.trim())
			: [];

		if (lines.length === 0) return null;
		return { setup: lines };
	}

	// Fallback: check for .workstream-hub.json in repo root
	const configPath = join(repoPath, '.workstream-hub.json');
	if (!existsSync(configPath)) {
		return null;
	}
	try {
		const raw = readFileSync(configPath, 'utf-8');
		return JSON.parse(raw) as RepoConfig;
	} catch {
		return null;
	}
}

/**
 * Calculate PORT_OFFSET for a worktree based on its position in git worktree list.
 * Uses case-insensitive comparison for macOS APFS compatibility.
 */
export function getPortOffset(repoPath: string, cwd: string): number {
	const worktrees = listWorktrees(repoPath);
	const cwdLower = cwd.toLowerCase();
	const worktreeIndex = worktrees.findIndex((w) => w.toLowerCase() === cwdLower);
	return worktreeIndex >= 0 ? worktreeIndex : worktrees.length;
}

/**
 * Write a temporary setup script to disk and open it in Terminal.app.
 * The script runs in the worktree directory with PORT_OFFSET set.
 */
export function openTerminalWithSetup(
	repoPath: string,
	cwd: string
): { success: boolean; message: string } {
	const config = readRepoConfig(repoPath);
	const terminalApp = getTerminalApp();

	if (!config?.setup || config.setup.length === 0) {
		// No setup script — just open terminal in the worktree directory
		const escapedCwd = cwd.replace(/'/g, "'\\''");
		const appleScript = `tell application "${terminalApp}"
	activate
	do script "cd '${escapedCwd}'"
end tell`;
		try {
			execSync(`osascript -e '${appleScript.replace(/'/g, "'\\''")}'`);
		} catch {
			// Fallback: try open command
			execSync(`open -a "${terminalApp}" "${cwd}"`);
		}
		return { success: true, message: `Opened ${terminalApp} in worktree directory` };
	}

	const script = config.setup.join('\n');
	const portOffset = getPortOffset(repoPath, cwd);

	// Write the script to a temp file in the workstream-hub directory
	const hubDir = join(homedir(), '.workstream-hub');
	if (!existsSync(hubDir)) mkdirSync(hubDir, { recursive: true });

	// Detect interpreter from shebang (default to bash)
	let shebang = '#!/usr/bin/env bash';
	const shebangMatch = script.match(/^#!\s*(.+)/);
	if (shebangMatch) {
		shebang = `#!${shebangMatch[1].trim()}`;
	}

	// Create a wrapper script that cd's to the worktree and runs the setup
	const escapedCwd = cwd.replace(/'/g, "'\\''");
	const scriptFileName = `setup-${Date.now()}.sh`;
	const scriptPath = join(hubDir, scriptFileName);

	const wrapperScript = `${shebang}
set -euo pipefail

export PORT_OFFSET=${portOffset}
cd '${escapedCwd}'

echo "=== Workstream Hub Setup ==="
echo "Directory: ${cwd}"
echo "Port offset: ${portOffset}"
echo "==========================="
echo ""

${script.replace(/^#!.*\n?/, '')}
`;

	writeFileSync(scriptPath, wrapperScript, { mode: 0o755 });

	// Open the configured terminal app and run the script
	const escapedScriptPath = scriptPath.replace(/'/g, "'\\''");
	const appleScript = `tell application "${terminalApp}"
	activate
	do script "'${escapedScriptPath}'"
end tell`;

	try {
		execSync(`osascript -e '${appleScript.replace(/'/g, "'\\''")}'`);
	} catch {
		return { success: false, message: `Failed to open ${terminalApp}` };
	}

	return {
		success: true,
		message: `Setup script running in ${terminalApp} (port offset: ${portOffset})`
	};
}
