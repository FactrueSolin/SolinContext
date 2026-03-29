'use client';

import React from 'react';
import { ContainerUploadBlock } from '../../types';

interface ContainerUploadBlockEditorProps {
    block: ContainerUploadBlock;
    onUpdate: (block: ContainerUploadBlock) => void;
}

export default function ContainerUploadBlockEditor({ block, onUpdate }: ContainerUploadBlockEditorProps) {
    return (
        <div className="flex flex-col gap-3 bg-slate-50/40 dark:bg-slate-900/10 p-3 rounded-[var(--radius-md)] border border-slate-200/60 dark:border-slate-700/40">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Container Upload</span>

            <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-[var(--muted-foreground)]">File ID</label>
                <input
                    type="text"
                    className="p-2 border border-[var(--input-border)] rounded-[var(--radius-sm)] text-sm bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-slate-400/20 focus:border-slate-400 transition-all duration-[var(--transition-fast)]"
                    value={block.file_id}
                    onChange={(e) => onUpdate({ ...block, file_id: e.target.value })}
                    placeholder="文件ID"
                />
            </div>
        </div>
    );
}
