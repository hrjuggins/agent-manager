import { json } from '@sveltejs/kit';
import { listWorkstreams, createWorkstream, updateWorkstream } from '$lib/server/store';
import { createWorktree } from '$lib/server/worktree';
import {
	runSetup,
	startServices,
	getEnvironmentStatus,
	readRepoConfig
} from '$lib/server/environment';
import type { WorkstreamCreate } from '$lib/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const workstreams = listWorkstreams();
	return json(workstreams);
};

export const POST: RequestHandler = async ({ request }) => {
	const data = (await request.json()) as WorkstreamCreate;
	const workstream = createWorkstream(data);

	// Auto-setup: if repo + branch are set and repo has a config, bootstrap environment
	if (workstream.repoPath && workstream.branch) {
		const config = readRepoConfig(workstream.repoPath);
		if (config) {
			// Mark as starting and kick off setup in background
			updateWorkstream(workstream.id, {
				environment: { state: 'starting', services: [] }
			});

			bootstrapEnvironment(workstream.id, workstream.repoPath, workstream.branch).catch(() => {
				// Errors are captured in environment state
			});
		}
	}

	return json(workstream, { status: 201 });
};

async function bootstrapEnvironment(
	workstreamId: string,
	repoPath: string,
	branch: string
): Promise<void> {
	// Create worktree
	const worktreeResult = createWorktree(repoPath, branch);
	if (!worktreeResult.success) {
		updateWorkstream(workstreamId, {
			environment: { state: 'error', services: [], setupLog: worktreeResult.message }
		});
		return;
	}

	const cwd = worktreeResult.worktreePath!;
	updateWorkstream(workstreamId, { worktreePath: cwd });

	// Run setup commands
	const config = readRepoConfig(repoPath);
	if (config?.setup) {
		const setupResult = await runSetup(workstreamId, cwd, repoPath);
		if (!setupResult.success) {
			updateWorkstream(workstreamId, {
				environment: { state: 'error', services: [], setupLog: setupResult.log }
			});
			return;
		}
	}

	// Start services
	startServices(workstreamId, cwd, repoPath);
	const envStatus = getEnvironmentStatus(workstreamId);
	updateWorkstream(workstreamId, { environment: envStatus });
}
