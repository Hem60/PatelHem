import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The site reads meridian/pipeline/data at build time. Those files live one
  // level up, so the tracing root has to be the workspace rather than this
  // package — otherwise the include glob escapes the project and is rejected.
  outputFileTracingRoot: join(here, ".."),
  outputFileTracingIncludes: {
    "/**": ["pipeline/data/**"],
  },
};

export default nextConfig;
