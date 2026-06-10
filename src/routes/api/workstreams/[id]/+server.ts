import { json, error } from '@sveltejs/kit';
import { getWorkstream, updateWorkstream, deleteWorkstream } from '$lib/server/store';
import type { WorkstreamUpdate } from '$lib/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const workstream = getWorkstream(params.id);
	if (!workstream) throw error(404, 'Workstream not found');
	return json(workstream);
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const data = (await request.json()) as WorkstreamUpdate;
	const workstream = updateWorkstream(params.id, data);
	if (!workstream) throw error(404, 'Workstream not found');
	return json(workstream);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const success = deleteWorkstream(params.id);
	if (!success) throw error(404, 'Workstream not found');
	return json({ success: true });
};
