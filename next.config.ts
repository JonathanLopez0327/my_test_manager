import type { NextConfig } from "next";
import path from "node:path";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

const withMDX = createMDX({
  options: {
    // Pass plugins as string module specifiers so Turbopack can serialize them.
    rehypePlugins: [
      ["rehype-slug", {}],
      [
        "rehype-autolink-headings",
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
