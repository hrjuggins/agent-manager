import { cleanupOrphanedProcesses } from '$lib/server/environment';

// Kill any orphaned processes from a previous hub session on startup
cleanupOrphanedProcesses();
