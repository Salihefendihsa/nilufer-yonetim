/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker imajını küçük tutmak için (bkz. web/Dockerfile) — yalnızca
  // çalışma zamanında ihtiyaç duyulan dosyaları .next/standalone altına toplar.
  output: "standalone",
};

export default nextConfig;
