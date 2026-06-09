import { spawn, execSync, type ChildProcess } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getRepoByPath } from '$lib/server/config';
import { listWorktrees } from '$lib/server/worktree';
import type { RepoConfig, EnvironmentStatus, RunningService } from '$lib/types';

const PID_FILE = join(homedir(), '.workstream-hub', 'running-pids.json');

interface ManagedProcess {
	process: ChildProcess;
	name: string;
	command: string;
	log: string[];
}

// In-memory map of workstream ID → managed processes
const runningProcesses = new Map<string, ManagedProcess[]>();

// In-memory map of workstream ID → parsed env details (key: value from stdout)
const envDetails = new Map<string, Record<string, string>>();

// In-memory map of workstream ID → error lines from stderr
const envErrors = new Map<string, string[]>();

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

export function runScript(workstreamId: string, cwd: string, repoPath: string): RunningService[] {
	// Stop any existing processes first
	stopServices(workstreamId);

	const config = readRepoConfig(repoPath);
	if (!config?.setup || config.setup.length === 0) {
		return [];
	}

	// Run the entire setup script as a single shell process
	const script = config.setup.join('\n');

	// Detect interpreter from shebang (default to sh)
	let shell = 'sh';
	const shebangMatch = script.match(/^#!\s*(.+)/);
	if (shebangMatch) {
		const shebang = shebangMatch[1].trim();
		if (shebang.includes('bash')) {
			shell = 'bash';
		} else if (shebang.includes('zsh')) {
			shell = 'zsh';
		} else if (shebang === '/usr/bin/env fish' || shebang.includes('/fish')) {
			shell = 'fish';
		}
	}

	// Calculate port offset from number of existing worktrees
	// Index 0 is the main repo, so the first worktree gets offset 1
	// Use case-insensitive comparison for macOS (APFS is case-insensitive)
	const worktrees = listWorktrees(repoPath);
	const cwdLower = cwd.toLowerCase();
	const worktreeIndex = worktrees.findIndex((w) => w.toLowerCase() === cwdLower);
	const portOffset = worktreeIndex >= 0 ? worktreeIndex : worktrees.length;

	const child = spawn(shell, ['-c', script], {
		cwd,
		stdio: ['ignore', 'pipe', 'pipe'],
		detached: true,
		env: { ...process.env, PORT_OFFSET: String(portOffset) } as Record<string, string>
	});

	const mp: ManagedProcess = {
		process: child,
		name: 'setup',
		command: script,
		log: []
	};

	// Initialize storage for this workstream
	envDetails.set(workstreamId, {});
	envErrors.set(workstreamId, []);

	child.stdout?.on('data', (data: Buffer) => {
		const text = data.toString();
		mp.log.push(text);
		if (mp.log.length > 100) mp.log.shift();

		// Parse key: value lines from stdout
		const lines = text.split('\n');
		const details = envDetails.get(workstreamId) ?? {};
		for (const line of lines) {
			const match = line.match(/^([\w\s._-]+):\s+(.+)$/);
			if (match) {
				details[match[1].trim()] = match[2].trim();
			}
		}
		envDetails.set(workstreamId, details);
	});

	child.stderr?.on('data', (data: Buffer) => {
		const text = data.toString();
		mp.log.push(text);
		if (mp.log.length > 100) mp.log.shift();

		// Capture error lines (filter out common noise)
		const lines = text.split('\n').filter((l) => l.trim());
		const errors = envErrors.get(workstreamId) ?? [];
		for (const line of lines) {
			// Skip common non-error noise (npm warnings, deprecation notices)
			if (line.includes('npm warn') || line.includes('WARN deprecated')) continue;
			errors.push(line);
			if (errors.length > 50) errors.shift();
		}
		envErrors.set(workstreamId, errors);
	});

	runningProcesses.set(workstreamId, [mp]);
	savePids();
	return [
		{
			name: 'setup',
			command: script,
			pid: child.pid,
			status: 'running'
		}
	];
}

export function stopServices(workstreamId: string): void {
	const managed = runningProcesses.get(workstreamId);
	if (!managed) return;

	for (const mp of managed) {
		try {
			if (mp.process.pid) {
				// Kill the process group
				process.kill(-mp.process.pid, 'SIGTERM');
			}
		} catch {
			// Process may have already exited
		}
	}

	runningProcesses.delete(workstreamId);
	savePids();
}

export function getEnvironmentStatus(workstreamId: string): EnvironmentStatus {
	const managed = runningProcesses.get(workstreamId);
	const details = envDetails.get(workstreamId);
	const errors = envErrors.get(workstreamId);

	// Build live log from managed process buffer
	const liveLog = managed?.map((mp) => mp.log.join('')).join('') || undefined;

	if (!managed || managed.length === 0) {
		return {
			state: 'stopped',
			services: [],
			setupLog: liveLog,
			envDetails: details && Object.keys(details).length > 0 ? details : undefined,
			errors: errors && errors.length > 0 ? errors : undefined
		};
	}

	const services: RunningService[] = managed.map((mp) => {
		const running = mp.process.exitCode === null;
		return {
			name: mp.name,
			command: mp.command,
			pid: mp.process.pid,
			status: running ? 'running' : 'error'
		};
	});

	const allRunning = services.every((s) => s.status === 'running');
	const anyError = services.some((s) => s.status === 'error');

	return {
		state: anyError ? 'error' : allRunning ? 'running' : 'stopped',
		services,
		setupLog: liveLog,
		envDetails: details && Object.keys(details).length > 0 ? details : undefined,
		errors: errors && errors.length > 0 ? errors : undefined
	};
}

export function getServiceLogs(workstreamId: string, serviceName: string): string {
	const managed = runningProcesses.get(workstreamId);
	if (!managed) return '';
	const mp = managed.find((m) => m.name === serviceName);
	return mp?.log.join('') ?? '';
}

// --- PID tracking for orphan cleanup ---

function savePids(): void {
	const pids: Record<string, number[]> = {};
	for (const [id, managed] of runningProcesses) {
		const activePids = managed
			.map((mp) => mp.process.pid)
			.filter((pid): pid is number => pid !== undefined);
		if (activePids.length > 0) pids[id] = activePids;
	}
	try {
		const dir = join(homedir(), '.workstream-hub');
		if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
		writeFileSync(PID_FILE, JSON.stringify(pids));
	} catch {
		// Best-effort
	}
}

/** Kill any orphaned processes from a previous hub session. */
export function cleanupOrphanedProcesses(): void {
	if (!existsSync(PID_FILE)) return;
	try {
		const raw = readFileSync(PID_FILE, 'utf-8');
		const pids: Record<string, number[]> = JSON.parse(raw);
		for (const pidList of Object.values(pids)) {
			for (const pid of pidList) {
				try {
					// Kill entire process group
					process.kill(-pid, 'SIGTERM');
				} catch {
					try {
						// Fallback: kill individual process
						process.kill(pid, 'SIGTERM');
					} catch {
						// Already dead
					}
				}
			}
		}
		// Clear the PID file
		writeFileSync(PID_FILE, '{}');
	} catch {
		// Best-effort
	}
}
