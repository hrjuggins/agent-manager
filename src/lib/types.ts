export interface Workstream {
	id: string;
	name: string;
	status: 'active' | 'done';
	repoPath?: string;
	branch?: string;
	ideWorkspace?: string;
	aiChatUrl?: string;
	devServices: DevService[];
	browserUrl?: string;
	linearTicket?: LinearTicket;
	pullRequest?: PullRequest;
	notes?: string;
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

export type WorkstreamCreate = Omit<Workstream, 'id' | 'createdAt' | 'updatedAt'>;
export type WorkstreamUpdate = Partial<WorkstreamCreate>;
