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
	const repoSettings = getRepoByPath(repoPath);
	const portStride = repoSettings?.portStride ?? 10;
	const services = repoSettings?.devServices ?? [];

	// Write the script to a temp file in the workstream-hub directory
	const hubDir = join(homedir(), '.workstream-hub');
	if (!existsSync(hubDir)) mkdirSync(hubDir, { recursive: true });

	// Detect interpreter from shebang (default to bash)
	let shebang = '#!/usr/bin/env bash';
	const shebangMatch = script.match(/^#!\s*(.+)/);
	if (shebangMatch) {
		shebang = `#!${shebangMatch[1].trim()}`;
	}

	// Build env vars for sibling service ports/URLs
	const envLines: string[] = [
		`export PORT_OFFSET=${portOffset}`,
		`export PORT_STRIDE=${portStride}`
	];
	for (const svc of services) {
		if (svc.portBase !== undefined) {
			const port = svc.portBase + portOffset * portStride;
			const envName = svc.name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
			envLines.push(`export ${envName}_PORT=${port}`);
			envLines.push(`export ${envName}_ROOT=http://localhost:${port}`);
		}
	}

	// Create a wrapper script that cd's to the worktree and runs the setup
	const escapedCwd = cwd.replace(/'/g, "'\\''");
	const scriptFileName = `setup-${Date.now()}.sh`;
	const scriptPath = join(hubDir, scriptFileName);

	const wrapperScript = `${shebang}
set -euo pipefail

${envLines.join('\n')}
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
	const scriptPath = writeServiceScript(service, allServices, portOffset, portStride, cwd);

	try {
		runInTerminal(terminalApp, `'${scriptPath.replace(/'/g, "'\\''")}'`);
	} catch {
		return { success: false, message: `Failed to open ${terminalApp} for ${service.name}` };
	}

	return { success: true, message: `${service.name} running in ${terminalApp}` };
}

/**
 * Write a service script to disk and return the path.
 */
function writeServiceScript(
	service: DevServiceConfig,
	allServices: DevServiceConfig[],
	portOffset: number,
	portStride: number,
	cwd: string
): string {
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
	return scriptPath;
}

/**
 * Start all dev services in iTerm2 split panes within a single window.
 * First service gets the initial session, subsequent services split horizontally.
 */
function startServicesInITermPanes(scriptPaths: { name: string; path: string }[]): {
	success: boolean;
	message: string;
} {
	if (scriptPaths.length === 0) {
		return { success: true, message: 'No services to start' };
	}

	const escapePath = (p: string) => p.replace(/'/g, "'\\''");

	// Build AppleScript: one window, split panes for each service
	const lines: string[] = [
		'tell application "iTerm"',
		'\tactivate',
		`\tset newWindow to (create window with default profile)`,
		'\ttell newWindow'
	];

	// First service runs in the initial session
	lines.push(`\t\ttell current session`);
	lines.push(`\t\t\tset name to ${JSON.stringify(scriptPaths[0].name)}`);
	lines.push(`\t\t\twrite text "'${escapePath(scriptPaths[0].path)}'"`);
	lines.push(`\t\tend tell`);

	// Subsequent services: split from the current session
	for (let i = 1; i < scriptPaths.length; i++) {
		lines.push(`\t\ttell current session`);
		lines.push(`\t\t\tset newSession to (split horizontally with default profile)`);
		lines.push(`\t\tend tell`);
		lines.push(`\t\ttell newSession`);
		lines.push(`\t\t\tset name to ${JSON.stringify(scriptPaths[i].name)}`);
		lines.push(`\t\t\twrite text "'${escapePath(scriptPaths[i].path)}'"`);
		lines.push(`\t\tend tell`);
	}

	lines.push('\tend tell');
	lines.push('end tell');

	const appleScript = lines.join('\n');

	try {
		execSync(`osascript -e '${appleScript.replace(/'/g, "'\\''")}'`);
	} catch {
		return { success: false, message: 'Failed to open iTerm split panes' };
	}

	return { success: true, message: `Started ${scriptPaths.length} service(s) in iTerm panes` };
}

/**
 * Check which dev services are currently running by testing if their computed ports are listening.
 * Uses lsof on macOS/Linux to check for TCP listeners on each port.
 */
export function getServiceStatuses(
	repoPath: string,
	cwd: string,
	services: DevServiceConfig[],
	portStride: number
): { name: string; port: number | null; running: boolean }[] {
	const portOffset = getPortOffset(repoPath, cwd);

	return services.map((svc) => {
		if (svc.portBase === undefined) {
			return { name: svc.name, port: null, running: false };
		}
		const port = svc.portBase + portOffset * portStride;
		let running = false;
		try {
			execSync(`lsof -iTCP:${port} -sTCP:LISTEN -t`, { stdio: 'pipe' });
			running = true;
		} catch {
			// lsof exits non-zero when no process found — port is free
		}
		return { name: svc.name, port, running };
	});
}

/**
 * Open terminal tabs/panes for all dev services of a repo.
 * Uses iTerm2 split panes when available, falls back to separate tabs/windows.
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
	const terminalApp = getTerminalApp().toLowerCase();
	const envDetails: Record<string, string> = {};

	for (const svc of services) {
		if (svc.portBase !== undefined) {
			const port = svc.portBase + portOffset * portStride;
			envDetails[svc.name] = `http://localhost:${port}`;
		}
	}
	envDetails['offset'] = String(portOffset);

	// iTerm2: use split panes in a single window
	if (terminalApp === 'iterm' || terminalApp === 'iterm2') {
		const scriptPaths = services.map((svc) => ({
			name: svc.name,
			path: writeServiceScript(svc, services, portOffset, portStride, cwd)
		}));

		const result = startServicesInITermPanes(scriptPaths);
		return { ...result, envDetails };
	}

	// Fallback: separate terminal windows/tabs
	const errors: string[] = [];
	for (const svc of services) {
		const result = openServiceTerminal(repoPath, cwd, svc, services, portStride);
		if (!result.success) {
			errors.push(result.message);
		}
	}

	if (errors.length > 0) {
		return { success: false, message: errors.join('; '), envDetails };
	}

	return {
		success: true,
		message: `Started ${services.length} service(s) in ${getTerminalApp()}`,
		envDetails
	};
}
