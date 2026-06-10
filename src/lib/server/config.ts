import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { RepoSettings } from '$lib/types';

export interface AppConfig {
	linearApiKey?: string;
	ideCommand?: string;
	terminalApp?: string;
	repos?: RepoSettings[];
}

const DATA_DIR = join(process.env.HOME || '~', '.workstream-hub');
const CONFIG_FILE = join(DATA_DIR, 'config.json');

function ensureDataDir(): void {
	if (!existsSync(DATA_DIR)) {
		mkdirSync(DATA_DIR, { recursive: true });
	}
}

export function readConfig(): AppConfig {
	ensureDataDir();
	if (!existsSync(CONFIG_FILE)) {
		return {};
	}
	try {
		const raw = readFileSync(CONFIG_FILE, 'utf-8');
		return JSON.parse(raw) as AppConfig;
	} catch {
		return {};
	}
}

export function writeConfig(config: AppConfig): void {
	ensureDataDir();
	writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

function isValidApiKey(key: string): boolean {
	// API keys must be ASCII-only (no masked bullet chars, etc.)
	return /^[\x20-\x7E]+$/.test(key);
}

export function getLinearApiKey(): string | undefined {
	const key = readConfig().linearApiKey;
	if (!key || !isValidApiKey(key)) return undefined;
	return key;
}

export function validateLinearApiKey(key: string): string | null {
	if (!key) return 'Key is empty';
	if (!isValidApiKey(key)) return 'Key contains invalid characters — re-enter your real API key';
	return null;
}

// --- IDE command ---

export function getIdeCommand(): string | undefined {
	return readConfig().ideCommand;
}

// --- Terminal app ---

export function getTerminalApp(): string {
	return readConfig().terminalApp || 'Terminal';
}

// --- Repo settings ---

export function listRepos(): RepoSettings[] {
	return readConfig().repos ?? [];
}

export function getRepo(id: string): RepoSettings | undefined {
	return listRepos().find((r) => r.id === id);
}

export function getRepoByPath(path: string): RepoSettings | undefined {
	return listRepos().find((r) => r.path === path);
}

export function createRepo(data: Omit<RepoSettings, 'id'>): RepoSettings {
	const config = readConfig();
	const repo: RepoSettings = { id: randomUUID(), ...data };
	config.repos = [...(config.repos ?? []), repo];
	writeConfig(config);
	return repo;
}

export function updateRepo(
	id: string,
	data: Partial<Omit<RepoSettings, 'id'>>
): RepoSettings | undefined {
	const config = readConfig();
	const repos = config.repos ?? [];
	const index = repos.findIndex((r) => r.id === id);
	if (index === -1) return undefined;
	repos[index] = { ...repos[index], ...data };
	config.repos = repos;
	writeConfig(config);
	return repos[index];
}

export function deleteRepo(id: string): boolean {
	const config = readConfig();
	const repos = config.repos ?? [];
	const index = repos.findIndex((r) => r.id === id);
	if (index === -1) return false;
	repos.splice(index, 1);
	config.repos = repos;
	writeConfig(config);
	return true;
}
