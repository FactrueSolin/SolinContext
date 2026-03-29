'use client';

import React, { useRef, useEffect, useCallback } from 'react';

interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    /** 最小高度，默认 80px */
    minHeight?: number;
}

const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
    ({ minHeight = 80, value, className = '', style, ...rest }, forwardedRef) => {
        const internalRef = useRef<HTMLTextAreaElement>(null);
        // 使用 forwardedRef 或 internalRef
        const textareaRef = forwardedRef || internalRef;

        const adjustHeight = useCallback(() => {
            const textarea = 'current' in textareaRef ? textareaRef.current : textareaRef;
            if (!textarea) return;
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.max(textarea.scrollHeight, minHeight)}px`;
        }, [textareaRef, minHeight]);

        // 内容变化时调整高度
        useEffect(() => {
            adjustHeight();
        }, [value, adjustHeight]);

        // 初始渲染时设置高度
        useEffect(() => {
            adjustHeight();
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        return (
            <textarea
                ref={textareaRef}
                value={value}
                className={className}
                style={{
                    ...style,
                    minHeight: `${minHeight}px`,
                    overflow: 'hidden',
                    resize: 'none',
                }}
                {...rest}
            />
        );
    }
);

AutoResizeTextarea.displayName = 'AutoResizeTextarea';

export default AutoResizeTextarea;
