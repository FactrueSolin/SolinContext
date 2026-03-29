'use client';

import React, { useState, useRef, useCallback } from 'react';
import { ImageBlock, ImageSource, Base64ImageSource, URLImageSource } from '../../types';

interface ImageBlockEditorProps {
    block: ImageBlock;
    onUpdate: (block: ImageBlock) => void;
}

const SUPPORTED_IMAGE_TYPES: readonly Base64ImageSource['media_type'][] = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
] as const;

const ACCEPT_STRING = SUPPORTED_IMAGE_TYPES.join(',');

const selectClass = "p-2 border border-[var(--input-border)] rounded-[var(--radius-sm)] text-sm bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 transition-all duration-[var(--transition-fast)]";
const inputClass = "p-2 border border-[var(--input-border)] rounded-[var(--radius-sm)] text-sm bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-orange-400/20 focus:border-orange-400 transition-all duration-[var(--transition-fast)]";
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

export default function ImageBlockEditor({ block, onUpdate }: ImageBlockEditorProps) {
    const sourceType = block.source.type;
    const [isDragOver, setIsDragOver] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 存储已上传文件的元信息（用于显示，不持久化到 block 数据中）
    const [uploadedFileInfo, setUploadedFileInfo] = useState<{ name: string; size: number } | null>(null);

    const handleSourceTypeChange = (newType: 'base64' | 'url') => {
        if (newType === sourceType) return;

        let newSource: ImageSource;
        if (newType === 'url') {
            newSource = { type: 'url', url: '' } satisfies URLImageSource;
        } else {
            newSource = { type: 'base64', media_type: 'image/jpeg', data: '' } satisfies Base64ImageSource;
        }
        onUpdate({ ...block, source: newSource });
    };

    const handleUrlChange = (url: string) => {
        onUpdate({ ...block, source: { type: 'url', url } satisfies URLImageSource });
    };

    /** 处理文件选择/拖拽的通用逻辑 */
    const processFile = useCallback((file: File) => {
        setErrorMessage(null);

        // 验证文件类型
        if (!SUPPORTED_IMAGE_TYPES.includes(file.type as Base64ImageSource['media_type'])) {
            setErrorMessage(`不支持的文件类型: ${file.type || '未知'}。支持 JPEG, PNG, GIF, WEBP`);
            return;
        }

        const mediaType = file.type as Base64ImageSource['media_type'];

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataURL = e.target?.result as string;
            const base64Data = extractBase64FromDataURL(dataURL);
            onUpdate({
                ...block,
                source: { type: 'base64', media_type: mediaType, data: base64Data } satisfies Base64ImageSource,
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
            source: { type: 'base64', media_type: 'image/jpeg', data: '' } satisfies Base64ImageSource,
        });
        setUploadedFileInfo(null);
        setErrorMessage(null);
    }, [block, onUpdate]);

    const base64Source = sourceType === 'base64' ? (block.source as Base64ImageSource) : null;
    const hasBase64Data = base64Source && base64Source.data.length > 0;

    return (
        <div className="flex flex-col gap-3 bg-orange-50/40 dark:bg-orange-900/10 p-3 rounded-[var(--radius-md)] border border-orange-200/60 dark:border-orange-800/30">
            <span className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Image</span>

            <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Source Type</label>
                <select
                    className={selectClass}
                    value={sourceType}
                    onChange={(e) => handleSourceTypeChange(e.target.value as 'base64' | 'url')}
                >
                    <option value="url">URL</option>
                    <option value="base64">Base64</option>
                </select>
            </div>

            {sourceType === 'url' && (
                <>
                    <div className="flex flex-col gap-1.5">
                        <label className={labelClass}>URL</label>
                        <input
                            type="text"
                            className={inputClass}
                            value={(block.source as URLImageSource).url}
                            onChange={(e) => handleUrlChange(e.target.value)}
                            placeholder="https://example.com/image.png"
                        />
                    </div>
                    {(block.source as URLImageSource).url && (
                        <div className="flex flex-col gap-1.5">
                            <label className={labelClass}>Preview</label>
                            <img
                                src={(block.source as URLImageSource).url}
                                alt="Preview"
                                className="max-h-40 rounded-[var(--radius-sm)] border border-[var(--border)] object-contain"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        </div>
                    )}
                </>
            )}

            {sourceType === 'base64' && (
                <>
                    {!hasBase64Data ? (
                        <div
                            className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-[var(--radius-md)] cursor-pointer transition-colors duration-200 ${
                                isDragOver
                                    ? 'border-orange-400 bg-orange-100/60 dark:bg-orange-900/20'
                                    : 'border-[var(--input-border)] hover:border-orange-300 hover:bg-orange-50/60 dark:hover:bg-orange-900/10'
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
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm text-[var(--muted-foreground)]">
                                拖拽图片到此处，或点击选择文件
                            </span>
                            <span className="text-xs text-[var(--muted-foreground)] opacity-60">
                                支持 JPEG, PNG, GIF, WEBP
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
                            {/* 图片预览 */}
                            <img
                                src={`data:${base64Source!.media_type};base64,${base64Source!.data}`}
                                alt="Preview"
                                className="max-h-40 rounded-[var(--radius-sm)] border border-[var(--border)] object-contain self-center"
                            />
                            {/* 文件信息 */}
                            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                                {uploadedFileInfo && (
                                    <>
                                        <span className="truncate max-w-[160px]" title={uploadedFileInfo.name}>{uploadedFileInfo.name}</span>
                                        <span>|</span>
                                        <span>{formatFileSize(uploadedFileInfo.size)}</span>
                                        <span>|</span>
                                    </>
                                )}
                                <span>{base64Source!.media_type}</span>
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
        </div>
    );
}
