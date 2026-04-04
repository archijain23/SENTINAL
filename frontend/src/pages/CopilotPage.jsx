import { useState, useEffect, useRef } from 'react';
import { aiAPI } from '../services/api';
import styles from './CopilotPage.module.css';

const INTRO = {
  role: 'assistant',
  content: 'Hello. I am SENTINAL Copilot, powered by Gemini AI.\n\nI can help you analyze threats, interpret attack patterns, explain log entries, recommend mitigations, and answer questions about your network security posture.\n\nWhat would you like to investigate?',
  ts: Date.now(),
};

const SUGGESTIONS = [
  'Summarize recent critical threats',
  'What does a SYN flood attack look like?',
  'Recommend firewall rules for port scanning',
  'Explain what SQL injection indicators to watch for',
];

export default function CopilotPage() {
  const [messages, setMessages] = useState([INTRO]);
  const [input,    setInput]    = useState('');
  const [sending,  setSending]  = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const esRef      = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamText]);

  const historyFor = (msgs) =>
    msgs
      .filter(m => m.role !== 'error')
      .map(m => ({ role: m.role, parts: [{ text: m.content }] }));

  const send = async (text) => {
    const msg = text ?? input.trim();
    if (!msg || sending) return;
    setInput('');
    const userMsg = { role: 'user', content: msg, ts: Date.now() };
    const history = historyFor(messages);
    setMessages(prev => [...prev, userMsg]);
    setSending(true);
    setStreaming(true);
    setStreamText('');

    try {
      // Try streaming first
      const es = aiAPI.chatStream(msg, history);
      esRef.current = es;
      let buffer = '';

      es.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);
          buffer += d.text ?? d.content ?? d ?? '';
          setStreamText(buffer);
        } catch {
          buffer += e.data ?? '';
          setStreamText(buffer);
        }
      };

      es.onerror = async () => {
        es.close();
        // Fallback to non-streaming
        try {
          const res = await aiAPI.chat(msg, history);
          const reply = res?.response ?? res?.text ?? res?.content ?? JSON.stringify(res);
          setMessages(prev => [...prev, { role: 'assistant', content: reply, ts: Date.now() }]);
        } catch (err) {
          setMessages(prev => [...prev, { role: 'error', content: 'Error: ' + err.message, ts: Date.now() }]);
        } finally {
          setStreamText('');
          setStreaming(false);
          setSending(false);
        }
      };

      es.addEventListener('done', () => {
        es.close();
        setMessages(prev => [...prev, { role: 'assistant', content: buffer, ts: Date.now() }]);
        setStreamText('');
        setStreaming(false);
        setSending(false);
      });
    } catch (err) {
      setMessages(prev => [...prev, { role: 'error', content: 'Error: ' + err.message, ts: Date.now() }]);
      setStreamText('');
      setStreaming(false);
      setSending(false);
    }

    inputRef.current?.focus();
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const clearChat = () => {
    esRef.current?.close();
    setMessages([INTRO]);
    setStreamText('');
    setStreaming(false);
    setSending(false);
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <div className={styles.avatarDot} />
          <h1 className={styles.title}>SENTINAL Copilot</h1>
          <span className={styles.powered}>Gemini AI</span>
        </div>
        <button className={styles.clearBtn} onClick={clearChat} disabled={messages.length <= 1}>
          Clear chat
        </button>
      </div>

      {/* Messages */}
      <div className={styles.messageArea}>
        {messages.map((m, i) => (
          <div key={i} className={`${styles.message} ${styles['msg_' + m.role]}`}>
            {m.role !== 'user' && (
              <div className={styles.msgAvatar}>
                {m.role === 'assistant' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF3D71" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                )}
              </div>
            )}
            <div className={styles.msgBubble}>
              <pre className={styles.msgText}>{m.content}</pre>
              <span className={styles.msgTime}>{new Date(m.ts).toLocaleTimeString()}</span>
            </div>
          </div>
        ))}

        {/* Streaming bubble */}
        {streaming && (
          <div className={`${styles.message} ${styles.msg_assistant}`}>
            <div className={styles.msgAvatar}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div className={styles.msgBubble}>
              {streamText ? (
                <pre className={styles.msgText}>{streamText}<span className={styles.cursor}>|</span></pre>
              ) : (
                <div className={styles.typingDots}>
                  <span /><span /><span />
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 1 && (
        <div className={styles.suggestions}>
          {SUGGESTIONS.map(s => (
            <button key={s} className={styles.suggestion} onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className={styles.inputRow}>
        <textarea
          ref={inputRef}
          className={styles.input}
          placeholder="Ask about threats, logs, or security policies…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          disabled={sending}
        />
        <button
          className={styles.sendBtn}
          onClick={() => send()}
          disabled={!input.trim() || sending}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
      <p className={styles.hint}>Enter to send · Shift+Enter for newline</p>
    </div>
  );
}
