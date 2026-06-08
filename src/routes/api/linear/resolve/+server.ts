import { json, error } from '@sveltejs/kit';
import { getLinearApiKey } from '$lib/server/config';
import { parseLinearUrl, fetchLinearIssue } from '$lib/server/linear';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = getLinearApiKey();
	if (!apiKey) {
		throw error(400, 'Linear API key not configured. Go to Settings to add one.');
	}

	const { url, identifier } = (await request.json()) as { url?: string; identifier?: string };

	let issueId = identifier;
	if (!issueId && url) {
		issueId = parseLinearUrl(url) ?? undefined;
	}
	if (!issueId) {
		throw error(400, 'Could not extract issue identifier from URL');
	}

	const issue = await fetchLinearIssue(issueId);
	if (!issue) {
		throw error(404, `Linear issue ${issueId} not found`);
	}

	return json(issue);
};
