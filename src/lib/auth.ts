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
          include: { unit: true },
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
          unit_id: user.unit_id ? String(user.unit_id) : null,
          unit_name: user.unit?.name ?? null,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.unit_id = (user as any).unit_id
        token.unit_name = (user as any).unit_name
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub
        ;(session.user as any).role = token.role
        ;(session.user as any).unit_id = token.unit_id
        ;(session.user as any).unit_name = token.unit_name
      }
      return session
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
}
