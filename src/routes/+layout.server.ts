import { listWorkstreams } from '$lib/server/store';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	const workstreams = listWorkstreams();
	return { workstreamIds: workstreams.map((w) => w.id) };
};
