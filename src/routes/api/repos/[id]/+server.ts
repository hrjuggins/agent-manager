import { json, error } from '@sveltejs/kit';
import { getRepo, updateRepo, deleteRepo } from '$lib/server/config';
import type { RepoSettings } from '$lib/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const repo = getRepo(params.id);
	if (!repo) throw error(404, 'Repo not found');
	return json(repo);
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const data = (await request.json()) as Partial<Omit<RepoSettings, 'id'>>;
	const repo = updateRepo(params.id, data);
	if (!repo) throw error(404, 'Repo not found');
	return json(repo);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const deleted = deleteRepo(params.id);
	if (!deleted) throw error(404, 'Repo not found');
	return json({ success: true });
};
