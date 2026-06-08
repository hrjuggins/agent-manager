import { json, error } from '@sveltejs/kit';
import { listRepos, createRepo } from '$lib/server/config';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json(listRepos());
};

export const POST: RequestHandler = async ({ request }) => {
	const data = (await request.json()) as {
		name: string;
		path: string;
		setupScript?: string;
		basePort?: number;
	};

	if (!data.name || !data.path) {
		throw error(400, 'Name and path are required');
	}

	const repo = createRepo(data);
	return json(repo, { status: 201 });
};
