export type DocLink = {
  href: string;
  label: string;
  description?: string;
};

export type DocSection = {
  title: string;
  links: DocLink[];
};

export const docNav: DocSection[] = [
  {
    title: "Getting started",
    links: [
      { href: "/docs", label: "Overview", description: "What Test Manager is and how to navigate the docs." },
      { href: "/docs/quickstart", label: "Quickstart", description: "Sign up, create a project, and run your first test." },
      { href: "/docs/concepts", label: "Core concepts", description: "Plans, suites, cases, runs, and bugs in one mental model." },
    ],
  },
  {
    title: "Test management",
    links: [
      { href: "/docs/projects", label: "Projects & members" },
      { href: "/docs/test-plans", label: "Test plans & suites" },
      { href: "/docs/test-cases", label: "Test cases" },
      { href: "/docs/test-runs", label: "Test runs & evidence" },
      { href: "/docs/bugs", label: "Bugs & attachments" },
    ],
  },
  {
    title: "AI & agents",
    links: [
      { href: "/docs/ai-workspace", label: "AI workspace" },
      { href: "/docs/agents", label: "Building an agent" },
      { href: "/docs/agent-tokens", label: "Agent tokens & RBAC" },
    ],
  },
  {
    title: "Platform",
    links: [
      { href: "/docs/api", label: "API reference" },
      { href: "/docs/licensing", label: "Licensing & quotas" },
    ],
  },
];

export function flattenDocLinks(): DocLink[] {
  return docNav.flatMap((section) => section.links);
}
