import { json, error } from '@sveltejs/kit';
import { getWorkstream, updateWorkstream } from '$lib/server/store';
import { removeWorktree } from '$lib/server/worktree';
import { openTerminalWithSetup } from '$lib/server/environment';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const workstream = getWorkstream(params.id);
	if (!workstream) throw error(404, 'Workstream not found');

	const { action } = (await request.json()) as { action: string };

	switch (action) {
		case 'open-terminal': {
			if (!workstream.repoPath) {
				throw error(400, 'No repository path configured');
			}
			const cwd = workstream.worktreePath || workstream.repoPath;
			const result = openTerminalWithSetup(workstream.repoPath, cwd);
			return json(result);
		}

		case 'teardown': {
			if (workstream.worktreePath && workstream.repoPath) {
				removeWorktree(workstream.repoPath, workstream.worktreePath);
				updateWorkstream(params.id, {
					worktreePath: undefined,
					environment: undefined
				});
			}
			return json({ success: true, message: 'Worktree removed' });
		}

		default:
			throw error(400, `Unknown action: ${action}`);
	}
};
