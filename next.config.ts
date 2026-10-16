import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * 安卓那个壳子（TWA）要靠 /.well-known/assetlinks.json 才能"认自己是这个 App" ✓
   * 但点开头的目录在个别平台上会被忽略 ✗（线上就 404 了 ✓）
   * → 文件放普通位置（public/assetlinks.json ✓ 绝不会被忽略）
   *   再用这条重写把那个地址指过去 ✓ 任何平台都会执行 ✓
   */
  async rewrites() {
    return [{ source: '/.well-known/assetlinks.json', destination: '/assetlinks.json' }]
  },
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
