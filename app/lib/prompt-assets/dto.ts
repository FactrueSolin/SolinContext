export type PromptAssetStatus = 'active' | 'archived';
export type PromptAssetOperationType = 'create' | 'update' | 'restore' | 'import';

export interface PromptAssetSummary {
    id: string;
    name: string;
    description: string;
    status: PromptAssetStatus;
    currentVersionNumber: number;
    createdAt: number;
    updatedAt: number;
    archivedAt: number | null;
}

export interface PromptAssetCurrentVersion {
    id: string;
    versionNumber: number;
    content: string;
    changeNote: string | null;
    operationType: PromptAssetOperationType;
    sourceVersionId: string | null;
    createdAt: number;
}

export interface PromptAssetDetail extends PromptAssetSummary {
    currentVersion: PromptAssetCurrentVersion;
}

export interface PromptAssetVersionItem {
    id: string;
    assetId: string;
    versionNumber: number;
    nameSnapshot: string;
    descriptionSnapshot: string;
    content: string;
    changeNote: string | null;
    operationType: PromptAssetOperationType;
    sourceVersionId: string | null;
    createdAt: number;
}

export interface Pagination {
    page: number;
    pageSize: number;
    total: number;
}

export interface PaginatedData<T> {
    items: T[];
    pagination: Pagination;
}
