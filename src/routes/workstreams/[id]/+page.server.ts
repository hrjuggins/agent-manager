import { error } from '@sveltejs/kit';
import { getWorkstream, updateWorkstream } from '$lib/server/store';
import { syncWorkstreamLinear } from '$lib/server/linear';
import { getRepoByPath } from '$lib/server/config';
import { areAnyServicesRunning } from '$lib/server/environment';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const workstream = getWorkstream(params.id);
	if (!workstream) throw error(404, 'Workstream not found');
	const synced = await syncWorkstreamLinear(workstream);
	const repoSettings = synced.repoPath ? getRepoByPath(synced.repoPath) : undefined;
	const portStride = repoSettings?.portStride ?? 10;

	// Reconcile: if state says "running" but no services are alive, mark stopped
	if (synced.environment?.state === 'running' && synced.repoPath) {
		const cwd = synced.worktreePath || synced.repoPath;
		const stillRunning = areAnyServicesRunning(
			synced.repoPath,
			cwd,
			portStride,
			synced.environment.portMap
		);
		if (!stillRunning) {
			synced.environment = { ...synced.environment, state: 'stopped' };
			updateWorkstream(synced.id, { environment: synced.environment });
		}
	}

	return {
		workstream: synced,
		devServices: repoSettings?.devServices ?? [],
		portStride
	};
};
