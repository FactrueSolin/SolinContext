import { NextResponse } from 'next/server';
import { ProjectStore } from '../../../../../lib/project-store';

// GET /api/projects/[id]/history/[filename] - 获取历史版本详情
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string; filename: string }> }
) {
    try {
        const { id, filename } = await params;
        const data = await ProjectStore.getHistoryEntry(id, filename);
        return NextResponse.json(data);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 404 });
    }
}
