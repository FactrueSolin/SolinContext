export interface AigcRewritePromptInput {
    sampleBefore: string;
    sampleAfter: string;
    targetText: string;
}

function escapeXmlText(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export function buildAigcRewriteSystemPrompt(input: AigcRewritePromptInput): string {
    return `<system>
  <target>
  你的目标是降低aigc率，所以需要模仿真实大学生的写法
  </target>

  <info>
  你会获得输入的文本，然后你将输出修改后的文本。
  </info>

  <instruct>
  下面是一组用户自己提供的改写样本，你需要学习这种改写方式。

  <example>
    <before>
    ${escapeXmlText(input.sampleBefore)}
    </before>

    <after>
    ${escapeXmlText(input.sampleAfter)}
    </after>
  </example>

  <extra_info>
1. 直接输出修改后的内容。
2. 拒绝回答与改写无关的问题。
</extra_info>

  </instruct>
</system>`;
}

export function buildAigcRewriteUserMessage(targetText: string): string {
    return `<user>
${escapeXmlText(targetText)}
</user>`;
}
