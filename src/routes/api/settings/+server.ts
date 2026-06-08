import { json } from '@sveltejs/kit';
import { readConfig, writeConfig } from '$lib/server/config';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const config = readConfig();
	return json({
		linearApiKey: config.linearApiKey ? maskKey(config.linearApiKey) : '',
		hasLinearKey: !!config.linearApiKey
	});
};

export const PUT: RequestHandler = async ({ request }) => {
	const data = (await request.json()) as { linearApiKey?: string };
	const config = readConfig();

	if (data.linearApiKey !== undefined) {
		config.linearApiKey = data.linearApiKey || undefined;
	}

	writeConfig(config);
	return json({
		success: true,
		hasLinearKey: !!config.linearApiKey
	});
};

function maskKey(key: string): string {
	if (key.length <= 8) return '••••••••';
	return key.slice(0, 4) + '••••' + key.slice(-4);
}
