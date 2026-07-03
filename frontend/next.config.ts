/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ]
  },
}

module.exports = nextConfig
