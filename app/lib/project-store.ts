import fs from 'fs/promises';
import path from 'path';
import { ProjectData, ProjectMeta, HistoryEntry } from '../types';

const DATA_DIR = path.join(process.cwd(), 'data');

// 确保目录存在
async function ensureDir(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
}

// 获取项目目录路径
function getProjectDir(projectId: string): string {
    return path.join(DATA_DIR, projectId);
}

// 获取项目数据文件路径
function getProjectFile(projectId: string): string {
    return path.join(getProjectDir(projectId), 'project.json');
}

// 获取历史目录路径
function getHistoryDir(projectId: string): string {
    return path.join(getProjectDir(projectId), 'history');
}

export class ProjectStore {
    // 列出所有项目的元数据
    static async listProjects(): Promise<ProjectMeta[]> {
        await ensureDir(DATA_DIR);
        const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
        const metas: ProjectMeta[] = [];

        for (const entry of entries) {
            if (entry.isDirectory()) {
                try {
                    const data = await ProjectStore.getProject(entry.name);
                    metas.push(data.meta);
                } catch {
                    // 跳过无效项目目录
                }
            }
        }

        return metas.sort((a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
    }

    // 获取单个项目完整数据
    static async getProject(projectId: string): Promise<ProjectData> {
        const filePath = getProjectFile(projectId);
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content) as ProjectData;
    }

    // 保存项目（自动创建历史快照）
    static async saveProject(project: ProjectData): Promise<void> {
        const projectDir = getProjectDir(project.meta.id);
        const historyDir = getHistoryDir(project.meta.id);
        await ensureDir(projectDir);
        await ensureDir(historyDir);

        // 尝试保存历史快照（如果已有旧数据）
        const projectFile = getProjectFile(project.meta.id);
        try {
            const oldContent = await fs.readFile(projectFile, 'utf-8');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const historyFile = path.join(historyDir, `${timestamp}.json`);
            await fs.writeFile(historyFile, oldContent, 'utf-8');
        } catch {
            // 新项目，没有旧数据，跳过
        }

        // 更新时间戳并保存
        project.meta.updatedAt = new Date().toISOString();
        await fs.writeFile(projectFile, JSON.stringify(project, null, 2), 'utf-8');
    }

    // 删除项目
    static async deleteProject(projectId: string): Promise<void> {
        const projectDir = getProjectDir(projectId);
        await fs.rm(projectDir, { recursive: true, force: true });
    }

    // 列出项目历史记录
    static async listHistory(projectId: string): Promise<HistoryEntry[]> {
        const historyDir = getHistoryDir(projectId);
        await ensureDir(historyDir);

        const files = await fs.readdir(historyDir);
        return files
            .filter(f => f.endsWith('.json'))
            .map(filename => ({
                filename,
                timestamp: filename.replace('.json', '').replace(/-/g, (m, offset) => {
                    // 恢复ISO格式的时间戳用于显示
                    if (offset === 10) return 'T';
                    if (offset === 13 || offset === 16) return ':';
                    if (offset === 19) return '.';
                    return m;
                }),
            }))
            .sort((a, b) => b.filename.localeCompare(a.filename));
    }

    // 获取历史版本数据
    static async getHistoryEntry(projectId: string, filename: string): Promise<ProjectData> {
        const filePath = path.join(getHistoryDir(projectId), filename);
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content) as ProjectData;
    }
}
