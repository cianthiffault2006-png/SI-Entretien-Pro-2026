/** @type {import('next').NextConfig} */
const nextConfig = {
  // PWA manifest served from public/
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0' }],
      },
    ];
  },
};

module.exports = nextConfig;
