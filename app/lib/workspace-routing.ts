export type WorkspaceModule =
    | 'projects'
    | 'aigc-detection'
    | 'aigc-rewrite'
    | 'prompt-assets'
    | 'credentials'
    | 'members'
    | 'settings';

const knownModules = new Set<WorkspaceModule>([
    'projects',
    'aigc-detection',
    'aigc-rewrite',
    'prompt-assets',
    'credentials',
    'members',
    'settings',
]);

export function getWorkspaceModuleFromPathname(pathname: string): WorkspaceModule {
    const segment = pathname.split('/').filter(Boolean)[2];

    if (segment && knownModules.has(segment as WorkspaceModule)) {
        return segment as WorkspaceModule;
    }

    return 'projects';
}

export function getWorkspaceSlugFromPathname(pathname: string): string | null {
    const segments = pathname.split('/').filter(Boolean);

    if (segments[0] !== 'w' || !segments[1]) {
        return null;
    }

    return decodeURIComponent(segments[1]);
}

export function getWorkspaceSlugFromWindow(): string | null {
    if (typeof window === 'undefined') {
        return null;
    }

    return getWorkspaceSlugFromPathname(window.location.pathname);
}

export function buildWorkspaceModulePath(
    workspaceSlug: string,
    module: WorkspaceModule,
    options: {
        projectId?: string | null;
        entry?: string | null;
    } = {}
): string {
    const path = workspaceSlug
        ? `/w/${encodeURIComponent(workspaceSlug)}/${module}`
        : module === 'prompt-assets'
          ? '/prompt-assets'
          : '/';
    const searchParams = new URLSearchParams();

    if (module === 'projects' && options.projectId) {
        searchParams.set('projectId', options.projectId);
    }

    if (module === 'prompt-assets' && options.entry) {
        searchParams.set('entry', options.entry);
    }

    const query = searchParams.toString();
    return query ? `${path}?${query}` : path;
}
