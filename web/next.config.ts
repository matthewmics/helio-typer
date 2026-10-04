import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["heliotyper.local"],
  // @heliotyper/engine is a workspace package that resolves, through a symlink,
  // to a real path outside this project directory. Without listing it here Next
  // will not follow that out of the app root and the import fails to resolve.
  transpilePackages: ["@heliotyper/engine"],
};

export default nextConfig;
