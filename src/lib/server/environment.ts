import { spawn, type ChildProcess } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { RepoConfig, EnvironmentStatus, RunningService } from '$lib/types';

interface ManagedProcess {
	process: ChildProcess;
	name: string;
	command: string;
	port?: number;
	log: string[];
}

// In-memory map of workstream ID → managed processes
const runningProcesses = new Map<string, ManagedProcess[]>();

// In-memory map of workstream ID → setup log
const setupLogs = new Map<string, string>();

export function readRepoConfig(repoPath: string): RepoConfig | null {
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

export async function runSetup(
	workstreamId: string,
	cwd: string,
	repoPath: string
): Promise<{ success: boolean; log: string }> {
	const config = readRepoConfig(repoPath);
	if (!config?.setup || config.setup.length === 0) {
		return { success: true, log: 'No setup commands configured' };
	}

	let log = '';
	for (const command of config.setup) {
		log += `$ ${command}\n`;
		try {
			const result = await runCommand(command, cwd);
			log += result.output + '\n';
			if (!result.success) {
				log += `[FAILED] Exit code: ${result.exitCode}\n`;
				setupLogs.set(workstreamId, log);
				return { success: false, log };
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			log += `[ERROR] ${msg}\n`;
			setupLogs.set(workstreamId, log);
			return { success: false, log };
		}
	}

	setupLogs.set(workstreamId, log);
	return { success: true, log };
}

export function startServices(
	workstreamId: string,
	cwd: string,
	repoPath: string
): RunningService[] {
	// Stop any existing services first
	stopServices(workstreamId);

	const config = readRepoConfig(repoPath);
	if (!config?.services || config.services.length === 0) {
		return [];
	}

	const managed: ManagedProcess[] = [];
	const results: RunningService[] = [];

	for (const svc of config.services) {
		const child = spawn('sh', ['-c', svc.command], {
			cwd,
			stdio: ['ignore', 'pipe', 'pipe'],
			detached: true
		});

		const mp: ManagedProcess = {
			process: child,
			name: svc.name,
			command: svc.command,
			port: svc.port,
			log: []
		};

		child.stdout?.on('data', (data: Buffer) => {
			mp.log.push(data.toString());
			// Keep only last 100 lines
			if (mp.log.length > 100) mp.log.shift();
		});

		child.stderr?.on('data', (data: Buffer) => {
			mp.log.push(data.toString());
			if (mp.log.length > 100) mp.log.shift();
		});

		managed.push(mp);
		results.push({
			name: svc.name,
			command: svc.command,
			pid: child.pid,
			port: svc.port,
			status: 'running'
		});
	}

	runningProcesses.set(workstreamId, managed);
	return results;
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
			port: mp.port,
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

function runCommand(
	command: string,
	cwd: string
): Promise<{ success: boolean; output: string; exitCode: number | null }> {
	return new Promise((resolve) => {
		const child = spawn('sh', ['-c', command], {
			cwd,
			stdio: ['ignore', 'pipe', 'pipe']
		});

		let output = '';
		child.stdout?.on('data', (data: Buffer) => {
			output += data.toString();
		});
		child.stderr?.on('data', (data: Buffer) => {
			output += data.toString();
		});

		child.on('close', (code) => {
			resolve({ success: code === 0, output, exitCode: code });
		});

		child.on('error', (err) => {
			resolve({ success: false, output: err.message, exitCode: null });
		});
	});
}
