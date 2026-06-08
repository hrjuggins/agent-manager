import { spawn, type ChildProcess } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getRepoByPath } from '$lib/server/config';
import type { RepoConfig, EnvironmentStatus, RunningService } from '$lib/types';

interface ManagedProcess {
	process: ChildProcess;
	name: string;
	command: string;
	log: string[];
}

// In-memory map of workstream ID → managed processes
const runningProcesses = new Map<string, ManagedProcess[]>();

// In-memory map of workstream ID → setup log
const setupLogs = new Map<string, string>();

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

export function runScript(
	workstreamId: string,
	cwd: string,
	repoPath: string
): RunningService[] {
	// Stop any existing processes first
	stopServices(workstreamId);

	const config = readRepoConfig(repoPath);
	if (!config?.setup || config.setup.length === 0) {
		return [];
	}

	// Run the entire setup script as a single shell process
	const script = config.setup.join('\n');
	const child = spawn('sh', ['-c', script], {
		cwd,
		stdio: ['ignore', 'pipe', 'pipe'],
		detached: true,
		env: { ...process.env } as Record<string, string>
	});

	const mp: ManagedProcess = {
		process: child,
		name: 'setup',
		command: script,
		log: []
	};

	child.stdout?.on('data', (data: Buffer) => {
		mp.log.push(data.toString());
		if (mp.log.length > 100) mp.log.shift();
	});

	child.stderr?.on('data', (data: Buffer) => {
		mp.log.push(data.toString());
		if (mp.log.length > 100) mp.log.shift();
	});

	runningProcesses.set(workstreamId, [mp]);
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
}

export function getEnvironmentStatus(workstreamId: string): EnvironmentStatus {
	const managed = runningProcesses.get(workstreamId);
	const log = setupLogs.get(workstreamId);

	if (!managed || managed.length === 0) {
		return { state: 'stopped', services: [], setupLog: log };
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
		setupLog: log
	};
}

export function getServiceLogs(workstreamId: string, serviceName: string): string {
	const managed = runningProcesses.get(workstreamId);
	if (!managed) return '';
	const mp = managed.find((m) => m.name === serviceName);
	return mp?.log.join('') ?? '';
}
