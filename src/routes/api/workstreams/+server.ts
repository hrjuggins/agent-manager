import { json } from '@sveltejs/kit';
import { listWorkstreams, createWorkstream, updateWorkstream } from '$lib/server/store';
import { createWorktree } from '$lib/server/worktree';
import { runSetupInTerminal, readRepoConfig, startAllServices } from '$lib/server/environment';
import { getRepoByPath } from '$lib/server/config';
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

			// Check if repo has dev services configured — if so, use multi-tab approach
			const repoSettings = getRepoByPath(workstream.repoPath);
			const hasDevServices = (repoSettings?.devServices ?? []).length > 0;

			if (hasDevServices) {
				// First run install script if configured, then start services
				const config = readRepoConfig(workstream.repoPath);
				if (config?.setup && config.setup.length > 0) {
					runSetupInTerminal(workstream.repoPath, cwd);
				}
				// Start each dev service in its own terminal tab
				const serviceResult = startAllServices(workstream.repoPath, cwd);
				if (serviceResult.envDetails) {
					updateWorkstream(workstream.id, {
						environment: {
							state: 'running',
							services: [],
							envDetails: serviceResult.envDetails
						}
					});
				}
			} else {
				// Legacy: single setup script in one terminal
				const config = readRepoConfig(workstream.repoPath);
				if (config?.setup && config.setup.length > 0) {
					runSetupInTerminal(workstream.repoPath, cwd);
				}
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
