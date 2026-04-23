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

  要求：
  1. 保持原文核心含义不变
  2. 尽量模仿样本中的表达习惯、句式变化和段落组织方式
  3. 不要解释你的思路
  4. 不要输出额外说明
  5. 直接输出改写后的正文
  </instruct>
</system>`;
}

export function buildAigcRewriteUserMessage(targetText: string): string {
    return `<user>
${escapeXmlText(targetText)}
</user>`;
}
