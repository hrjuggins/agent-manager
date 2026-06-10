import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { Workstream, WorkstreamCreate, WorkstreamUpdate } from '$lib/types';

const DATA_DIR = join(process.env.HOME || '~', '.workstream-hub');
const DATA_FILE = join(DATA_DIR, 'workstreams.json');

function ensureDataDir(): void {
	if (!existsSync(DATA_DIR)) {
		mkdirSync(DATA_DIR, { recursive: true });
	}
}

function readAll(): Workstream[] {
	ensureDataDir();
	if (!existsSync(DATA_FILE)) {
		return [];
	}
	const raw = readFileSync(DATA_FILE, 'utf-8');
	return JSON.parse(raw) as Workstream[];
}

function writeAll(workstreams: Workstream[]): void {
	ensureDataDir();
	writeFileSync(DATA_FILE, JSON.stringify(workstreams, null, 2), 'utf-8');
}

export function listWorkstreams(): Workstream[] {
	return readAll();
}

export function getWorkstream(id: string): Workstream | undefined {
	return readAll().find((w) => w.id === id);
}

export function createWorkstream(data: WorkstreamCreate): Workstream {
	const workstreams = readAll();
	const now = new Date().toISOString();
	const workstream: Workstream = {
		...data,
		id: randomUUID(),
		createdAt: now,
		updatedAt: now
	};
	workstreams.push(workstream);
	writeAll(workstreams);
	return workstream;
}

export function updateWorkstream(id: string, data: WorkstreamUpdate): Workstream | undefined {
	const workstreams = readAll();
	const index = workstreams.findIndex((w) => w.id === id);
	if (index === -1) return undefined;

	workstreams[index] = {
		...workstreams[index],
		...data,
		updatedAt: new Date().toISOString()
	};
	writeAll(workstreams);
	return workstreams[index];
}

export function deleteWorkstream(id: string): boolean {
	const workstreams = readAll();
	const index = workstreams.findIndex((w) => w.id === id);
	if (index === -1) return false;
	workstreams.splice(index, 1);
	writeAll(workstreams);
	return true;
}
