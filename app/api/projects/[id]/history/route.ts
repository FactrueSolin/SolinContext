import { NextResponse } from 'next/server';
import { ProjectStore } from '../../../../lib/project-store';

// GET /api/projects/[id]/history - 列出历史版本
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const history = await ProjectStore.listHistory(id);
        return NextResponse.json(history);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
