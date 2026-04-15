import type { Metadata } from 'next'
// generateMetadata is used instead of static metadata export
import './globals.css'
import { Providers } from './providers'
import { prisma } from '@/lib/prisma'

export async function generateMetadata(): Promise<Metadata> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: 'brand_name' } })
    const name = row?.value ?? 'IT Progress Tracker'
    return { title: name, description: `${name} — Project progress tracking` }
  } catch {
    return { title: 'IT Progress Tracker', description: 'Track IT section project progress' }
  }
}

const COLOR_VARS: Record<string, string> = {
  blue:    '--p:37 99% 55%;--p-dark:29 78% 44%;--p-light:219 100% 95%;--p-ring:221 83% 53%',
  indigo:  '--p:239 84% 59%;--p-dark:238 76% 50%;--p-light:226 100% 94%;--p-ring:239 84% 59%',
  violet:  '--p:262 83% 58%;--p-dark:263 70% 50%;--p-light:270 100% 95%;--p-ring:262 83% 58%',
  emerald: '--p:160 84% 39%;--p-dark:161 94% 30%;--p-light:152 81% 96%;--p-ring:160 84% 39%',
  rose:    '--p:347 77% 50%;--p-dark:345 83% 41%;--p-light:356 100% 97%;--p-ring:347 77% 50%',
  orange:  '--p:21 90% 48%;--p-dark:17 88% 40%;--p-light:34 100% 97%;--p-ring:21 90% 48%',
  slate:   '--p:215 25% 37%;--p-dark:215 28% 27%;--p-light:210 40% 96%;--p-ring:215 25% 37%',
}

// Hex values for inline styles where hsl vars won't work easily
const COLOR_HEX: Record<string, { bg: string; hover: string }> = {
  blue:    { bg: '#2563eb', hover: '#1d4ed8' },
  indigo:  { bg: '#4f46e5', hover: '#4338ca' },
  violet:  { bg: '#7c3aed', hover: '#6d28d9' },
  emerald: { bg: '#059669', hover: '#047857' },
  rose:    { bg: '#e11d48', hover: '#be123c' },
  orange:  { bg: '#ea580c', hover: '#c2410c' },
  slate:   { bg: '#475569', hover: '#334155' },
}

async function getThemeColor(): Promise<string> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: 'theme_color' } })
    return row?.value ?? 'blue'
  } catch { return 'blue' }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const color = await getThemeColor()
  const vars = COLOR_VARS[color] ?? COLOR_VARS.blue
  const hex = COLOR_HEX[color] ?? COLOR_HEX.blue

  const cssVars = vars.split(';').map(v => v.trim()).filter(Boolean)
    .map(v => { const [k, val] = v.split(':'); return `${k}: hsl(${val});` }).join('\n')

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style>{`:root { ${cssVars} --p-hex: ${hex.bg}; --p-hex-hover: ${hex.hover}; }`}</style>
      </head>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
