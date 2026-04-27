import { NextRequest, NextResponse } from 'next/server'
import { sendDailyReport } from '@/lib/report'

// Cette route est appelée automatiquement par Vercel Cron chaque soir à 17h (lun-ven)
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const day = new Date().getDay()
  if (day === 0 || day === 6) {
    return NextResponse.json({ message: 'Week-end, pas de rapport.' })
  }

  await sendDailyReport()
  return NextResponse.json({ message: 'Rapport envoyé.' })
}
