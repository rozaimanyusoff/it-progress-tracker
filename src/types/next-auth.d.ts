import 'next-auth'
import { JWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      role: 'manager' | 'member'
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: 'manager' | 'member'
  }
}
