import { NextResponse } from 'next/server';
import { ProjectStore } from '../../lib/project-store';
import { ProjectData } from '../../types';

// GET /api/projects - 列出所有项目
export async function GET() {
    try {
        const projects = await ProjectStore.listProjects();
        return NextResponse.json(projects);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

import { createNewProject } from '../../lib/utils';
import { ApiConfig } from '../../types';

// POST /api/projects - 创建新项目
export async function POST(request: Request) {
    try {
        const body = await request.json() as { name: string; apiConfig?: ApiConfig };

        if (!body || !body.name) {
            return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
        }

        const project = createNewProject(body.name);

        if (body.apiConfig) {
            project.apiConfig = body.apiConfig;
        }

        await ProjectStore.saveProject(project);
        // 返回完整项目数据以供前端使用
        return NextResponse.json(project, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
