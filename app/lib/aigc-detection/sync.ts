import type { AigcDetectionClientLike } from './client';
import type { AigcDetectionRepository, AigcDetectionTaskRow } from './repository';
import { aigcDetectionExternalSyncFailed } from './errors';
import { toAigcDetectionResultDto } from './mapper';

const IN_PROGRESS_EXTERNAL_STATUSES = new Set(['queued', 'preprocessing', 'detecting', 'aggregating']);

export function mapExternalStatusToLocalStatus(externalStatus: string): AigcDetectionTaskRow['status'] {
    if (externalStatus === 'succeeded') {
        return 'succeeded';
    }

    if (externalStatus === 'failed' || externalStatus === 'canceled') {
        return 'failed';
    }

    return 'processing';
}

export async function syncAigcDetectionTask(options: {
    client: AigcDetectionClientLike;
    repository: AigcDetectionRepository;
    task: AigcDetectionTaskRow;
    now: number;
}): Promise<void> {
    if (!options.task.externalTaskId) {
        throw aigcDetectionExternalSyncFailed('AIGC detection task is missing external task id');
    }

    const status = await options.client.getTaskStatus(options.task.externalTaskId);
    const nextLocalStatus = mapExternalStatusToLocalStatus(status.status);
    const baseUpdate = {
        status: nextLocalStatus,
        externalStatus: status.status,
        progressCurrent: status.progress?.current ?? null,
        progressTotal: status.progress?.total ?? null,
        progressUnit: status.progress?.unit ?? null,
        errorCode: status.error?.code ?? null,
        errorMessage: status.error?.message ?? null,
        lastSyncedAt: options.now,
        lastSyncErrorAt: null,
        completedAt: nextLocalStatus === 'failed' ? options.now : null,
        updatedAt: options.now,
        syncingUntil: null,
    } satisfies Parameters<AigcDetectionRepository['updateTask']>[2];

    options.repository.updateTask(options.task.id, options.task.workspaceId, baseUpdate);
    options.repository.appendEvent({
        taskId: options.task.id,
        workspaceId: options.task.workspaceId,
        eventType: 'status_synced',
        fromStatus: options.task.status,
        toStatus: nextLocalStatus,
        payloadJson: JSON.stringify({
            externalStatus: status.status,
            progress: status.progress,
            error: status.error,
        }),
        operatorType: 'system',
        createdAt: options.now,
    });

    if (!IN_PROGRESS_EXTERNAL_STATUSES.has(status.status) && status.status !== 'succeeded') {
        return;
    }

    if (status.status !== 'succeeded') {
        return;
    }

    const result = await options.client.getTaskResult(options.task.externalTaskId);
    const normalizedResult = toAigcDetectionResultDto(result, {
        id: options.task.id,
        createdAt: options.task.createdAt,
        completedAt: options.now,
    });

    options.repository.updateTask(options.task.id, options.task.workspaceId, {
        status: 'succeeded',
        externalStatus: result.status,
        resultOverallScore: normalizedResult.overallScore,
        resultHumanScore: normalizedResult.humanScore,
        resultSummary: normalizedResult.summary,
        resultJson: JSON.stringify(normalizedResult),
        rawResultJson: JSON.stringify(result),
        errorCode: null,
        errorMessage: null,
        completedAt: options.now,
        lastSyncedAt: options.now,
        lastSyncErrorAt: null,
        updatedAt: options.now,
        syncingUntil: null,
    });
    options.repository.appendEvent({
        taskId: options.task.id,
        workspaceId: options.task.workspaceId,
        eventType: 'result_synced',
        fromStatus: nextLocalStatus,
        toStatus: 'succeeded',
        payloadJson: JSON.stringify({
            overallScore: normalizedResult.overallScore,
            summary: normalizedResult.summary,
            segments: normalizedResult.segments.length,
            sentences: normalizedResult.sentences.length,
        }),
        operatorType: 'system',
        createdAt: options.now,
    });
}
