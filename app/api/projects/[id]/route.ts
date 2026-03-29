import { NextResponse } from 'next/server';
import { ProjectStore } from '../../../lib/project-store';
import { ProjectData } from '../../../types';

// GET /api/projects/[id] - 获取项目详情
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const project = await ProjectStore.getProject(id);
        return NextResponse.json(project);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 404 });
    }
}

// PUT /api/projects/[id] - 更新项目
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json() as ProjectData;
        // 确保ID一致
        body.meta.id = id;
        await ProjectStore.saveProject(body);
        return NextResponse.json(body.meta);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// DELETE /api/projects/[id] - 删除项目
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await ProjectStore.deleteProject(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
