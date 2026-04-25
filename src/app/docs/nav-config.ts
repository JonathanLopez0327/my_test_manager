import type { Messages } from "@/lib/i18n/messages";

export type DocLink = {
  href: string;
  label: string;
  description?: string;
};

export type DocSection = {
  title: string;
  links: DocLink[];
};

export function getDocNav(messages: Messages): DocSection[] {
  const { sections, links } = messages.docs;

  return [
    {
      title: sections.gettingStarted,
      links: [
        { href: "/docs", label: links.overview.label, description: links.overview.description },
        { href: "/docs/quickstart", label: links.quickstart.label, description: links.quickstart.description },
        { href: "/docs/concepts", label: links.concepts.label, description: links.concepts.description },
      ],
    },
    {
      title: sections.testManagement,
      links: [
        { href: "/docs/projects", label: links.projects.label },
        { href: "/docs/test-plans", label: links.testPlans.label },
        { href: "/docs/test-cases", label: links.testCases.label },
        { href: "/docs/test-runs", label: links.testRuns.label },
        { href: "/docs/bugs", label: links.bugs.label },
      ],
    },
    {
      title: sections.aiAndAgents,
      links: [
        { href: "/docs/ai-workspace", label: links.aiWorkspace.label },
        { href: "/docs/agents", label: links.agents.label },
        { href: "/docs/agent-tokens", label: links.agentTokens.label },
      ],
    },
    {
      title: sections.platform,
      links: [
        { href: "/docs/api", label: links.api.label },
        { href: "/docs/licensing", label: links.licensing.label },
      ],
    },
  ];
}

export function flattenDocLinks(messages: Messages): DocLink[] {
  return getDocNav(messages).flatMap((section) => section.links);
}
