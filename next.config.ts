import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 로컬 네트워크 IP로 접속해도 개발 번들/HMR이 차단되지 않도록
  allowedDevOrigins: ["192.168.140.216", "127.0.0.1"],
};

export default nextConfig;
