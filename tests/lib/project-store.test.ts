import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectStore } from '../../app/lib/project-store';
import { ProjectData } from '../../app/types';
import fs from 'fs/promises';
import path from 'path';

// Mock fs/promises
vi.mock('fs/promises', () => {
    const fileSystem: Record<string, string> = {};

    return {
        default: {
            mkdir: vi.fn(async (dirPath) => {
                // Just mock success
                return undefined;
            }),
            readdir: vi.fn(async (dirPath, options) => {
                const result = Object.keys(fileSystem)
                    .filter(p => p.startsWith(dirPath as string) && p !== dirPath)
                    .map(p => {
                        const relative = p.substring((dirPath as string).length + 1);
                        const parts = relative.split('/');
                        const name = parts[0];
                        return options?.withFileTypes ? {
                            name,
                            isDirectory: () => parts.length > 1
                        } : name;
                    });

                // Deduplicate
                if (options?.withFileTypes) {
                    const names = new Set();
                    return result.filter(r => {
                        if (typeof r === 'string') return false;
                        if (names.has(r.name)) return false;
                        names.add(r.name);
                        return true;
                    });
                }
                return [...new Set(result)];
            }),
            readFile: vi.fn(async (filePath) => {
                if (!fileSystem[filePath as string]) {
                    const error = new Error('File not found') as Error & { code?: string };
                    error.code = 'ENOENT';
                    throw error;
                }
                return fileSystem[filePath as string];
            }),
            writeFile: vi.fn(async (filePath, content) => {
                fileSystem[filePath as string] = content as string;
            }),
            rm: vi.fn(async (dirPath) => {
                Object.keys(fileSystem).forEach(p => {
                    if (p.startsWith(dirPath as string)) {
                        delete fileSystem[p];
                    }
                });
            }),
            __getFileSystem: () => fileSystem,
            __setFileSystem: (newFs: Record<string, string>) => {
                Object.keys(fileSystem).forEach(k => delete fileSystem[k]);
                Object.assign(fileSystem, newFs);
            }
        }
    };
});

// Access the mocked fs for setup/teardown
const mockedFs = fs as unknown as {
    default: {
        __getFileSystem: () => Record<string, string>;
        __setFileSystem: (newFs: Record<string, string>) => void;
    };
    __getFileSystem: () => Record<string, string>;
    __setFileSystem: (newFs: Record<string, string>) => void;
};

describe('ProjectStore', () => {
    const MOCK_PROJECT_ID = 'test-id';
    const MOCK_DATA_DIR = path.join(process.cwd(), 'data');
    const MOCK_PROJECT_FILE = path.join(MOCK_DATA_DIR, MOCK_PROJECT_ID, 'project.json');

    const mockProject: ProjectData = {
        meta: {
            id: MOCK_PROJECT_ID,
            name: 'Test Project',
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z'
        },
        systemPrompt: 'Test prompt',
        messages: [],
        apiConfig: {
            baseUrl: 'http://test',
            apiKey: 'key',
            model: 'model',
            maxTokens: 100
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockedFs.__setFileSystem({});
    });

    describe('saveProject and getProject', () => {
        it('should save a new project', async () => {
            await ProjectStore.saveProject(mockProject);

            const fileSystem = mockedFs.__getFileSystem();
            expect(fileSystem[MOCK_PROJECT_FILE]).toBeDefined();

            const savedProject = JSON.parse(fileSystem[MOCK_PROJECT_FILE]);
            expect(savedProject.meta.id).toBe(MOCK_PROJECT_ID);
            expect(savedProject.systemPrompt).toBe('Test prompt');
        });

        it('should retrieve a saved project', async () => {
            mockedFs.__setFileSystem({
                [MOCK_PROJECT_FILE]: JSON.stringify(mockProject)
            });

            const project = await ProjectStore.getProject(MOCK_PROJECT_ID);
            expect(project).toEqual(mockProject);
        });

        it('should create a history entry when saving an existing project', async () => {
            // First save
            mockedFs.__setFileSystem({
                [MOCK_PROJECT_FILE]: JSON.stringify(mockProject)
            });

            // Update and save again
            const updatedProject = { ...mockProject, systemPrompt: 'Updated prompt' };
            await ProjectStore.saveProject(updatedProject);

            const fileSystem = mockedFs.__getFileSystem();

            // Check that history directory has a file
            const historyFiles = Object.keys(fileSystem).filter(p =>
                p.startsWith(path.join(MOCK_DATA_DIR, MOCK_PROJECT_ID, 'history')) && p.endsWith('.json')
            );

            expect(historyFiles.length).toBe(1);

            // The history file should contain the old content
            const historyContent = JSON.parse(fileSystem[historyFiles[0]]);
            expect(historyContent.systemPrompt).toBe('Test prompt');

            // The main file should contain the new content
            const newContent = JSON.parse(fileSystem[MOCK_PROJECT_FILE]);
            expect(newContent.systemPrompt).toBe('Updated prompt');
        });
    });

    describe('deleteProject', () => {
        it('should delete a project', async () => {
            mockedFs.__setFileSystem({
                [MOCK_PROJECT_FILE]: JSON.stringify(mockProject),
                [path.join(MOCK_DATA_DIR, MOCK_PROJECT_ID, 'history', 'test.json')]: JSON.stringify(mockProject)
            });

            await ProjectStore.deleteProject(MOCK_PROJECT_ID);

            const fileSystem = mockedFs.__getFileSystem();
            expect(Object.keys(fileSystem).length).toBe(0);
        });
    });

    // Note: listProjects and listHistory are hard to mock completely accurately with just a simple object dictionary 
    // because they depend on directory structure listing. The simple mock above covers the basic write/read/delete cases.
});
