import { listWorkstreams } from '$lib/server/store';
import { syncAllLinear } from '$lib/server/linear';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const workstreams = listWorkstreams();
	const synced = await syncAllLinear(workstreams);
	return { workstreams: synced };
};
