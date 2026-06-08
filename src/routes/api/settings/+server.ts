import { json, error } from '@sveltejs/kit';
import { readConfig, writeConfig, validateLinearApiKey } from '$lib/server/config';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const config = readConfig();
	return json({
		hasLinearKey: !!config.linearApiKey
	});
};

export const PUT: RequestHandler = async ({ request }) => {
	const data = (await request.json()) as { linearApiKey?: string; clearKey?: boolean };
	const config = readConfig();

	if (data.clearKey) {
		config.linearApiKey = undefined;
	} else if (data.linearApiKey) {
		const validationError = validateLinearApiKey(data.linearApiKey);
		if (validationError) throw error(400, validationError);
		config.linearApiKey = data.linearApiKey;
	}

	writeConfig(config);
	return json({
		success: true,
		hasLinearKey: !!config.linearApiKey
	});
};
