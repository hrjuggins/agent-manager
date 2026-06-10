import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getRepoByPath, getTerminalApp } from '$lib/server/config';
import { listWorktrees } from '$lib/server/worktree';
import type { RepoConfig, DevServiceConfig } from '$lib/types';

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
 * Run a command in the configured terminal app via AppleScript.
 * Handles Terminal.app, iTerm2, and falls back to `open -a` for others.
 */
function runInTerminal(terminalApp: string, command: string): void {
	const app = terminalApp.toLowerCase();

	if (app === 'iterm' || app === 'iterm2') {
		// iTerm2 uses a different AppleScript API than Terminal.app
		const script = `
tell application "iTerm"
	activate
	set newWindow to (create window with default profile)
	tell current session of newWindow
		write text ${JSON.stringify(command)}
	end tell
end tell`;
		execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
	} else if (app === 'terminal' || app === 'terminal.app') {
		const script = `
tell application "Terminal"
	activate
	do script ${JSON.stringify(command)}
end tell`;
		execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
	} else {
		// Generic fallback: try AppleScript do script, then open -a
		const script = `
tell application "${terminalApp}"
	activate
	do script ${JSON.stringify(command)}
end tell`;
		try {
			execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
		} catch {
			// Last resort: open the app and hope it accepts arguments
			execSync(`open -a "${terminalApp}"`);
		}
	}
}

/**
 * Open a terminal in the given directory (no setup script).
 * Used by the "Open Terminal" button.
 */
export function openTerminal(cwd: string): { success: boolean; message: string } {
	const terminalApp = getTerminalApp();
	try {
		runInTerminal(terminalApp, `cd '${cwd.replace(/'/g, "'\\''")}'`);
	} catch {
		return { success: false, message: `Failed to open ${terminalApp}` };
	}
	return { success: true, message: `Opened ${terminalApp} in ${cwd}` };
}

/**
 * Write a temporary setup script to disk and run it in the configured terminal.
 * Used on workstream creation to bootstrap the environment.
 */
export function runSetupInTerminal(
	repoPath: string,
	cwd: string
): { success: boolean; message: string } {
	const config = readRepoConfig(repoPath);
	const terminalApp = getTerminalApp();

	if (!config?.setup || config.setup.length === 0) {
		return { success: true, message: 'No setup script configured' };
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

	try {
		runInTerminal(terminalApp, `'${scriptPath.replace(/'/g, "'\\''")}'`);
	} catch {
		return { success: false, message: `Failed to open ${terminalApp}` };
	}

	return {
		success: true,
		message: `Setup script running in ${terminalApp} (port offset: ${portOffset})`
	};
}

/**
 * Build env vars for a dev service given the repo's service list and port offset.
 * Exports PORT (for the service itself) plus <NAME>_PORT and <NAME>_ROOT for all sibling services.
 */
function buildServiceEnv(
	service: DevServiceConfig,
	allServices: DevServiceConfig[],
	portOffset: number,
	portStride: number
): string {
	const lines: string[] = [];
	const myPort = service.portBase ? service.portBase + portOffset * portStride : undefined;

	if (myPort !== undefined) {
		lines.push(`export PORT=${myPort}`);
	}
	lines.push(`export PORT_OFFSET=${portOffset}`);
	lines.push(`export PORT_STRIDE=${portStride}`);

	for (const svc of allServices) {
		if (svc.portBase !== undefined) {
			const port = svc.portBase + portOffset * portStride;
			const envName = svc.name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
			lines.push(`export ${envName}_PORT=${port}`);
			lines.push(`export ${envName}_ROOT=http://localhost:${port}`);
		}
	}

	return lines.join('\n');
}

/**
 * Open a terminal tab for a single dev service.
 * Sets up env vars (PORT, sibling ports/URLs) and runs the command in the worktree dir.
 */
export function openServiceTerminal(
	repoPath: string,
	cwd: string,
	service: DevServiceConfig,
	allServices: DevServiceConfig[],
	portStride: number
): { success: boolean; message: string } {
	const terminalApp = getTerminalApp();
	const portOffset = getPortOffset(repoPath, cwd);
	const envVars = buildServiceEnv(service, allServices, portOffset, portStride);
	const escapedCwd = cwd.replace(/'/g, "'\\''");

	const hubDir = join(homedir(), '.workstream-hub');
	if (!existsSync(hubDir)) mkdirSync(hubDir, { recursive: true });

	const scriptFileName = `svc-${service.name.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.sh`;
	const scriptPath = join(hubDir, scriptFileName);

	const script = `#!/usr/bin/env bash
set -euo pipefail

${envVars}
cd '${escapedCwd}'

echo "=== ${service.name} ==="
echo "Directory: ${cwd}"
${service.portBase !== undefined ? `echo "Port: $PORT"` : ''}
echo ""

${service.command}
`;

	writeFileSync(scriptPath, script, { mode: 0o755 });

	try {
		runInTerminal(terminalApp, `'${scriptPath.replace(/'/g, "'\\''")}'`);
	} catch {
		return { success: false, message: `Failed to open ${terminalApp} for ${service.name}` };
	}

	return { success: true, message: `${service.name} running in ${terminalApp}` };
}

/**
 * Open terminal tabs for all dev services of a repo.
 * Returns computed env details (service URLs) for the workstream.
 */
export function startAllServices(
	repoPath: string,
	cwd: string
): { success: boolean; message: string; envDetails?: Record<string, string> } {
	const repoSettings = getRepoByPath(repoPath);
	const services = repoSettings?.devServices ?? [];

	if (services.length === 0) {
		return { success: true, message: 'No dev services configured' };
	}

	const portStride = repoSettings?.portStride ?? 10;
	const portOffset = getPortOffset(repoPath, cwd);
	const envDetails: Record<string, string> = {};
	const errors: string[] = [];

	for (const svc of services) {
		const result = openServiceTerminal(repoPath, cwd, svc, services, portStride);
		if (!result.success) {
			errors.push(result.message);
		}
		if (svc.portBase !== undefined) {
			const port = svc.portBase + portOffset * portStride;
			envDetails[svc.name] = `http://localhost:${port}`;
		}
	}

	envDetails['offset'] = String(portOffset);

	if (errors.length > 0) {
		return { success: false, message: errors.join('; '), envDetails };
	}

	return {
		success: true,
		message: `Started ${services.length} service(s) in ${getTerminalApp()}`,
		envDetails
	};
}
