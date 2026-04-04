/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  // When UPLOAD_DIR is set (production), files live outside public/.
  // Rewrite /uploads/* → /api/files/* so the authenticated file-serving route
  // reads from UPLOAD_DIR instead of the (empty) public/uploads folder.
  async rewrites() {
    if (!process.env.UPLOAD_DIR) return []
    return [
      {
        source: '/uploads/:path*',
        destination: '/api/files/:path*',
      },
    ]
  },
}
module.exports = nextConfig
