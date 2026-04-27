import nodemailer from 'nodemailer'
import { supabaseAdmin } from './supabase'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export async function sendDailyReport() {
  const today = new Date()
  const dateStr = format(today, 'EEEE d MMMM yyyy', { locale: fr })
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
  const endOfDay   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString()

  // Récupérer tous les membres actifs
  const { data: members } = await supabaseAdmin
    .from('organization_members')
    .select('user_id, full_name, email')
    .eq('status', 'actif')

  if (!members?.length) return

  // Récupérer les entrées de temps de la journée pour chaque membre
  let reportRows = ''
  let totalMinutes = 0

  for (const member of members) {
    const { data: entries } = await supabaseAdmin
      .from('time_entries')
      .select('description, duration, started_at, ended_at, category:categories(name)')
      .eq('user_id', member.user_id)
      .gte('started_at', startOfDay)
      .lte('started_at', endOfDay)
      .order('started_at', { ascending: true })

    if (!entries?.length) continue

    const memberTotal = entries.reduce((sum, e) => sum + (e.duration || 0), 0)
    totalMinutes += memberTotal / 60
    const memberH = Math.floor(memberTotal / 3600)
    const memberM = Math.floor((memberTotal % 3600) / 60)

    const taskRows = entries.map(e => {
      const h = Math.floor((e.duration || 0) / 3600)
      const m = Math.floor(((e.duration || 0) % 3600) / 60)
      const start = e.started_at ? format(new Date(e.started_at), 'HH:mm') : '–'
      const end   = e.ended_at   ? format(new Date(e.ended_at),   'HH:mm') : '–'
      return `<tr>
        <td style="padding:6px 12px;font-size:13px;color:#333">${e.description}</td>
        <td style="padding:6px 12px;font-size:13px;color:#777">${(e.category as any)?.name || '–'}</td>
        <td style="padding:6px 12px;font-size:13px;color:#777;white-space:nowrap">${start} → ${end}</td>
        <td style="padding:6px 12px;font-size:13px;font-weight:500;text-align:right">${h}h ${String(m).padStart(2,'0')}</td>
      </tr>`
    }).join('')

    reportRows += `
      <tr style="background:#f9f9f7">
        <td colspan="4" style="padding:10px 12px;font-size:13px;font-weight:500;color:#111;border-top:1px solid #eee">
          ${member.full_name} — Total : ${memberH}h ${String(memberM).padStart(2,'0')}
        </td>
      </tr>
      ${taskRows}`
  }

  const totalH = Math.floor(totalMinutes / 60)
  const totalM = Math.floor(totalMinutes % 60)

  const html = `
    <div style="font-family:'DM Sans',Arial,sans-serif;max-width:680px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee">
      <div style="background:#F2E000;padding:20px 24px;display:flex;align-items:center;gap:12px">
        <div style="width:36px;height:36px;background:#111;border-radius:8px;display:flex;align-items:center;justify-content:center">
          <span style="color:#F2E000;font-size:18px;font-weight:700">G</span>
        </div>
        <div>
          <div style="font-size:16px;font-weight:600;color:#111">Grenier — Rapport journalier</div>
          <div style="font-size:13px;color:#555;margin-top:2px">${dateStr}</div>
        </div>
      </div>
      <div style="padding:20px 24px">
        <div style="display:flex;gap:12px;margin-bottom:20px">
          <div style="flex:1;background:#f9f9f7;border-radius:8px;padding:12px 16px">
            <div style="font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.5px">Total équipe</div>
            <div style="font-size:22px;font-weight:600;color:#111;margin-top:4px">${totalH}h ${String(totalM).padStart(2,'0')}</div>
          </div>
          <div style="flex:1;background:#f9f9f7;border-radius:8px;padding:12px 16px">
            <div style="font-size:11px;color:#777;text-transform:uppercase;letter-spacing:0.5px">Employés actifs</div>
            <div style="font-size:22px;font-weight:600;color:#111;margin-top:4px">${members.length}</div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#f5f4f0">
              <th style="padding:8px 12px;font-size:11px;font-weight:500;color:#777;text-align:left;text-transform:uppercase;letter-spacing:0.5px">Tâche</th>
              <th style="padding:8px 12px;font-size:11px;font-weight:500;color:#777;text-align:left;text-transform:uppercase;letter-spacing:0.5px">Catégorie</th>
              <th style="padding:8px 12px;font-size:11px;font-weight:500;color:#777;text-align:left;text-transform:uppercase;letter-spacing:0.5px">Horaire</th>
              <th style="padding:8px 12px;font-size:11px;font-weight:500;color:#777;text-align:right;text-transform:uppercase;letter-spacing:0.5px">Durée</th>
            </tr>
          </thead>
          <tbody>${reportRows}</tbody>
        </table>
      </div>
      <div style="padding:16px 24px;background:#f9f9f7;border-top:1px solid #eee;font-size:12px;color:#999;text-align:center">
        Rapport généré automatiquement par Grenier Feuilles de temps
      </div>
    </div>`

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  })

  await transporter.sendMail({
    from: '"Grenier Feuilles de temps" <noreply@grenier.qc.ca>',
    to: 'eric@grenier.qc.ca',
    subject: `Rapport journalier — ${dateStr}`,
    html,
  })
}
