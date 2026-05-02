'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Message = {
  id: string
  subject: string
  from: string
  date: string
  snippet: string
  unread: boolean
}

export default function CourrielsPage() {
  const [user, setUser] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdIds, setCreatedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user)
        loadMessages(data.user.id)
      }
    })
  }, [])

  async function loadMessages(userId: string, pageToken?: string) {
    if (pageToken) setLoadingMore(true)
    else setLoading(true)

    try {
      const url = `/api/gmail/list?userId=${userId}${pageToken ? `&pageToken=${pageToken}` : ''}`
      const res = await fetch(url)

      if (res.status === 401) {
        setError('Compte Google non connecté. Allez dans /calendrier pour connecter.')
        return
      }

      const data = await res.json()
      setMessages(prev => pageToken ? [...prev, ...data.messages] : data.messages)
      setNextPageToken(data.nextPageToken)
      setError(null)
    } catch (e) {
      setError('Erreur lors du chargement des courriels.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  async function createTaskFromEmail(message: Message) {
    if (!user || createdIds.has(message.id)) return

    const { error } = await supabase.from('tasks').insert({
      user_id: user.id,
      description: message.subject,
      source: 'gmail',
      gmail_message_id: message.id,
    })

    if (!error) {
      setCreatedIds(prev => new Set(prev).add(message.id))
    }
  }

  function formatDate(dateStr: string) {
    try {
      const d = new Date(dateStr)
      const now = new Date()
      const isToday = d.toDateString() === now.toDateString()
      if (isToday) {
        return d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })
      }
      return d.toLocaleDateString('fr-CA', { month: 'short', day: 'numeric' })
    } catch {
      return ''
    }
  }

  function formatFrom(from: string) {
    const match = from.match(/^"?([^"<]+)"?\s*<.*>$/)
    return match ? match[1].trim() : from
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Chargement...</div>
  }

  if (error) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#A32D2D' }}>{error}</div>
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 500, marginBottom: 20 }}>Courriels</h1>

      <div style={{ background: '#fff', border: '0.5px solid #e5e5e5', borderRadius: 8, overflow: 'hidden' }}>
        {messages.map(msg => {
          const created = createdIds.has(msg.id)
          return (
            <div
              key={msg.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '180px 1fr 80px 120px',
                gap: 12,
                padding: '12px 16px',
                borderBottom: '0.5px solid #eee',
                alignItems: 'center',
                background: msg.unread ? '#fafbff' : '#fff',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: msg.unread ? 600 : 400, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {formatFrom(msg.from)}
              </div>
              <div style={{ fontSize: 13, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: msg.unread ? 600 : 400 }}>{msg.subject}</span>
                <span style={{ color: '#888', marginLeft: 8 }}>— {msg.snippet}</span>
              </div>
              <div style={{ fontSize: 12, color: '#888', textAlign: 'right' }}>
                {formatDate(msg.date)}
              </div>
              <button
                onClick={() => createTaskFromEmail(msg)}
                disabled={created}
                style={{
                  fontSize: 12,
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '0.5px solid #ddd',
                  background: created ? '#e8f5e9' : '#fff',
                  color: created ? '#2e7d32' : '#333',
                  cursor: created ? 'default' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {created ? '✓ Créée' : 'Créer tâche'}
              </button>
            </div>
          )
        })}
      </div>

      {nextPageToken && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            onClick={() => loadMessages(user.id, nextPageToken)}
            disabled={loadingMore}
            style={{
              padding: '10px 20px',
              borderRadius: 6,
              border: '0.5px solid #ddd',
              background: '#fff',
              cursor: loadingMore ? 'wait' : 'pointer',
            }}
          >
            {loadingMore ? 'Chargement...' : 'Charger plus'}
          </button>
        </div>
      )}
    </div>
  )
}
