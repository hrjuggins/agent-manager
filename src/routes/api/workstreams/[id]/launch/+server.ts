import { json, error } from '@sveltejs/kit';
import { getWorkstream } from '$lib/server/store';
import {
	openInIDE,
	openBrowser,
	openAIChat,
	openLinearTicket,
	openPullRequest
} from '$lib/server/launcher';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const workstream = getWorkstream(params.id);
	if (!workstream) throw error(404, 'Workstream not found');

	const { action } = (await request.json()) as { action: string };

	switch (action) {
		case 'ide':
			return json(openInIDE(workstream));
		case 'browser':
			return json(openBrowser(workstream));
		case 'ai-chat':
			return json(openAIChat(workstream));
		case 'linear':
			return json(openLinearTicket(workstream));
		case 'pull-request':
			return json(openPullRequest(workstream));
		default:
			throw error(400, `Unknown action: ${action}`);
	}
};
