'use client';

import React, { useRef, useEffect } from 'react';
import { useEditorState } from '../contexts/EditorContext';
import MessageCard from './MessageCard';
import type { EditorMessage, ABCompareGroup } from '../types';

/** 渲染单元：单条消息或 A/B 对比分组 */
type RenderUnit =
    | { type: 'single'; message: EditorMessage; index: number }
    | { type: 'ab_group'; group: ABCompareGroup; indexA: number; indexB: number };

/** 将消息列表按 abGroupId 分组，构建渲染单元列表 */
function buildRenderUnits(messages: EditorMessage[]): RenderUnit[] {
    const units: RenderUnit[] = [];
    const processedIds = new Set<string>();

    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (processedIds.has(msg.id)) continue;

        if (msg.abGroupId) {
            // 找到同组的另一条消息
            const partner = messages.find(
                (m) => m.id !== msg.id && m.abGroupId === msg.abGroupId
            );
            if (partner) {
                const isA = msg.abLabel === 'A';
                const messageA = isA ? msg : partner;
                const messageB = isA ? partner : msg;
                units.push({
                    type: 'ab_group',
                    group: {
                        groupId: msg.abGroupId,
                        messageA,
                        messageB,
                    },
                    indexA: messages.indexOf(messageA),
                    indexB: messages.indexOf(messageB),
                });
                processedIds.add(msg.id);
                processedIds.add(partner.id);
            } else {
                units.push({ type: 'single', message: msg, index: i });
                processedIds.add(msg.id);
            }
        } else {
            units.push({ type: 'single', message: msg, index: i });
            processedIds.add(msg.id);
        }
    }

    return units;
}

function MessageList() {
    const { currentProject } = useEditorState();
    const listEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages are added
    useEffect(() => {
        if (currentProject?.messages && currentProject.messages.length > 0) {
            const timeoutId = setTimeout(() => {
                listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
            return () => clearTimeout(timeoutId);
        }
    }, [currentProject?.messages.length]);

    if (!currentProject) return null;

    const totalCount = currentProject.messages.length;
    const renderUnits = buildRenderUnits(currentProject.messages);

    return (
        <div className="flex flex-col gap-4 py-2">
            {currentProject.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-[var(--muted-foreground)] bg-[var(--muted)]/50 rounded-[var(--radius-lg)] border border-dashed border-[var(--border)]">
                    <p className="mb-1 text-sm font-medium">暂无消息</p>
                    <p className="text-xs">点击下方按钮添加</p>
                </div>
            ) : (
                renderUnits.map((unit) => {
                    if (unit.type === 'ab_group') {
                        return (
                            <div key={unit.group.groupId} className="grid grid-cols-2 gap-3">
                                <MessageCard
                                    key={unit.group.messageA.id}
                                    message={unit.group.messageA}
                                    index={unit.indexA}
                                    totalCount={totalCount}
                                />
                                <MessageCard
                                    key={unit.group.messageB.id}
                                    message={unit.group.messageB}
                                    index={unit.indexB}
                                    totalCount={totalCount}
                                />
                            </div>
                        );
                    }
                    return (
                        <MessageCard
                            key={unit.message.id}
                            message={unit.message}
                            index={unit.index}
                            totalCount={totalCount}
                        />
                    );
                })
            )}
            <div ref={listEndRef} />
        </div>
    );
}

export default React.memo(MessageList);
