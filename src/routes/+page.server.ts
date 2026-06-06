import { listWorkstreams } from '$lib/server/store';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const workstreams = listWorkstreams();
	return { workstreams };
};
