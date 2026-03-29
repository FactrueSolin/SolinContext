'use client';

import React, { useState, useRef, useCallback } from 'react';
import { DocumentBlock, DocumentSource, Base64PDFSource, PlainTextSource, URLPDFSource } from '../../types';

interface DocumentBlockEditorProps {
    block: DocumentBlock;
    onUpdate: (block: DocumentBlock) => void;
}

type DocumentSourceType = 'base64' | 'text' | 'url';

const ACCEPT_STRING = 'application/pdf';

const inputClass = "p-2 border border-[var(--input-border)] rounded-[var(--radius-sm)] text-sm bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-400/20 focus:border-indigo-400 transition-all duration-[var(--transition-fast)]";
const selectClass = "p-2 border border-[var(--input-border)] rounded-[var(--radius-sm)] text-sm bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-400/20 focus:border-indigo-400 transition-all duration-[var(--transition-fast)]";
const textareaNoMonoClass = "w-full p-2.5 border border-[var(--input-border)] rounded-[var(--radius-sm)] resize-y min-h-[80px] text-sm bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-400/20 focus:border-indigo-400 transition-all duration-[var(--transition-fast)]";
const labelClass = "text-[11px] font-medium text-[var(--muted-foreground)]";

/** 将字节数格式化为人类可读的文件大小 */
function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 从 data URL 中提取纯 base64 数据 */
function extractBase64FromDataURL(dataURL: string): string {
    const base64Index = dataURL.indexOf(',');
    if (base64Index === -1) return dataURL;
    return dataURL.substring(base64Index + 1);
}

export default function DocumentBlockEditor({ block, onUpdate }: DocumentBlockEditorProps) {
    const sourceType: DocumentSourceType = block.source.type;
    const [isDragOver, setIsDragOver] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 存储已上传文件的元信息（用于显示，不持久化到 block 数据中）
    const [uploadedFileInfo, setUploadedFileInfo] = useState<{ name: string; size: number } | null>(null);

    const handleSourceTypeChange = (newType: DocumentSourceType) => {
        if (newType === sourceType) return;

        let newSource: DocumentSource;
        switch (newType) {
            case 'base64':
                newSource = { type: 'base64', media_type: 'application/pdf', data: '' } satisfies Base64PDFSource;
                break;
            case 'text':
                newSource = { type: 'text', media_type: 'text/plain', data: '' } satisfies PlainTextSource;
                break;
            case 'url':
                newSource = { type: 'url', url: '' } satisfies URLPDFSource;
                break;
        }
        onUpdate({ ...block, source: newSource });
    };

    /** 处理文件选择/拖拽的通用逻辑 */
    const processFile = useCallback((file: File) => {
        setErrorMessage(null);

        // 验证文件类型
        if (file.type !== 'application/pdf') {
            setErrorMessage(`不支持的文件类型: ${file.type || '未知'}。仅支持 PDF 格式`);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataURL = e.target?.result as string;
            const base64Data = extractBase64FromDataURL(dataURL);
            onUpdate({
                ...block,
                source: { type: 'base64', media_type: 'application/pdf', data: base64Data } satisfies Base64PDFSource,
            });
            setUploadedFileInfo({ name: file.name, size: file.size });
        };
        reader.onerror = () => {
            setErrorMessage('文件读取失败，请重试');
        };
        reader.readAsDataURL(file);
    }, [block, onUpdate]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            processFile(files[0]);
        }
    }, [processFile]);

    const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            processFile(files[0]);
        }
        // 重置 input 以便再次选择同一文件
        e.target.value = '';
    }, [processFile]);

    const handleClearFile = useCallback(() => {
        onUpdate({
            ...block,
            source: { type: 'base64', media_type: 'application/pdf', data: '' } satisfies Base64PDFSource,
        });
        setUploadedFileInfo(null);
        setErrorMessage(null);
    }, [block, onUpdate]);

    const base64Source = sourceType === 'base64' ? (block.source as Base64PDFSource) : null;
    const hasBase64Data = base64Source && base64Source.data.length > 0;

    return (
        <div className="flex flex-col gap-3 bg-indigo-50/40 dark:bg-indigo-900/10 p-3 rounded-[var(--radius-md)] border border-indigo-200/60 dark:border-indigo-800/30">
            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Document</span>

            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                    <label className={labelClass}>Title</label>
                    <input
                        type="text"
                        className={inputClass}
                        value={block.title ?? ''}
                        onChange={(e) => onUpdate({ ...block, title: e.target.value || undefined })}
                        placeholder="文档标题（可选）"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className={labelClass}>Context</label>
                    <input
                        type="text"
                        className={inputClass}
                        value={block.context ?? ''}
                        onChange={(e) => onUpdate({ ...block, context: e.target.value || undefined })}
                        placeholder="上下文说明（可选）"
                    />
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Source Type</label>
                <select
                    className={selectClass}
                    value={sourceType}
                    onChange={(e) => handleSourceTypeChange(e.target.value as DocumentSourceType)}
                >
                    <option value="url">URL (PDF)</option>
                    <option value="base64">Base64 (PDF)</option>
                    <option value="text">Plain Text</option>
                </select>
            </div>

            {sourceType === 'url' && (
                <div className="flex flex-col gap-1.5">
                    <label className={labelClass}>URL</label>
                    <input
                        type="text"
                        className={inputClass}
                        value={(block.source as URLPDFSource).url}
                        onChange={(e) => onUpdate({
                            ...block,
                            source: { type: 'url', url: e.target.value } satisfies URLPDFSource,
                        })}
                        placeholder="https://example.com/document.pdf"
                    />
                </div>
            )}

            {sourceType === 'base64' && (
                <>
                    {!hasBase64Data ? (
                        <div
                            className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-[var(--radius-md)] cursor-pointer transition-colors duration-200 ${
                                isDragOver
                                    ? 'border-indigo-400 bg-indigo-100/60 dark:bg-indigo-900/20'
                                    : 'border-[var(--input-border)] hover:border-indigo-300 hover:bg-indigo-50/60 dark:hover:bg-indigo-900/10'
                            }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    fileInputRef.current?.click();
                                }
                            }}
                        >
                            <svg className="w-8 h-8 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-sm text-[var(--muted-foreground)]">
                                拖拽 PDF 文件到此处，或点击选择文件
                            </span>
                            <span className="text-xs text-[var(--muted-foreground)] opacity-60">
                                支持 PDF 格式
                            </span>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept={ACCEPT_STRING}
                                onChange={handleFileInputChange}
                                className="hidden"
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 p-3 border border-[var(--input-border)] rounded-[var(--radius-md)] bg-[var(--input-bg)]">
                            {/* 文件信息 */}
                            <div className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                                <span className="text-lg">📄</span>
                                {uploadedFileInfo && (
                                    <>
                                        <span className="truncate max-w-[200px]" title={uploadedFileInfo.name}>{uploadedFileInfo.name}</span>
                                        <span className="text-[var(--muted-foreground)]">|</span>
                                        <span className="text-[var(--muted-foreground)]">{formatFileSize(uploadedFileInfo.size)}</span>
                                    </>
                                )}
                                {!uploadedFileInfo && (
                                    <span className="text-[var(--muted-foreground)]">已加载 PDF 数据</span>
                                )}
                            </div>
                            {/* 清除按钮 */}
                            <button
                                type="button"
                                onClick={handleClearFile}
                                className="self-start text-xs px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--input-border)] text-[var(--muted-foreground)] hover:text-red-500 hover:border-red-300 transition-colors duration-200"
                            >
                                清除
                            </button>
                        </div>
                    )}

                    {errorMessage && (
                        <div className="text-xs text-red-500 px-1">
                            {errorMessage}
                        </div>
                    )}
                </>
            )}

            {sourceType === 'text' && (
                <div className="flex flex-col gap-1.5">
                    <label className={labelClass}>Text Content</label>
                    <textarea
                        className={textareaNoMonoClass}
                        value={(block.source as PlainTextSource).data}
                        onChange={(e) => onUpdate({
                            ...block,
                            source: { type: 'text', media_type: 'text/plain', data: e.target.value } satisfies PlainTextSource,
                        })}
                        placeholder="纯文本内容..."
                    />
                </div>
            )}
        </div>
    );
}
