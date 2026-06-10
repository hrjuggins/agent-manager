import { exec } from 'child_process';
import type { Workstream } from '$lib/types';
import { getIdeCommand } from './config';

export interface LaunchResult {
	success: boolean;
	message: string;
}

export function openInIDE(workstream: Workstream): LaunchResult {
	const target = workstream.ideWorkspace || workstream.worktreePath || workstream.repoPath;
	if (!target) {
		return { success: false, message: 'No IDE workspace or repo path configured' };
	}
	const ideCmd = getIdeCommand();
	if (!ideCmd) {
		return {
			success: false,
			message:
				'No IDE command configured. Go to Settings to set your IDE command (e.g. cursor, code, webstorm).'
		};
	}
	exec(`${ideCmd} "${target}"`);
	return { success: true, message: `Opening ${target} with ${ideCmd}` };
}

export function openBrowser(workstream: Workstream): LaunchResult {
	const url = workstream.browserUrl;
	if (!url) {
		return { success: false, message: 'No browser URL configured' };
	}
	const cmd = getOpenCommand();
	exec(`${cmd} "${url}"`);
	return { success: true, message: `Opening ${url} in browser` };
}

export function openAIChat(workstream: Workstream): LaunchResult {
	const url = workstream.aiChatUrl;
	if (!url) {
		return { success: false, message: 'No AI chat URL configured' };
	}
	const cmd = getOpenCommand();
	exec(`${cmd} "${url}"`);
	return { success: true, message: `Opening AI chat: ${url}` };
}

export function openLinearTicket(workstream: Workstream): LaunchResult {
	const url = workstream.linearTicket?.url;
	if (!url) {
		return { success: false, message: 'No Linear ticket linked' };
	}
	const cmd = getOpenCommand();
	exec(`${cmd} "${url}"`);
	return { success: true, message: `Opening Linear ticket: ${url}` };
}

export function openPullRequest(workstream: Workstream): LaunchResult {
	const url = workstream.pullRequest?.url;
	if (!url) {
		return { success: false, message: 'No pull request linked' };
	}
	const cmd = getOpenCommand();
	exec(`${cmd} "${url}"`);
	return { success: true, message: `Opening PR: ${url}` };
}

export function openGitHubDesktop(workstream: Workstream): LaunchResult {
	const target = workstream.worktreePath || workstream.repoPath;
	if (!target) {
		return { success: false, message: 'No worktree or repo path configured' };
	}
	// Use x-github-client URL scheme to navigate to repo (not add it)
	const repoUrl = `x-github-client://openRepo/${encodeURI(target)}`;
	const cmd = getOpenCommand();
	exec(`${cmd} "${repoUrl}"`);
	return { success: true, message: `Opening GitHub Desktop Plus for ${target}` };
}

function getOpenCommand(): string {
	switch (process.platform) {
		case 'darwin':
			return 'open';
		case 'win32':
			return 'start';
		default:
			return 'xdg-open';
	}
}
