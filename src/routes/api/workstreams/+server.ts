import { json } from '@sveltejs/kit';
import { listWorkstreams, createWorkstream } from '$lib/server/store';
import type { WorkstreamCreate } from '$lib/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const workstreams = listWorkstreams();
	return json(workstreams);
};

export const POST: RequestHandler = async ({ request }) => {
	const data = (await request.json()) as WorkstreamCreate;
	const workstream = createWorkstream(data);
	return json(workstream, { status: 201 });
};
