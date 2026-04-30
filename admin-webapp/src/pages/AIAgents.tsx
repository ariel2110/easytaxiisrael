import { useState, useEffect, useRef } from 'react'
import { api } from '../services/api'
import type { AIAgent, AIChatHistory } from '../types'

interface Message { role: 'user' | 'assistant'; content: string; model?: string }

export default function AIAgents() {
  const [agents, setAgents] = useState<AIAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AIAgent | null>(null)
  const [model, setModel] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [editKey, setEditKey] = useState<{ id: string; value: string } | null>(null)
  const [savingKey, setSavingKey] = useState(false)
  const [keyMsg, setKeyMsg] = useState('')
  const [tab, setTab] = useState<'chat' | 'history'>('chat')
  const [history, setHistory] = useState<AIChatHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  async function load() {
    setLoading(true)
    try {
      const data = await api.aiAgents.list()
      setAgents(data)
    } catch { /* ignore */ }
    setLoading(false)
  }

  function selectAgent(ag: AIAgent) {
    setSelected(ag)
    setModel(ag.default_model)
    setMessages([])
    setInput('')
    setEditKey(null)
    setTab('chat')
    setHistory([])
  }

  async function loadHistory(agentId: string) {
    setHistoryLoading(true)
    try {
      const data = await api.aiAgents.history(agentId)
      setHistory(data)
    } catch { setHistory([]) }
    setHistoryLoading(false)
  }

  function switchTab(t: 'chat' | 'history') {
    setTab(t)
    if (t === 'history' && selected) loadHistory(selected.id)
  }

  async function sendMessage() {
    if (!selected || !input.trim() || sending) return
    const userMsg: Message = { role: 'user', content: input.trim() }
    setMessages(m => [...m, userMsg])
    setInput('')
    setSending(true)
    try {
      const res = await api.aiAgents.chat(selected.id, input.trim(), model)
      setMessages(m => [...m, { role: 'assistant', content: res.reply, model: res.model }])
    } catch (e: any) {
      setMessages(m => [...m, { role: 'assistant', content: `❌ שגיאה: ${e.message}` }])
    }
    setSending(false)
  }

  async function disableAgent(agentId: string) {
    if (!confirm('לכבות את הסוכן?')) return
    try {
      await api.aiAgents.disable(agentId)
      await load()
      if (selected?.id === agentId) setSelected(null)
      setKeyMsg('הסוכן כובה')
    } catch (e: any) { setKeyMsg(`שגיאה: ${e.message}`) }
  }

  async function saveKey() {
    if (!editKey || !editKey.value.trim()) return
    setSavingKey(true)
    setKeyMsg('')
    try {
      const res = await api.aiAgents.updateKey(editKey.id, editKey.value.trim())
      await load()
      setEditKey(null)
      setKeyMsg(`✅ נשמר: ${res.key_masked}`)
    } catch (e: any) { setKeyMsg(`❌ ${e.message}`) }
    setSavingKey(false)
  }

  return (
    <div style={{ display: 'flex', gap: '1.5rem', height: 'calc(100vh - 80px)' }}>
      {/* Sidebar: agents list */}
      <div style={{
        width: '240px', flexShrink: 0,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '0.9rem' }}>
          🤖 סוכני AI
        </div>
        {loading ? (
          <div style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>טוען...</div>
        ) : agents.map(ag => (
          <div
            key={ag.id}
            onClick={() => selectAgent(ag)}
            style={{
              padding: '0.75rem 1rem',
              cursor: 'pointer',
              background: selected?.id === ag.id ? 'rgba(255,215,0,0.08)' : 'transparent',
              borderRight: selected?.id === ag.id ? '3px solid var(--accent)' : '3px solid transparent',
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              transition: 'background 0.15s',
            }}
          >
            <span style={{ fontSize: '1.3rem' }}>{ag.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ag.name}</div>
              <div style={{
                fontSize: '0.7rem',
                color: ag.enabled ? '#4ade80' : 'var(--text-secondary)',
                marginTop: '0.15rem',
              }}>
                {ag.enabled ? '● פעיל' : '○ מושבת'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
        {!selected ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px',
            color: 'var(--text-secondary)', fontSize: '0.9rem',
          }}>
            בחר סוכן AI מהרשימה משמאל
          </div>
        ) : (
          <>
            {/* Agent header */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '1rem',
              display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: '2rem' }}>{selected.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selected.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  {selected.enabled ? `🔑 ${selected.key_masked}` : '⚠️ API key לא מוגדר'}
                </div>
              </div>

              {/* Model selector */}
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                style={{
                  background: 'var(--background)', border: '1px solid var(--border)',
                  borderRadius: '6px', padding: '0.4rem 0.6rem', color: 'inherit',
                  fontSize: '0.8rem',
                }}
              >
                {selected.models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>

              {/* Key management */}
              <button
                className="btn btn-ghost"
                style={{ fontSize: '0.78rem' }}
                onClick={() => setEditKey({ id: selected.id, value: '' })}
              >
                🔑 עדכן key
              </button>
              {selected.enabled && (
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: '0.78rem', color: '#f87171' }}
                  onClick={() => disableAgent(selected.id)}
                >
                  ⏻ כבה
                </button>
              )}
            </div>

            {/* Key editor modal */}
            {editKey && editKey.id === selected.id && (
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--accent)',
                borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem',
              }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>עדכון API Key — {selected.name}</div>
                <input
                  type="password"
                  placeholder="הדבק API key חדש..."
                  value={editKey.value}
                  onChange={e => setEditKey({ ...editKey, value: e.target.value })}
                  style={{
                    background: 'var(--background)', border: '1px solid var(--border)',
                    borderRadius: '6px', padding: '0.5rem 0.75rem', color: 'inherit',
                    fontSize: '0.85rem', width: '100%',
                  }}
                />
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button className="btn btn-primary" style={{ fontSize: '0.8rem' }}
                    onClick={saveKey} disabled={savingKey || !editKey.value.trim()}>
                    {savingKey ? 'שומר...' : '💾 שמור'}
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }}
                    onClick={() => { setEditKey(null); setKeyMsg('') }}>
                    ביטול
                  </button>
                  {keyMsg && <span style={{ fontSize: '0.8rem', color: keyMsg.startsWith('✅') ? '#4ade80' : '#f87171' }}>{keyMsg}</span>}
                </div>
              </div>
            )}
            {keyMsg && !editKey && (
              <div style={{ fontSize: '0.82rem', color: keyMsg.startsWith('✅') ? '#4ade80' : '#f87171', padding: '0 0.25rem' }}>{keyMsg}</div>
            )}

            {/* Chat area */}
            <div style={{
              flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}>
              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                {(['chat', 'history'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => switchTab(t)}
                    style={{
                      padding: '0.65rem 1.25rem', fontSize: '0.82rem', fontWeight: 600,
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: tab === t ? 'var(--accent)' : 'var(--text-secondary)',
                      borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                    }}
                  >
                    {t === 'chat' ? '💬 שיחה' : '🕐 היסטוריה'}
                  </button>
                ))}
              </div>

              {tab === 'chat' ? (
                <>
                  {/* Messages */}
                  <div
                    ref={chatRef}
                    style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                  >
                    {messages.length === 0 && (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', marginTop: '2rem' }}>
                        {selected.enabled ? `שלח הודעה ל-${selected.name}` : `⚠️ נדרש API key כדי לשוחח עם ${selected.name}`}
                      </div>
                    )}
                    {messages.map((msg, i) => (
                      <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                        <div style={{
                          background: msg.role === 'user' ? 'var(--accent)' : 'var(--background)',
                          color: msg.role === 'user' ? '#000' : 'inherit',
                          border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                          borderRadius: '12px', padding: '0.65rem 0.9rem',
                          fontSize: '0.875rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>
                          {msg.content}
                        </div>
                        {msg.model && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '0.2rem', padding: '0 0.25rem' }}>
                            {msg.model}
                          </div>
                        )}
                      </div>
                    ))}
                    {sending && (
                      <div style={{ alignSelf: 'flex-start' }}>
                        <div style={{
                          background: 'var(--background)', border: '1px solid var(--border)',
                          borderRadius: '12px', padding: '0.65rem 0.9rem', fontSize: '0.875rem',
                          color: 'var(--text-secondary)',
                        }}>
                          מחשב...
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Input */}
                  <div style={{
                    padding: '0.75rem 1rem', borderTop: '1px solid var(--border)',
                    display: 'flex', gap: '0.5rem', alignItems: 'flex-end',
                  }}>
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                      placeholder={selected.enabled ? 'כתוב הודעה... (Enter לשלוח)' : 'נדרש API key'}
                      disabled={!selected.enabled || sending}
                      rows={2}
                      style={{
                        flex: 1, background: 'var(--background)', border: '1px solid var(--border)',
                        borderRadius: '8px', padding: '0.5rem 0.75rem', color: 'inherit',
                        fontSize: '0.875rem', resize: 'none', lineHeight: 1.4,
                      }}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={sendMessage}
                      disabled={!selected.enabled || !input.trim() || sending}
                      style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', flexShrink: 0 }}
                    >
                      שלח
                    </button>
                  </div>
                </>
              ) : (
                /* History tab */
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {historyLoading ? (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', marginTop: '2rem' }}>טוען...</div>
                  ) : history.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', marginTop: '2rem' }}>אין היסטוריה עדיין</div>
                  ) : history.map(entry => (
                    <div key={entry.id} style={{
                      background: 'var(--background)', border: '1px solid var(--border)',
                      borderRadius: '10px', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          {new Date(entry.timestamp).toLocaleString('he-IL')}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'var(--surface)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                          {entry.model}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.82rem' }}>
                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>שאלה: </span>
                        <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{entry.message}</span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        <span style={{ fontWeight: 600 }}>תשובה: </span>
                        <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{entry.reply}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
