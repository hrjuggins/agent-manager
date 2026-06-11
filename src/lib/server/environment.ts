import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getRepoByPath, getTerminalApp } from '$lib/server/config';
import { listWorktrees } from '$lib/server/worktree';
import type { RepoConfig, DevServiceConfig } from '$lib/types';

/**
 * Check whether a TCP port is available (nothing listening).
 */
function isPortAvailable(port: number): boolean {
	try {
		execSync(`lsof -iTCP:${port} -sTCP:LISTEN -t`, { stdio: 'pipe' });
		return false; // lsof found a listener — port is taken
	} catch {
		return true; // lsof exited non-zero — port is free
	}
}

/**
 * Find the first available port starting from `startPort`, scanning up to 100 ports.
 */
function findAvailablePort(startPort: number): number {
	for (let offset = 0; offset < 100; offset++) {
		const port = startPort + offset;
		if (isPortAvailable(port)) return port;
	}
	// Fallback: return the original port and let the service error
	return startPort;
}

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
 * Always creates a new window/tab.
 */
function runInTerminal(terminalApp: string, command: string): void {
	const app = terminalApp.toLowerCase();

	if (app === 'iterm' || app === 'iterm2') {
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
		const script = `
tell application "${terminalApp}"
	activate
	do script ${JSON.stringify(command)}
end tell`;
		try {
			execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
		} catch {
			execSync(`open -a "${terminalApp}"`);
		}
	}
}

/**
 * Try to find and activate an existing terminal window whose title contains `marker`.
 * Returns true if a window was found, false if a new one should be created.
 */
function activateExistingTerminal(terminalApp: string, marker: string): boolean {
	const app = terminalApp.toLowerCase();
	const safeMarker = marker.replace(/"/g, '\\"');

	try {
		if (app === 'iterm' || app === 'iterm2') {
			const script = `
tell application "iTerm"
	repeat with w in windows
		repeat with t in tabs of w
			repeat with s in sessions of t
				if name of s contains "${safeMarker}" then
					select t
					tell w to select
					activate
					return "found"
				end if
			end repeat
		end repeat
	end repeat
	return "not_found"
end tell`;
			const result = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
				encoding: 'utf-8'
			}).trim();
			return result === 'found';
		} else if (app === 'terminal' || app === 'terminal.app') {
			const script = `
tell application "Terminal"
	repeat with w in windows
		if name of w contains "${safeMarker}" then
			set index of w to 1
			activate
			return "found"
		end if
	end repeat
	return "not_found"
end tell`;
			const result = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
				encoding: 'utf-8'
			}).trim();
			return result === 'found';
		}
	} catch {
		// AppleScript failed — fall through to create new
	}
	return false;
}

/**
 * Open a named terminal in the given directory.
 * If a terminal with the same name already exists, activates it instead.
 * The name is set as the window/tab title so it can be found later.
 */
export function openTerminal(
	cwd: string,
	name?: string
): { success: boolean; message: string } {
	const terminalApp = getTerminalApp();
	const escapedCwd = cwd.replace(/'/g, "'\\''");

	// If a name is provided, try to find and activate existing terminal
	if (name) {
		const found = activateExistingTerminal(terminalApp, name);
		if (found) {
			return { success: true, message: `Activated existing terminal for ${name}` };
		}
	}

	// Create new terminal with title set to workstream name
	const titleCmd = name ? `printf '\\e]0;${name.replace(/'/g, "\\'")}\\a'; ` : '';
	try {
		runInTerminal(terminalApp, `${titleCmd}cd '${escapedCwd}'`);
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
	cwd: string,
	name?: string
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

	const titleEscape = name ? `printf '\\e]0;${name.replace(/'/g, "\\'")}\\a'\n` : '';
	const wrapperScript = `${shebang}
set -euo pipefail

${titleEscape}${envLines.join('\n')}
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
 * Allocate available ports for all services, starting from each service's preferred port.
 * Returns a map of service name → actual allocated port.
 */
function allocatePorts(
	services: DevServiceConfig[],
	portOffset: number,
	portStride: number
): Record<string, number> {
	const portMap: Record<string, number> = {};
	const claimed = new Set<number>();

	for (const svc of services) {
		if (svc.portBase !== undefined) {
			const preferred = svc.portBase + portOffset * portStride;
			let port = preferred;
			for (let i = 0; i < 100; i++) {
				if (isPortAvailable(port) && !claimed.has(port)) break;
				port++;
			}
			portMap[svc.name] = port;
			claimed.add(port);
		}
	}

	return portMap;
}

/**
 * Build env vars for a dev service using a pre-allocated port map.
 * Exports PORT (for the service itself) plus <NAME>_PORT and <NAME>_ROOT for all sibling services.
 */
function buildServiceEnv(
	service: DevServiceConfig,
	allServices: DevServiceConfig[],
	portMap: Record<string, number>,
	portOffset: number,
	portStride: number
): string {
	const lines: string[] = [];
	const myPort = portMap[service.name];

	if (myPort !== undefined) {
		lines.push(`export PORT=${myPort}`);
	}
	lines.push(`export PORT_OFFSET=${portOffset}`);
	lines.push(`export PORT_STRIDE=${portStride}`);

	for (const svc of allServices) {
		const port = portMap[svc.name];
		if (port !== undefined) {
			const envName = svc.name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
			lines.push(`export ${envName}_PORT=${port}`);
			lines.push(`export ${envName}_ROOT=http://localhost:${port}`);
		}
	}

	return lines.join('\n');
}

/**
 * Open a terminal tab for a single dev service.
 * Finds an available port, sets up env vars, and runs the command in the worktree dir.
 * Returns the actual port allocated so the caller can store it.
 */
export function openServiceTerminal(
	repoPath: string,
	cwd: string,
	service: DevServiceConfig,
	allServices: DevServiceConfig[],
	portStride: number,
	existingPortMap?: Record<string, number>
): { success: boolean; message: string; port?: number } {
	const terminalApp = getTerminalApp();
	const portOffset = getPortOffset(repoPath, cwd);

	// Build port map: use existing allocations for siblings, allocate fresh for this service
	const portMap: Record<string, number> = { ...(existingPortMap ?? {}) };
	if (service.portBase !== undefined && portMap[service.name] === undefined) {
		const preferred = service.portBase + portOffset * portStride;
		portMap[service.name] = findAvailablePort(preferred);
	}

	const scriptPath = writeServiceScript(service, allServices, portMap, portOffset, portStride, cwd);

	try {
		runInTerminal(terminalApp, `'${scriptPath.replace(/'/g, "'\\''")}'`);
	} catch {
		return { success: false, message: `Failed to open ${terminalApp} for ${service.name}` };
	}

	return {
		success: true,
		message: `${service.name} running in ${terminalApp}`,
		port: portMap[service.name]
	};
}

/**
 * Write a service script to disk and return the path.
 */
function writeServiceScript(
	service: DevServiceConfig,
	allServices: DevServiceConfig[],
	portMap: Record<string, number>,
	portOffset: number,
	portStride: number,
	cwd: string
): string {
	const envVars = buildServiceEnv(service, allServices, portMap, portOffset, portStride);
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
 * Check which dev services are currently running by testing if their ports are listening.
 * Uses stored port mappings when available; falls back to computed ports from worktree index.
 */
export function getServiceStatuses(
	repoPath: string,
	cwd: string,
	services: DevServiceConfig[],
	portStride: number,
	storedPorts?: Record<string, number>
): { name: string; port: number | null; running: boolean }[] {
	const portOffset = getPortOffset(repoPath, cwd);

	return services.map((svc) => {
		// Prefer stored port (actual allocation) over computed port
		const storedPort = storedPorts?.[svc.name];
		if (storedPort !== undefined) {
			return { name: svc.name, port: storedPort, running: !isPortAvailable(storedPort) };
		}
		if (svc.portBase === undefined) {
			return { name: svc.name, port: null, running: false };
		}
		const port = svc.portBase + portOffset * portStride;
		return { name: svc.name, port, running: !isPortAvailable(port) };
	});
}

/**
 * Check if any services are actually running for a workstream.
 * Used to reconcile stored environment.state with reality.
 */
export function areAnyServicesRunning(
	repoPath: string,
	cwd: string,
	portStride: number,
	storedPorts?: Record<string, number>
): boolean {
	const repoSettings = getRepoByPath(repoPath);
	const services = repoSettings?.devServices ?? [];
	if (services.length === 0) return false;

	const statuses = getServiceStatuses(repoPath, cwd, services, portStride, storedPorts);
	return statuses.some((s) => s.running);
}

/**
 * Open terminal tabs/panes for all dev services of a repo.
 * Uses iTerm2 split panes when available, falls back to separate tabs/windows.
 * Finds available ports for each service and returns actual port allocations.
 */
export function startAllServices(
	repoPath: string,
	cwd: string
): {
	success: boolean;
	message: string;
	envDetails?: Record<string, string>;
	portMap?: Record<string, number>;
} {
	const repoSettings = getRepoByPath(repoPath);
	const services = repoSettings?.devServices ?? [];

	if (services.length === 0) {
		return { success: true, message: 'No dev services configured' };
	}

	const portStride = repoSettings?.portStride ?? 10;
	const portOffset = getPortOffset(repoPath, cwd);
	const terminalApp = getTerminalApp().toLowerCase();

	// Allocate available ports for all services
	const portMap = allocatePorts(services, portOffset, portStride);

	const envDetails: Record<string, string> = {};
	for (const svc of services) {
		const port = portMap[svc.name];
		if (port !== undefined) {
			envDetails[svc.name] = `http://localhost:${port}`;
		}
	}
	envDetails['offset'] = String(portOffset);

	// iTerm2: use split panes in a single window
	if (terminalApp === 'iterm' || terminalApp === 'iterm2') {
		const scriptPaths = services.map((svc) => ({
			name: svc.name,
			path: writeServiceScript(svc, services, portMap, portOffset, portStride, cwd)
		}));

		const result = startServicesInITermPanes(scriptPaths);
		return { ...result, envDetails, portMap };
	}

	// Fallback: separate terminal windows/tabs
	const errors: string[] = [];
	for (const svc of services) {
		const result = openServiceTerminal(repoPath, cwd, svc, services, portStride, portMap);
		if (!result.success) {
			errors.push(result.message);
		}
	}

	if (errors.length > 0) {
		return { success: false, message: errors.join('; '), envDetails, portMap };
	}

	return {
		success: true,
		message: `Started ${services.length} service(s) in ${getTerminalApp()}`,
		envDetails,
		portMap
	};
}
