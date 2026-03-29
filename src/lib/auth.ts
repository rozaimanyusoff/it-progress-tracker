import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })
        if (!user) return null
        if (!user.is_active) return null
        if (!user.password_hash) return null
        const valid = await bcrypt.compare(credentials.password, user.password_hash)
        if (!valid) return null
        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub
        ;(session.user as any).role = token.role
      }
      return session
    },
  },
  events: {
    async signIn({ user }) {
      if (!user?.id) return
      await prisma.auditLog.create({
        data: {
          user_id: Number(user.id),
          action: 'LOGIN',
          target_type: 'User',
          target_id: Number(user.id),
          metadata: { email: user.email },
        },
      }).catch(() => {})
    },
    async signOut({ token }) {
      if (!token?.sub) return
      await prisma.auditLog.create({
        data: {
          user_id: Number(token.sub),
          action: 'LOGOUT',
          target_type: 'User',
          target_id: Number(token.sub),
        },
      }).catch(() => {})
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
}
