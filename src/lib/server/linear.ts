import { getLinearApiKey } from '$lib/server/config';

export interface LinearPullRequest {
	url: string;
	title: string;
	status: string;
}

export interface LinearIssueData {
	identifier: string;
	title: string;
	url: string;
	status: string;
	assignee?: string;
	priority?: string;
	pullRequests?: LinearPullRequest[];
}

export function parseLinearUrl(url: string): string | null {
	// Matches: https://linear.app/<org>/issue/<IDENTIFIER>/...
	const match = url.match(/linear\.app\/[^/]+\/issue\/([A-Za-z]+-\d+)/i);
	if (!match) return null;
	// Linear identifiers are uppercase (e.g. PRO-860)
	return match[1].toUpperCase();
}

export async function fetchLinearIssue(
	identifier: string
): Promise<{ data: LinearIssueData | null; error?: string }> {
	const apiKey = getLinearApiKey();
	if (!apiKey)
		return {
			data: null,
			error: 'No valid API key configured. Go to Settings and re-enter your Linear API key.'
		};

	const query = `{
		issue(id: "${identifier}") {
			identifier
			title
			url
			state { name }
			assignee { name }
			priorityLabel
			attachments {
				nodes {
					url
					title
					subtitle
					sourceType
				}
			}
		}
	}`;

	try {
		const res = await fetch('https://api.linear.app/graphql', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: apiKey
			},
			body: JSON.stringify({ query })
		});

		if (!res.ok) {
			return { data: null, error: `Linear API returned ${res.status}` };
		}

		const json = (await res.json()) as {
			data?: {
				issue?: {
					identifier: string;
					title: string;
					url: string;
					state?: { name: string };
					assignee?: { name: string };
					priorityLabel?: string;
					attachments?: {
						nodes: Array<{
							url: string;
							title: string;
							subtitle?: string;
							sourceType?: string;
						}>;
					};
				};
			};
			errors?: Array<{ message: string }>;
		};

		if (json.errors?.length) {
			return { data: null, error: json.errors[0].message };
		}

		const issue = json.data?.issue;
		if (!issue) return { data: null, error: `No issue found for "${identifier}"` };

		// Extract PRs from attachments (GitHub/GitLab PR links)
		const pullRequests: LinearPullRequest[] = (issue.attachments?.nodes ?? [])
			.filter(
				(a) =>
					a.url &&
					(a.url.includes('/pull/') ||
						a.url.includes('/merge_requests/') ||
						a.sourceType === 'github' ||
						a.sourceType === 'gitlab')
			)
			.map((a) => ({
				url: a.url,
				title: a.title || a.subtitle || a.url,
				status: a.subtitle ?? 'Open'
			}));

		return {
			data: {
				identifier: issue.identifier,
				title: issue.title,
				url: issue.url,
				status: issue.state?.name ?? 'Unknown',
				assignee: issue.assignee?.name,
				priority: issue.priorityLabel,
				pullRequests: pullRequests.length > 0 ? pullRequests : undefined
			}
		};
	} catch (err) {
		return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
	}
}
