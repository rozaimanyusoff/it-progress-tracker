import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: {
    signIn: '/login',
  },
})

export const config = {
  matcher: ['/dashboard/:path*', '/manager/:path*', '/projects/:path*', '/issues/:path*', '/admin/:path*', '/logs/:path*', '/export/:path*'],
}
