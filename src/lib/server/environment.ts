import { spawn, type ChildProcess } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getRepoByPath } from '$lib/server/config';
import { listWorkstreams } from '$lib/server/store';
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
	// Check app settings first (repo configured via Settings UI)
	const repoSettings = getRepoByPath(repoPath);
	if (repoSettings) {
		const lines = repoSettings.setupScript
			? repoSettings.setupScript.split('\n').filter((l) => l.trim())
			: [];

		if (lines.length === 0) return null;

		// All lines except the last are setup commands; last line is the service command
		if (lines.length === 1) {
			// Single line: if it looks like a dev server, treat as service; otherwise setup
			const line = lines[0];
			if (isServiceCommand(line)) {
				return { serviceCommand: line };
			}
			return { setup: [line] };
		}

		return {
			setup: lines.slice(0, -1),
			serviceCommand: lines[lines.length - 1]
		};
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

/** Detect if a command is a long-running dev server */
function isServiceCommand(cmd: string): boolean {
	const lower = cmd.toLowerCase();
	return (
		lower.includes('npm run dev') ||
		lower.includes('npm start') ||
		lower.includes('npx vite') ||
		lower.includes('npx next') ||
		lower.includes('yarn dev') ||
		lower.includes('yarn start') ||
		lower.includes('pnpm dev') ||
		lower.includes('pnpm start') ||
		lower.includes('node ') ||
		lower.includes('python ') ||
		lower.includes('cargo run') ||
		lower.includes('go run')
	);
}

export function getNextPort(repoPath: string, basePort: number = 3000): number {
	const workstreams = listWorkstreams();
	const usedPorts = workstreams
		.filter((w) => w.repoPath === repoPath && w.status === 'active' && w.assignedPort)
		.map((w) => w.assignedPort!)
		.sort((a, b) => a - b);

	let port = basePort;
	while (usedPorts.includes(port)) {
		port++;
	}
	return port;
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

export function startService(
	workstreamId: string,
	cwd: string,
	repoPath: string,
	port?: number
): RunningService[] {
	// Stop any existing services first
	stopServices(workstreamId);

	const config = readRepoConfig(repoPath);
	if (!config?.serviceCommand) {
		return [];
	}

	const command = config.serviceCommand;
	const env: Record<string, string> = { ...process.env } as Record<string, string>;
	if (port !== undefined) {
		env.PORT = String(port);
	}

	const child = spawn('sh', ['-c', command], {
		cwd,
		stdio: ['ignore', 'pipe', 'pipe'],
		detached: true,
		env
	});

	const mp: ManagedProcess = {
		process: child,
		name: 'dev-server',
		command,
		port,
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
			name: 'dev-server',
			command,
			pid: child.pid,
			port,
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
