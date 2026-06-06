import { exec } from 'child_process';
import type { Workstream } from '$lib/types';

export interface LaunchResult {
	success: boolean;
	message: string;
}

export function openInIDE(workstream: Workstream): LaunchResult {
	const target = workstream.ideWorkspace || workstream.repoPath;
	if (!target) {
		return { success: false, message: 'No IDE workspace or repo path configured' };
	}
	// Try VS Code first, fall back to $EDITOR
	exec(`code "${target}"`, (error) => {
		if (error) {
			exec(`${process.env.EDITOR || 'vim'} "${target}"`);
		}
	});
	return { success: true, message: `Opening ${target} in IDE` };
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

export function checkoutBranch(workstream: Workstream): LaunchResult {
	if (!workstream.repoPath) {
		return { success: false, message: 'No repo path configured' };
	}
	if (!workstream.branch) {
		return { success: false, message: 'No branch configured' };
	}
	exec(`git -C "${workstream.repoPath}" checkout "${workstream.branch}"`, (error) => {
		if (error) {
			// Try creating the branch if it doesn't exist
			exec(`git -C "${workstream.repoPath}" checkout -b "${workstream.branch}"`);
		}
	});
	return { success: true, message: `Checking out branch: ${workstream.branch}` };
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
