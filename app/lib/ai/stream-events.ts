const encoder = new TextEncoder();

export interface SseFrame {
    event?: string;
    data?: string;
}

export function encodeSseFrame(frame: SseFrame): Uint8Array {
    const lines: string[] = [];

    if (frame.event) {
        lines.push(`event: ${frame.event}`);
    }

    const data = frame.data ?? '';
    const dataLines = data.split('\n');

    for (const line of dataLines) {
        lines.push(`data: ${line}`);
    }

    lines.push('');
    lines.push('');

    return encoder.encode(lines.join('\n'));
}

export function encodeJsonSseEvent(event: string, payload: unknown): Uint8Array {
    return encodeSseFrame({
        event,
        data: JSON.stringify(payload),
    });
}

function normalizeLine(rawLine: string): string {
    return rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
}

function flushFrame(eventName: string | undefined, dataLines: string[]): SseFrame | null {
    if (!eventName && dataLines.length === 0) {
        return null;
    }

    return {
        event: eventName,
        data: dataLines.join('\n'),
    };
}

export async function* iterateSseFrames(
    stream: ReadableStream<Uint8Array>
): AsyncGenerator<SseFrame> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventName: string | undefined;
    let dataLines: string[] = [];

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const rawLine of lines) {
                const line = normalizeLine(rawLine);

                if (line === '') {
                    const frame = flushFrame(eventName, dataLines);
                    if (frame) {
                        yield frame;
                    }
                    eventName = undefined;
                    dataLines = [];
                    continue;
                }

                if (line.startsWith(':')) {
                    continue;
                }

                if (line.startsWith('event:')) {
                    eventName = line.slice(6).trim();
                    continue;
                }

                if (line.startsWith('data:')) {
                    dataLines.push(line.slice(5).trimStart());
                }
            }
        }

        buffer += decoder.decode();
        if (buffer.length > 0) {
            const line = normalizeLine(buffer);

            if (line.startsWith('event:')) {
                eventName = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).trimStart());
            }
        }

        const trailingFrame = flushFrame(eventName, dataLines);
        if (trailingFrame) {
            yield trailingFrame;
        }
    } finally {
        reader.releaseLock();
    }
}
