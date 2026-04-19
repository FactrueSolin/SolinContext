import fs from 'fs';
import path from 'path';
import type { ProjectData } from '../../types';
import type { Principal } from '../auth/principal';
import type { AppDatabaseContext } from '../db/client';
import { getDataDir } from '../runtime-paths';
import { ProjectRepository, type ProjectRevisionRow, type ProjectRow } from './repository';
import {
    buildCompatHistoryKey,
    computeProjectContentHash,
    parseIsoTimestamp,
    parseLegacyHistoryTimestamp,
    serializeApiConfig,
    serializeMessages,
} from './revisions';

interface LegacyRevisionSeed {
    historyKey: string;
    createdAt: number;
    legacySourcePath: string;
    project: ProjectData;
}

export interface LegacyProjectImportSummary {
    importedProjects: number;
    importedRevisions: number;
    skippedProjects: number;
    failedProjects: string[];
}

export function importLegacyProjectsIntoWorkspace(options: {
    principal: Principal;
    database: AppDatabaseContext;
    repository: ProjectRepository;
}): LegacyProjectImportSummary {
    const summary: LegacyProjectImportSummary = {
        importedProjects: 0,
        importedRevisions: 0,
        skippedProjects: 0,
        failedProjects: [],
    };
    const dataDir = getDataDir();

    if (!fs.existsSync(dataDir)) {
        return summary;
    }

    for (const projectId of fs.readdirSync(dataDir)) {
        const projectDir = path.join(dataDir, projectId);
        const projectFile = path.join(projectDir, 'project.json');

        if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory() || !fs.existsSync(projectFile)) {
            continue;
        }

        try {
            if (options.repository.existsById(projectId)) {
                summary.skippedProjects += 1;
                continue;
            }

            const currentProject = readProjectFile(projectFile);
            const historyDir = path.join(projectDir, 'history');
            const historySeeds: LegacyRevisionSeed[] = fs.existsSync(historyDir)
                ? fs.readdirSync(historyDir)
                    .filter((entry) => entry.endsWith('.json'))
                    .map((filename) => {
                        const filePath = path.join(historyDir, filename);
                        const project = readProjectFile(filePath);

                        return {
                            historyKey: filename,
                            createdAt:
                                parseLegacyHistoryTimestamp(filename) ??
                                parseIsoTimestamp(project.meta.updatedAt) ??
                                parseIsoTimestamp(currentProject.meta.createdAt) ??
                                Date.now(),
                            legacySourcePath: filePath,
                            project,
                        };
                    })
                : [];

            historySeeds.sort((left, right) => left.createdAt - right.createdAt || left.historyKey.localeCompare(right.historyKey));

            const currentRevisionId = buildLegacyRevisionId(projectId, historySeeds.length + 1);
            const currentSeed: LegacyRevisionSeed = {
                historyKey: buildCompatHistoryKey(currentRevisionId),
                createdAt:
                    parseIsoTimestamp(currentProject.meta.updatedAt) ??
                    parseIsoTimestamp(currentProject.meta.createdAt) ??
                    Date.now(),
                legacySourcePath: projectFile,
                project: currentProject,
            };

            const allSeeds = [...historySeeds, currentSeed];
            let previousRevisionId: string | null = null;
            const revisions = allSeeds.map((seed, index) => {
                const revisionId =
                    index === allSeeds.length - 1
                        ? currentRevisionId
                        : buildLegacyRevisionId(projectId, index + 1);

                const revision: ProjectRevisionRow = {
                    id: revisionId,
                    projectId: currentProject.meta.id,
                    workspaceId: options.principal.activeWorkspaceId,
                    revisionNumber: index + 1,
                    historyKey: seed.historyKey,
                    nameSnapshot: seed.project.meta.name,
                    systemPrompt: seed.project.systemPrompt,
                    messagesJson: serializeMessages(seed.project.messages),
                    apiConfigJson: serializeApiConfig(seed.project.apiConfig),
                    contentHash: computeProjectContentHash({
                        name: seed.project.meta.name,
                        systemPrompt: seed.project.systemPrompt,
                        messages: seed.project.messages,
                        apiConfig: seed.project.apiConfig,
                    }),
                    operationType: 'migrate',
                    sourceRevisionId: previousRevisionId,
                    createdBy: options.principal.userId,
                    createdAt: seed.createdAt,
                    legacySourcePath: seed.legacySourcePath,
                };

                previousRevisionId = revision.id;
                return revision;
            });

            const projectRow: ProjectRow = {
                id: currentProject.meta.id,
                workspaceId: options.principal.activeWorkspaceId,
                name: currentProject.meta.name,
                systemPrompt: currentProject.systemPrompt,
                defaultCredentialId: null,
                currentRevisionId,
                createdBy: options.principal.userId,
                updatedBy: options.principal.userId,
                createdAt:
                    parseIsoTimestamp(currentProject.meta.createdAt) ??
                    historySeeds[0]?.createdAt ??
                    currentSeed.createdAt,
                updatedAt: currentSeed.createdAt,
                deletedAt: null,
                rowVersion: Math.max(revisions.length, 1),
            };

            options.database.client.transaction(() => {
                options.repository.createProjectWithRevisions({
                    project: projectRow,
                    revisions,
                });
            })();

            summary.importedProjects += 1;
            summary.importedRevisions += revisions.length;
        } catch {
            summary.failedProjects.push(projectId);
        }
    }

    return summary;
}

function readProjectFile(filePath: string): ProjectData {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ProjectData;
}

function buildLegacyRevisionId(projectId: string, revisionNumber: number): string {
    return `${projectId}-legacy-r${revisionNumber}`;
}
