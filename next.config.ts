import type { NextConfig } from "next";
import path from "node:path";
import createMDX from "@next/mdx";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

const withMDX = createMDX({
  options: {
    rehypePlugins: [
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          behavior: "append",
          properties: { className: ["docs-anchor"], ariaLabel: "Link to section" },
          content: { type: "text", value: "#" },
        },
      ],
    ],
  },
});

export default withMDX(nextConfig);
