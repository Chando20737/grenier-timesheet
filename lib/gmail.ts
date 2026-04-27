import { google } from 'googleapis'

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

export function getAuthUrl(userId: string) {
  const oauth2Client = getOAuthClient()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    prompt: 'consent',
    state: userId,
  })
}

export async function fetchUnreadEmails(accessToken: string, refreshToken: string) {
  const oauth2Client = getOAuthClient()
  oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken })
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  const list = await gmail.users.messages.list({ userId: 'me', q: 'is:unread in:inbox', maxResults: 5 })
  const messages = list.data.messages || []

  return Promise.all(messages.map(async (msg) => {
    const detail = await gmail.users.messages.get({
      userId: 'me', id: msg.id!, format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date']
    })
    const headers = detail.data.payload?.headers || []
    const get = (name: string) => headers.find(h => h.name === name)?.value || ''
    const fromRaw = get('From')
    const fromName = fromRaw.includes('<') ? fromRaw.split('<')[0].trim().replace(/"/g, '') : fromRaw

    return { id: msg.id!, from: fromName, subject: get('Subject'), snippet: detail.data.snippet || '', date: get('Date'), isUnread: true }
  }))
}

export async function fetchTodayEvents(accessToken: string, refreshToken: string) {
  const oauth2Client = getOAuthClient()
  oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken })
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  })

  return (res.data.items || []).map(e => ({
    id: e.id!,
    title: e.summary || 'Réunion',
    start: e.start?.dateTime || e.start?.date || '',
    end:   e.end?.dateTime   || e.end?.date   || '',
  }))
}
