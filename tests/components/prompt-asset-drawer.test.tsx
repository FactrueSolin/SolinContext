import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PromptAssetDetail, PromptAssetSummary } from '../../app/lib/prompt-assets/dto';
import PromptAssetDrawer from '../../app/components/PromptAssetDrawer';
import { PromptAssetApiError } from '../../app/lib/prompt-assets/client';

const {
    mockRouter,
    mockEditor,
    clientMocks,
    MockPromptAssetApiError,
} = vi.hoisted(() => {
    class MockPromptAssetApiError extends Error {
        readonly status: number;
        readonly code: string;
        readonly details: unknown;

        constructor(status: number, code: string, message: string, details: unknown = null) {
            super(message);
            this.name = 'PromptAssetApiError';
            this.status = status;
            this.code = code;
            this.details = details;
        }
    }

    return {
        mockRouter: {
            push: vi.fn(),
            replace: vi.fn(),
        },
        mockEditor: {
            state: {
                currentProject: null,
            },
            setPromptAssetNotice: vi.fn(),
            updateSystemPrompt: vi.fn(),
        },
        clientMocks: {
            listPromptAssets: vi.fn(),
            getPromptAssetDetail: vi.fn(),
            createPromptAsset: vi.fn(),
            createPromptAssetVersion: vi.fn(),
            listPromptAssetVersions: vi.fn(),
            restorePromptAssetVersion: vi.fn(),
            archivePromptAsset: vi.fn(),
            unarchivePromptAsset: vi.fn(),
        },
        MockPromptAssetApiError,
    };
});

vi.mock('next/navigation', () => ({
    useRouter: () => mockRouter,
}));

vi.mock('next/link', () => ({
    default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

vi.mock('../../app/contexts/EditorContext', () => ({
    useEditor: () => mockEditor,
}));

vi.mock('../../app/lib/prompt-assets/client', () => ({
    listPromptAssets: clientMocks.listPromptAssets,
    getPromptAssetDetail: clientMocks.getPromptAssetDetail,
    createPromptAsset: clientMocks.createPromptAsset,
    createPromptAssetVersion: clientMocks.createPromptAssetVersion,
    listPromptAssetVersions: clientMocks.listPromptAssetVersions,
    restorePromptAssetVersion: clientMocks.restorePromptAssetVersion,
    archivePromptAsset: clientMocks.archivePromptAsset,
    unarchivePromptAsset: clientMocks.unarchivePromptAsset,
    PromptAssetApiError: MockPromptAssetApiError,
}));

function createSummary(overrides: Partial<PromptAssetSummary> = {}): PromptAssetSummary {
    const now = Date.now();

    return {
        id: 'asset-1',
        name: '代码评审提示词',
        description: '用于代码审查',
        status: 'active',
        currentVersionNumber: 2,
        createdAt: now - 10_000,
        updatedAt: now - 1_000,
        archivedAt: null,
        ...overrides,
    };
}

function createDetail(overrides: Partial<PromptAssetDetail> = {}): PromptAssetDetail {
    const summary = createSummary(overrides);

    return {
        ...summary,
        currentVersion: {
            id: 'version-2',
            versionNumber: summary.currentVersionNumber,
            content: 'Review this patch.',
            changeNote: '补充输出约束',
            operationType: 'update',
            sourceVersionId: 'version-1',
            createdAt: summary.updatedAt,
        },
        ...overrides,
    };
}

describe('PromptAssetDrawer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockEditor.state.currentProject = {
            meta: {
                id: 'project-1',
                name: '当前项目',
                createdAt: '2026-04-19T00:00:00.000Z',
                updatedAt: '2026-04-19T00:00:00.000Z',
            },
            systemPrompt: 'Current system prompt',
            messages: [],
            apiConfig: {
                baseUrl: 'https://api.anthropic.com',
                apiKey: 'key',
                model: 'claude-sonnet-4-20250514',
            },
        };

        clientMocks.listPromptAssets.mockResolvedValue({
            items: [],
            pagination: { page: 1, pageSize: 50, total: 0 },
        });
    });

    it('loads the asset list, opens detail, and applies the selected asset to the current project', async () => {
        const summary = createSummary();
        const detail = createDetail();

        clientMocks.listPromptAssets.mockResolvedValueOnce({
            items: [summary],
            pagination: { page: 1, pageSize: 50, total: 1 },
        });
        clientMocks.getPromptAssetDetail.mockResolvedValue(detail);

        render(<PromptAssetDrawer />);

        expect(await screen.findByText('代码评审提示词')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /代码评审提示词/i }));

        expect(await screen.findByText('Prompt Preview')).toBeInTheDocument();
        expect(screen.getByText('Review this patch.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '应用到当前 System Prompt' }));
        expect(await screen.findByText('应用到当前项目？')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '确认应用' }));

        expect(mockEditor.updateSystemPrompt).toHaveBeenCalledWith('Review this patch.');
        expect(mockEditor.setPromptAssetNotice).toHaveBeenCalledWith({
            assetName: '代码评审提示词',
            versionLabel: 'v2',
        });
        expect(mockRouter.push).toHaveBeenCalledWith('/');
    });

    it('opens the save modal from entry=save and shows a mapped validation error message', async () => {
        clientMocks.createPromptAsset.mockRejectedValue(
            new PromptAssetApiError(400, 'PROMPT_ASSET_VALIDATION_FAILED', 'Validation failed')
        );

        render(<PromptAssetDrawer entry="save" />);

        expect(await screen.findByText('保存为资产')).toBeInTheDocument();
        expect(mockRouter.replace).toHaveBeenCalledWith('/prompt-assets', { scroll: false });

        fireEvent.change(screen.getByPlaceholderText('例如：代码评审提示词'), {
            target: { value: '新资产' },
        });
        fireEvent.click(screen.getByRole('button', { name: '创建资产' }));

        expect(await screen.findByText('输入不符合校验规则，请检查名称和正文。')).toBeInTheDocument();
        expect(clientMocks.createPromptAsset).toHaveBeenCalledWith({
            name: '新资产',
            description: '',
            content: 'Current system prompt',
            changeNote: undefined,
        });
    });

    it('shows an info toast instead of opening the save modal when the current prompt is empty', async () => {
        mockEditor.state.currentProject = {
            ...mockEditor.state.currentProject,
            systemPrompt: '   ',
        };

        render(<PromptAssetDrawer entry="save" />);

        expect(await screen.findByText('当前项目的 System Prompt 为空，无法保存为资产。')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '创建资产' })).not.toBeInTheDocument();
        expect(mockRouter.replace).toHaveBeenCalledWith('/prompt-assets', { scroll: false });
    });

    it('renders a retry state when the list request fails and retries successfully', async () => {
        clientMocks.listPromptAssets
            .mockRejectedValueOnce(new Error('网络异常'))
            .mockResolvedValueOnce({
                items: [],
                pagination: { page: 1, pageSize: 50, total: 0 },
            });

        render(<PromptAssetDrawer />);

        expect(await screen.findByText('加载失败')).toBeInTheDocument();
        expect(screen.getByText('网络异常')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '重试' }));

        await waitFor(() => {
            expect(clientMocks.listPromptAssets).toHaveBeenCalledTimes(2);
        });
        expect(await screen.findByText('还没有提示词资产')).toBeInTheDocument();
    });

    it('shows a conflict toast and refreshes detail when saving a new version fails', async () => {
        const summary = createSummary();
        const detail = createDetail();

        clientMocks.listPromptAssets.mockResolvedValueOnce({
            items: [summary],
            pagination: { page: 1, pageSize: 50, total: 1 },
        });
        clientMocks.getPromptAssetDetail.mockResolvedValue(detail);
        clientMocks.createPromptAssetVersion.mockRejectedValue(
            new PromptAssetApiError(409, 'PROMPT_ASSET_VERSION_CONFLICT', 'Conflict')
        );

        render(<PromptAssetDrawer />);

        fireEvent.click(await screen.findByRole('button', { name: /代码评审提示词/i }));
        expect(await screen.findByText('Prompt Preview')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '保存为新版本' }));
        expect(await screen.findByText('编辑当前资产')).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText('在这里调整当前版本内容...'), {
            target: { value: 'Review this patch with stricter checks.' },
        });
        fireEvent.click(screen.getByRole('button', { name: '保存为新版本' }));

        expect(await screen.findByText('版本已变化，请刷新后重试。')).toBeInTheDocument();
        await waitFor(() => {
            expect(clientMocks.getPromptAssetDetail).toHaveBeenCalledTimes(2);
        });
    });
});
