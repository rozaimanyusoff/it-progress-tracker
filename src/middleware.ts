export { default } from 'next-auth/middleware'

export const config = {
  matcher: ['/dashboard/:path*', '/manager/:path*', '/projects/:path*', '/issues/:path*', '/admin/:path*', '/logs/:path*', '/export/:path*'],
}
