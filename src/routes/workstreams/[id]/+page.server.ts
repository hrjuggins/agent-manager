import { error } from '@sveltejs/kit';
import { getWorkstream } from '$lib/server/store';
import { syncWorkstreamLinear } from '$lib/server/linear';
import { getRepoByPath } from '$lib/server/config';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const workstream = getWorkstream(params.id);
	if (!workstream) throw error(404, 'Workstream not found');
	const synced = await syncWorkstreamLinear(workstream);
	const repoSettings = synced.repoPath ? getRepoByPath(synced.repoPath) : undefined;
	return {
		workstream: synced,
		devServices: repoSettings?.devServices ?? [],
		portStride: repoSettings?.portStride ?? 10
	};
};
