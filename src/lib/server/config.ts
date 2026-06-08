import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface AppConfig {
	linearApiKey?: string;
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
