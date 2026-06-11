import { listWorkstreams, updateWorkstream } from '$lib/server/store';
import { syncAllLinear } from '$lib/server/linear';
import { areAnyServicesRunning } from '$lib/server/environment';
import { getRepoByPath } from '$lib/server/config';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const workstreams = listWorkstreams();
	const synced = await syncAllLinear(workstreams);

	// Reconcile environment state: mark "running" workstreams as "stopped" if no services are alive
	for (const w of synced) {
		if (w.environment?.state === 'running' && w.repoPath) {
			const cwd = w.worktreePath || w.repoPath;
			const repoSettings = getRepoByPath(w.repoPath);
			const portStride = repoSettings?.portStride ?? 10;
			const stillRunning = areAnyServicesRunning(
				w.repoPath,
				cwd,
				portStride,
				w.environment.portMap
			);
			if (!stillRunning) {
				w.environment = { ...w.environment, state: 'stopped' };
				updateWorkstream(w.id, { environment: w.environment });
			}
		}
	}

	return { workstreams: synced };
};
