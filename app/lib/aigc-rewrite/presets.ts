export interface AigcRewritePresetSummary {
    id: string;
    name: string;
    description: string;
    recommendedUsage: string;
}

interface AigcRewritePresetDefinition extends AigcRewritePresetSummary {
    sampleBefore: string;
    sampleAfter: string;
}

const presetDefinitions: AigcRewritePresetDefinition[] = [
    {
        id: 'academic-physics-paper',
        name: '学术论文综述风格',
        description: '适合课程论文、综述类章节和正式书面表达，直接体验“原文先自改，再按该习惯继续改写”的流程。',
        recommendedUsage: '待改写文本的篇幅尽量和示例样本接近，通常更容易得到稳定结果。',
        sampleBefore: String.raw`<info>

\subsection{研究背景与意义}

近年来，大规模语言模型在通用问答、代码生成和知识推理等任务上持续突破，教育场景中的智能助教与自动解题应用也随之升温。对于大学物理而言，题目往往同时包含文字叙述、数学公式、符号推导与数值计算，任务难点不只是“给出答案”，更在于能否完成\textbf{条件提取、公式选择、过程推演和规范表达}。这使物理解题成为检验模型领域适配能力与可解释性的重要场景。

然而，通用大模型主要基于开放域语料进行预训练，对教材版式、章节习题和标准化解题链的适配仍然有限。若训练数据质量不足、推理过程缺乏约束，模型即使偶尔得到正确结果，也难以在教学环境中稳定复用。因此，围绕\textbf{高质量数据构建、结构化推理监督与参数高效微调}展开综述，不仅能够为本研究的技术路线提供依据，也有助于说明大模型在中文物理解题场景中的现实边界与改进方向。

\subsection{国内外研究现状}

现有研究已经在文档解析、模型能力提升和训练效率优化等方面形成较为清晰的技术积累。数据层面，MinerU 等工具提升了复杂 PDF 的版面恢复与公式提取能力，为从教材和题库中抽取结构化样本提供了基础\cite{wang2024mineruopensourcesolutionprecise}；模型层面，Qwen、DeepSeek 等开源模型持续增强中文理解与推理表现，使领域微调具备了更高起点\cite{yang2025qwen3technicalreport,deepseekai2025deepseekv3technicalreport}；训练层面，QLoRA 等参数高效方法显著降低了大模型适配门槛，使有限显存下完成十亿级以上模型微调成为可能\cite{dettmers2023qloraefficientfinetuningquantized}。

但从已有成果看，相关工作仍以通用推理、数学问答或开放域指令任务为主，直接面向\textbf{中文物理教材题目}的系统研究仍不充分。一方面，物理题的难点在于题面解析、符号含义和推导链条必须同时成立；另一方面，传统评测往往更关注最终答案，对中间步骤的可靠性刻画不足\cite{cobbe2021trainingverifierssolvemath}。这意味着现有方法虽然提供了可借鉴的工具和范式，但如何把\textbf{教材解析、教师生成、基座微调与领域评估}连接为一条稳定链路，仍值得进一步梳理。

\subsection{研究目标与主要内容}

</info>`,
        sampleAfter: String.raw`<info>

\subsection{研究背景}

最近几年，大规模语言模型在简单问答、代码生成和复杂逻辑推理等文本生成任务上取得突破，教育场景中智能助教应用以及对自动解题软件开发也随之升温。对大学物理而言，题目同时包含文字叙述、数学公式、符号推导与数值计算，任务难点不只是“给出答案”，而在于能否完成\textbf{条件提取、公式选择、过程推演和规范表达}。这决定了模型解答物理问题时可解释性。

但通用大模型基于开放域语料进行预训练，对教材版式、章节习题和标准化解题链适配仍然有限。存在训练数据质量不足、推理过程缺乏约束，模型即使能得到正确结果，也难以在教学环境中稳定复用。所以，围绕\textbf{高质量数据构建、结构化推理监督与参数高效微调}展开论文综合讨论，可以为本研究的技术路线提供依据，也可以说明大模型在中文物理解题场景中的应用场景。

\subsection{研究现状}

现有研究已经在文档解析、模型能力提升和训练效率优化方面形成有成效的技术积累。数据层面，MinerU 等OCR提取工具提供了复杂 PDF 的版面提取与公式提取能力，为从教材和题库中提取结构化样本提供了技术基础\cite{wang2024mineruopensourcesolutionprecise}；在模型层面，Qwen、DeepSeek 等开源模型持续的性能提前，增加了中文理解与推理表现，使领域微调有了更高起点\cite{yang2025qwen3technicalreport,deepseekai2025deepseekv3technicalreport}；训练层面，QLoRA 等高效微调方法降低了大模型本地训练的门槛，让在有限显存下完成十亿级以上模型微调成为可能\cite{dettmers2023qloraefficientfinetuningquantized}。

从已有结果看，相关工作仍以复杂逻辑推理、数学问答或指令任务为主，直接面向\textbf{中文物理教材题目}的人工智能研究仍不充分。物理题的解答的难点核心在于题面解析、符号含义和推导链条必须同时成立；另一方面，传统评测往往仅关注最终答案，对中间步骤可靠性把握不足\cite{cobbe2021trainingverifierssolvemath}。这意味着现有方法虽然提供了可借鉴的工具和方法，但如何把\textbf{教材解析、教师生成、基座微调与领域评估}制作成一整套解决问题的方法，仍值得进一步讨论。

\subsection{研究的主要内容}

</info>`,
    },
];

export function listAigcRewritePresetSummaries(): AigcRewritePresetSummary[] {
    return presetDefinitions.map(({ id, name, description, recommendedUsage }) => ({
        id,
        name,
        description,
        recommendedUsage,
    }));
}

export function getAigcRewritePresetById(id: string): AigcRewritePresetDefinition | null {
    return presetDefinitions.find((preset) => preset.id === id) ?? null;
}

