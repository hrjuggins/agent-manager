import { json, error } from '@sveltejs/kit';
import { getWorkstream, updateWorkstream } from '$lib/server/store';
import { removeWorktree } from '$lib/server/worktree';
import {
	openTerminal,
	startAllServices,
	openServiceTerminal,
	getServiceStatuses
} from '$lib/server/environment';
import { getRepoByPath } from '$lib/server/config';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const workstream = getWorkstream(params.id);
	if (!workstream) throw error(404, 'Workstream not found');

	const { action, serviceName } = (await request.json()) as {
		action: string;
		serviceName?: string;
	};

	switch (action) {
		case 'open-terminal': {
			if (!workstream.repoPath) {
				throw error(400, 'No repository path configured');
			}
			const cwd = workstream.worktreePath || workstream.repoPath;
			const result = openTerminal(cwd);
			return json(result);
		}

		case 'start-services': {
			if (!workstream.repoPath) {
				throw error(400, 'No repository path configured');
			}
			const cwd = workstream.worktreePath || workstream.repoPath;
			const result = startAllServices(workstream.repoPath, cwd);
			if (result.envDetails || result.portMap) {
				updateWorkstream(params.id, {
					environment: {
						state: 'running',
						services: [],
						envDetails: result.envDetails,
						portMap: result.portMap
					}
				});
			}
			return json(result);
		}

		case 'start-service': {
			if (!workstream.repoPath) {
				throw error(400, 'No repository path configured');
			}
			if (!serviceName) {
				throw error(400, 'serviceName is required');
			}
			const cwd = workstream.worktreePath || workstream.repoPath;
			const repoSettings = getRepoByPath(workstream.repoPath);
			const services = repoSettings?.devServices ?? [];
			const service = services.find((s) => s.name === serviceName);
			if (!service) {
				throw error(404, `Service "${serviceName}" not found in repo config`);
			}
			const portStride = repoSettings?.portStride ?? 10;
			const existingPortMap = workstream.environment?.portMap;
			const result = openServiceTerminal(
				workstream.repoPath,
				cwd,
				service,
				services,
				portStride,
				existingPortMap
			);
			// Store the allocated port in environment
			if (result.port !== undefined) {
				const currentEnv = workstream.environment ?? { state: 'running', services: [] };
				const updatedPortMap = { ...(currentEnv.portMap ?? {}), [serviceName]: result.port };
				const updatedEnvDetails = {
					...(currentEnv.envDetails ?? {}),
					[serviceName]: `http://localhost:${result.port}`
				};
				updateWorkstream(params.id, {
					environment: {
						...currentEnv,
						state: 'running',
						portMap: updatedPortMap,
						envDetails: updatedEnvDetails
					}
				});
			}
			return json(result);
		}

		case 'service-status': {
			if (!workstream.repoPath) {
				throw error(400, 'No repository path configured');
			}
			const cwd = workstream.worktreePath || workstream.repoPath;
			const repoSettings = getRepoByPath(workstream.repoPath);
			const services = repoSettings?.devServices ?? [];
			const portStride = repoSettings?.portStride ?? 10;
			const storedPorts = workstream.environment?.portMap;
			const statuses = getServiceStatuses(
				workstream.repoPath,
				cwd,
				services,
				portStride,
				storedPorts
			);
			return json({ success: true, statuses });
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
