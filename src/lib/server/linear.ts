import { getLinearApiKey } from '$lib/server/config';

export interface LinearIssueData {
	identifier: string;
	title: string;
	url: string;
	status: string;
	assignee?: string;
	priority?: string;
}

export function parseLinearUrl(url: string): string | null {
	// Matches: https://linear.app/<org>/issue/<IDENTIFIER>/...
	const match = url.match(/linear\.app\/[^/]+\/issue\/([A-Z]+-\d+)/i);
	return match?.[1] ?? null;
}

export async function fetchLinearIssue(identifier: string): Promise<LinearIssueData | null> {
	const apiKey = getLinearApiKey();
	if (!apiKey) return null;

	const query = `{
		issue(id: "${identifier}") {
			identifier
			title
			url
			state { name }
			assignee { name }
			priorityLabel
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

		if (!res.ok) return null;

		const json = (await res.json()) as {
			data?: {
				issue?: {
					identifier: string;
					title: string;
					url: string;
					state?: { name: string };
					assignee?: { name: string };
					priorityLabel?: string;
				};
			};
		};

		const issue = json.data?.issue;
		if (!issue) return null;

		return {
			identifier: issue.identifier,
			title: issue.title,
			url: issue.url,
			status: issue.state?.name ?? 'Unknown',
			assignee: issue.assignee?.name,
			priority: issue.priorityLabel
		};
	} catch {
		return null;
	}
}
