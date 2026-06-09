import { error } from '@sveltejs/kit';
import { getWorkstream } from '$lib/server/store';
import { syncWorkstreamLinear } from '$lib/server/linear';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const workstream = getWorkstream(params.id);
	if (!workstream) throw error(404, 'Workstream not found');
	const synced = await syncWorkstreamLinear(workstream);
	return { workstream: synced };
};
