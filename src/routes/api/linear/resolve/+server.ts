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

	let issueId = identifier?.toUpperCase();
	if (!issueId && url) {
		issueId = parseLinearUrl(url) ?? undefined;
	}
	if (!issueId) {
		throw error(
			400,
			`Could not extract issue identifier from input. Expected a URL like https://linear.app/team/issue/PRJ-123/... or an ID like PRJ-123. Got: ${url || identifier || '(empty)'}`
		);
	}

	const result = await fetchLinearIssue(issueId);
	if (!result.data) {
		throw error(404, result.error || `Linear issue ${issueId} not found`);
	}

	return json(result.data);
};
