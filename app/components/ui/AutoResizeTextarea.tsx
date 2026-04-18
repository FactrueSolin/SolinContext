'use client';

import React, { useRef, useLayoutEffect, useCallback } from 'react';

interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    /** 最小高度，默认 80px */
    minHeight?: number;
}

const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
    ({ minHeight = 80, value, className = '', style, ...rest }, forwardedRef) => {
        const internalRef = useRef<HTMLTextAreaElement>(null);
        const previousValueRef = useRef<string>('');

        const setTextareaRef = useCallback((node: HTMLTextAreaElement | null) => {
            internalRef.current = node;

            if (typeof forwardedRef === 'function') {
                forwardedRef(node);
                return;
            }

            if (forwardedRef) {
                forwardedRef.current = node;
            }
        }, [forwardedRef]);

        const adjustHeight = useCallback(() => {
            const textarea = internalRef.current;
            if (!textarea) return;

            const nextValue = typeof value === 'string' ? value : '';
            const previousValue = previousValueRef.current;
            const isShrinking = nextValue.length < previousValue.length;

            if (isShrinking) {
                textarea.style.height = 'auto';
            }

            const nextHeight = Math.max(textarea.scrollHeight, minHeight);
            const currentHeight = Number.parseFloat(textarea.style.height || '0');

            if (isShrinking || nextHeight > currentHeight) {
                textarea.style.height = `${nextHeight}px`;
            }

            previousValueRef.current = nextValue;
        }, [minHeight, value]);

        // 内容变化时调整高度
        useLayoutEffect(() => {
            adjustHeight();
        }, [value, adjustHeight]);

        // 初始渲染时设置高度
        useLayoutEffect(() => {
            adjustHeight();
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        return (
            <textarea
                ref={setTextareaRef}
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
