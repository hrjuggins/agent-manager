import { json } from '@sveltejs/kit';
import { listWorkstreams, createWorkstream, updateWorkstream } from '$lib/server/store';
import { createWorktree } from '$lib/server/worktree';
import { openTerminalWithSetup, readRepoConfig } from '$lib/server/environment';
import type { WorkstreamCreate } from '$lib/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const workstreams = listWorkstreams();
	return json(workstreams);
};

export const POST: RequestHandler = async ({ request }) => {
	const data = (await request.json()) as WorkstreamCreate;
	const workstream = createWorkstream(data);

	// Auto-setup: if repo + branch are set, create worktree and open terminal
	if (workstream.repoPath && workstream.branch) {
		const worktreeResult = createWorktree(
			workstream.repoPath,
			workstream.branch,
			workstream.baseBranch
		);

		if (worktreeResult.success && worktreeResult.worktreePath) {
			const cwd = worktreeResult.worktreePath;
			updateWorkstream(workstream.id, { worktreePath: cwd, ideWorkspace: cwd });

			// Open terminal with setup script if one is configured
			const config = readRepoConfig(workstream.repoPath);
			if (config?.setup && config.setup.length > 0) {
				openTerminalWithSetup(workstream.repoPath, cwd);
			}
		} else {
			updateWorkstream(workstream.id, {
				environment: {
					state: 'error',
					services: [],
					setupLog: worktreeResult.message
				}
			});
		}
	}

	return json(workstream, { status: 201 });
};
