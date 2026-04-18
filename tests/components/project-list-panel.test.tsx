import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Header from '../../app/components/Header';
import ProjectListPanel from '../../app/components/ProjectListPanel';
import { EditorProvider } from '../../app/contexts/EditorContext';

describe('ProjectListPanel', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [],
        }));
    });

    it('can be reopened after closing from the panel header', async () => {
        render(
            <EditorProvider>
                <div className="flex h-screen flex-col">
                    <Header />
                    <div className="relative flex min-h-0 flex-1 overflow-hidden">
                        <ProjectListPanel />
                    </div>
                </div>
            </EditorProvider>
        );

        expect(screen.getByText('项目列表')).toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('关闭项目列表'));
        await waitFor(() => {
            expect(screen.queryByText('项目列表')).not.toBeInTheDocument();
        });

        fireEvent.click(screen.getByLabelText('切换项目列表'));
        expect(await screen.findByText('项目列表')).toBeInTheDocument();
    });
});
