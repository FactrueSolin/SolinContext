import { NextResponse } from 'next/server';
import { ProjectStore } from '../../../../lib/project-store';
import { generateId } from '../../../../lib/utils';

// POST /api/projects/[id]/duplicate - 复制项目
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const originalProject = await ProjectStore.getProject(id);

        const now = new Date().toISOString();
        const newId = generateId();

        // 深拷贝项目数据，更新 meta 信息
        const duplicatedProject = {
            ...originalProject,
            meta: {
                ...originalProject.meta,
                id: newId,
                name: `${originalProject.meta.name} (副本)`,
                createdAt: now,
                updatedAt: now,
            },
        };

        await ProjectStore.saveProject(duplicatedProject);
        return NextResponse.json(duplicatedProject.meta);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
