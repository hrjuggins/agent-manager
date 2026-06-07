export interface Workstream {
	id: string;
	name: string;
	status: 'active' | 'done';
	repoPath?: string;
	branch?: string;
	worktreePath?: string;
	ideWorkspace?: string;
	aiChatUrl?: string;
	devServices: DevService[];
	browserUrl?: string;
	linearTicket?: LinearTicket;
	pullRequest?: PullRequest;
	notes?: string;
	environment?: EnvironmentStatus;
	createdAt: string;
	updatedAt: string;
}

export interface DevService {
	name: string;
	command: string;
	cwd?: string;
}

export interface LinearTicket {
	id: string;
	url: string;
	title: string;
	status: string;
}

export interface PullRequest {
	url: string;
	title: string;
	status: string;
}

export interface EnvironmentStatus {
	state: 'stopped' | 'starting' | 'running' | 'error';
	services: RunningService[];
	setupLog?: string;
}

export interface RunningService {
	name: string;
	command: string;
	pid?: number;
	port?: number;
	status: 'running' | 'stopped' | 'error';
}

export interface RepoConfig {
	setup?: string[];
	services?: ServiceDefinition[];
}

export interface ServiceDefinition {
	name: string;
	command: string;
	port?: number;
}

export type WorkstreamCreate = Omit<Workstream, 'id' | 'createdAt' | 'updatedAt'>;
export type WorkstreamUpdate = Partial<WorkstreamCreate>;
