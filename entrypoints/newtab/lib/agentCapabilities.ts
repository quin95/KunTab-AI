import type { AgentCapability } from '../models';

export interface AgentCapabilitySpec {
  id: AgentCapability;
  label: string;
  trigger: string;
  behavior: string;
  output: string;
}

export const AGENT_CAPABILITIES: Record<AgentCapability, AgentCapabilitySpec> = {
  generalChat: {
    id: 'generalChat',
    label: '普通对话',
    trigger: '普通问答、计划建议、文本整理、解释概念，或任何不需要操作 KunTab 本地数据的请求。',
    behavior: '直接自然语言回答，不调用本地执行能力。',
    output: '不要输出 JSON 能力代码块。',
  },
  bookmark: {
    id: 'bookmark',
    label: 'Chrome 书签',
    trigger: '用户明确要整理、移动、清理、查重、总结或推荐 Chrome 原生书签。',
    behavior: '只操作 Chrome 书签上下文，所有写操作必须先给预览卡片。',
    output: '使用旧版 json-bookmark-* 代码块，保持兼容。',
  },
  siteNavigation: {
    id: 'siteNavigation',
    label: 'KunTab 网址导航',
    trigger: '用户明确要推荐网站到网址导航，或粘贴一批网站让你规划一级/二级分类。',
    behavior: '只操作 KunTab 独立网址导航，不写入 Chrome 书签；优先复用现有分类。',
    output: '使用统一 json-agent-action 代码块，capability=siteNavigation，action=planAddSites。',
  },
};

export function serializeAgentCapabilityRegistry(): string {
  return Object.values(AGENT_CAPABILITIES)
    .map((capability, index) =>
      [
        `${index + 1}. ${capability.id}（${capability.label}）`,
        `   - 触发：${capability.trigger}`,
        `   - 行为：${capability.behavior}`,
        `   - 输出：${capability.output}`,
      ].join('\n'),
    )
    .join('\n');
}
