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

export function getLinearApiKey(): string | undefined {
	return readConfig().linearApiKey || undefined;
}
