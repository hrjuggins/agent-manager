import { json, error } from '@sveltejs/kit';
import { getWorkstream, updateWorkstream } from '$lib/server/store';
import { createWorktree, removeWorktree } from '$lib/server/worktree';
import {
	runScript,
	stopServices,
	getEnvironmentStatus,
	readRepoConfig
} from '$lib/server/environment';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const workstream = getWorkstream(params.id);
	if (!workstream) throw error(404, 'Workstream not found');

	const status = getEnvironmentStatus(params.id);
	return json(status);
};

export const POST: RequestHandler = async ({ params, request }) => {
	const workstream = getWorkstream(params.id);
	if (!workstream) throw error(404, 'Workstream not found');

	const { action } = (await request.json()) as { action: string };

	switch (action) {
		case 'start': {
			if (!workstream.repoPath) {
				throw error(400, 'No repository path configured');
			}

			let cwd = workstream.worktreePath || workstream.repoPath;

			// Create worktree if branch is set and no worktree exists yet
			if (workstream.branch && !workstream.worktreePath) {
				const result = createWorktree(workstream.repoPath, workstream.branch);
				if (!result.success) {
					throw error(500, result.message);
				}
				cwd = result.worktreePath!;
				updateWorkstream(params.id, { worktreePath: cwd });
			}

			// Run the setup script
			const config = readRepoConfig(workstream.repoPath);
			if (config?.setup && config.setup.length > 0) {
				runScript(params.id, cwd, workstream.repoPath);
			}

			const envStatus = getEnvironmentStatus(params.id);
			updateWorkstream(params.id, { environment: envStatus });

			return json({
				success: true,
				message: 'Environment started',
				environment: envStatus
			});
		}

		case 'stop': {
			stopServices(params.id);
			const envStatus = getEnvironmentStatus(params.id);
			updateWorkstream(params.id, { environment: envStatus });
			return json({ success: true, message: 'Environment stopped', environment: envStatus });
		}

		case 'teardown': {
			// Stop services and remove worktree
			stopServices(params.id);
			if (workstream.worktreePath && workstream.repoPath) {
				removeWorktree(workstream.repoPath, workstream.worktreePath);
				updateWorkstream(params.id, {
					worktreePath: undefined,
					environment: undefined
				});
			}
			return json({ success: true, message: 'Environment torn down' });
		}

		default:
			throw error(400, `Unknown action: ${action}`);
	}
};
