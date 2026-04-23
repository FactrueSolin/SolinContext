// @vitest-environment node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Principal } from '../../../app/lib/auth/principal';
import { createAppDatabaseContext, type AppDatabaseContext } from '../../../app/lib/db/client';
import { users, workspaces, workspaceMemberships } from '../../../app/lib/db/schema';
import { ProjectRepository } from '../../../app/lib/projects/repository';
import { ProjectService } from '../../../app/lib/projects/service';
import { parseApiConfigJson } from '../../../app/lib/projects/revisions';
import type { ProjectData } from '../../../app/types';

const principal: Principal = {
    userId: 'user-1',
    logtoUserId: 'logto-user-1',
    email: 'user@example.com',
    name: 'User',
    avatarUrl: null,
    activeWorkspaceId: 'workspace-1',
    activeWorkspaceSlug: 'workspace-1',
    activeWorkspaceName: 'Workspace 1',
    activeWorkspaceType: 'personal',
    activeWorkspaceStatus: 'active',
    workspaceRole: 'owner',
    permissions: [
        'project:read',
        'project:write',
        'project:delete',
        'prompt_asset:read',
        'prompt_asset:write',
        'prompt_asset:archive',
        'credential:read_meta',
        'credential:use',
        'credential:manage',
        'member:read',
        'member:manage',
        'workspace:manage',
    ],
};

describe('ProjectService legacy JSON import', () => {
    let dataDir: string;
    let database: AppDatabaseContext;
    let repository: ProjectRepository;
    let service: ProjectService;
    let previousDataDir: string | undefined;

    beforeEach(() => {
        previousDataDir = process.env.DATA_DIR;
        dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aicontext-projects-'));
        process.env.DATA_DIR = dataDir;

        database = createAppDatabaseContext({ fileName: ':memory:' });
        database.db.insert(users).values({
            id: principal.userId,
            logtoUserId: principal.logtoUserId,
            email: principal.email,
            name: principal.name,
            status: 'active',
            lastLoginAt: 1,
            createdAt: 1,
            updatedAt: 1,
        }).run();
        database.db.insert(workspaces).values({
            id: principal.activeWorkspaceId,
            type: 'personal',
            name: principal.activeWorkspaceName,
            slug: principal.activeWorkspaceSlug,
            ownerUserId: principal.userId,
            logtoOrganizationId: null,
            status: 'active',
            createdAt: 1,
            updatedAt: 1,
        }).run();
        database.db.insert(workspaceMemberships).values({
            id: 'membership-1',
            workspaceId: principal.activeWorkspaceId,
            userId: principal.userId,
            role: principal.workspaceRole,
            status: 'active',
            joinedAt: 1,
            invitedBy: principal.userId,
            createdAt: 1,
            updatedAt: 1,
        }).run();

        repository = new ProjectRepository(database.db);
        service = new ProjectService({
            database,
            repository,
        });
    });

    afterEach(() => {
        database.client.close();
        fs.rmSync(dataDir, { recursive: true, force: true });

        if (previousDataDir === undefined) {
            delete process.env.DATA_DIR;
        } else {
            process.env.DATA_DIR = previousDataDir;
        }
    });

    it('imports legacy project.json and keeps historical filenames addressable', () => {
        const projectId = 'legacy-project';
        const historyFilename = '2025-01-01T00-00-00-000Z.json';
        const historySnapshot: ProjectData = {
            meta: {
                id: projectId,
                name: 'Old Project Name',
                createdAt: '2025-01-01T00:00:00.000Z',
                updatedAt: '2025-01-01T00:00:00.000Z',
            },
            systemPrompt: 'Old prompt',
            messages: [],
            apiConfig: {
                baseUrl: 'https://api.anthropic.com',
                apiKey: 'old-key',
                model: 'old-model',
            },
        };
        const currentSnapshot: ProjectData = {
            meta: {
                id: projectId,
                name: 'Current Project Name',
                createdAt: '2025-01-01T00:00:00.000Z',
                updatedAt: '2025-01-02T00:00:00.000Z',
            },
            systemPrompt: 'Current prompt',
            messages: [
                {
                    id: 'message-1',
                    role: 'user',
                    content: [{ type: 'text', text: 'Hello' }],
                },
            ],
            apiConfig: {
                baseUrl: 'https://api.anthropic.com',
                apiKey: 'current-key',
                model: 'current-model',
            },
        };

        fs.mkdirSync(path.join(dataDir, projectId, 'history'), { recursive: true });
        fs.writeFileSync(
            path.join(dataDir, projectId, 'project.json'),
            JSON.stringify(currentSnapshot, null, 2),
            'utf-8'
        );
        fs.writeFileSync(
            path.join(dataDir, projectId, 'history', historyFilename),
            JSON.stringify(historySnapshot, null, 2),
            'utf-8'
        );

        const projects = service.listProjects(principal, {
            query: undefined,
            page: 1,
            pageSize: 20,
            sortBy: 'updatedAt',
            sortOrder: 'desc',
        });
        const detail = service.getLegacyProject(principal, projectId);
        const history = service.listCompatHistory(principal, projectId);
        const historicalDetail = service.getRevisionByCompatFilename(principal, projectId, historyFilename);
        const updatedDetail = service.updateProject(principal, projectId, {
            systemPrompt: 'Updated prompt',
        });
        const duplicatedDetail = service.duplicateProject(principal, projectId);
        const projectsAfterDuplicate = service.listProjects(principal, {
            query: undefined,
            page: 1,
            pageSize: 20,
            sortBy: 'updatedAt',
            sortOrder: 'desc',
        });
        const currentRevision = repository.findCurrentRevision(principal.activeWorkspaceId, projectId);
        const duplicatedProject = projectsAfterDuplicate.items.find((item) => item.name === 'Current Project Name (Copy)');
        const duplicatedRevision = duplicatedProject
            ? repository.findCurrentRevision(principal.activeWorkspaceId, duplicatedProject.id)
            : null;

        expect(projects.items).toHaveLength(1);
        expect(projects.items[0].id).toBe(projectId);
        expect(detail.meta.name).toBe('Current Project Name');
        expect(detail.systemPrompt).toBe('Current prompt');
        expect(detail.apiConfig.baseUrl).toBeUndefined();
        expect(detail.apiConfig.apiKey).toBeUndefined();
        expect(detail.apiConfig.model).toBeUndefined();
        expect(history).toEqual([
            {
                filename: historyFilename,
                timestamp: '2025-01-01T00:00:00.000Z',
            },
        ]);
        expect(historicalDetail.meta.name).toBe('Old Project Name');
        expect(historicalDetail.systemPrompt).toBe('Old prompt');
        expect(historicalDetail.apiConfig.apiKey).toBeUndefined();
        expect(updatedDetail.apiConfig.apiKey).toBeUndefined();
        expect(duplicatedDetail.meta.name).toBe('Current Project Name (Copy)');
        expect(currentRevision).not.toBeNull();
        expect(duplicatedRevision).not.toBeNull();
        expect(parseApiConfigJson(currentRevision!.apiConfigJson)).toMatchObject({
            baseUrl: 'https://api.anthropic.com',
            apiKey: 'current-key',
            model: 'current-model',
        });
        expect(parseApiConfigJson(duplicatedRevision!.apiConfigJson)).toMatchObject({
            baseUrl: 'https://api.anthropic.com',
            apiKey: 'current-key',
            model: 'current-model',
        });
    });
});
