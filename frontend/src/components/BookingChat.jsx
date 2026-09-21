import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Send, Image as ImageIcon, Bot, Check, CheckCheck, Loader2, AlertCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { emitEventToMany, EVENTS } from '../services/eventEngine';
import { useGlobalChat } from '../context/ChatContext';

/**
 * BookingChat — Unified real-time chat per booking.
 * Participants: Customer, Admin, Assigned Technician.
 * Supports text messages, image uploads, and system auto-messages.
 */
const BookingChat = ({ bookingId }) => {
  const { user, profile } = useAuth();
  const { refreshUnreadCount } = useGlobalChat();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const chatContainerRef = useRef(null);
  const fileRef = useRef(null);

  // --- FETCH MESSAGES ---
  const markMessagesAsRead = async (messageList) => {
    const unreadIds = messageList
      .filter(message => message.sender_id !== user?.id && !message.is_read)
      .map(message => message.id);
    if (unreadIds.length === 0) {
      await refreshUnreadCount();
      return;
    }

    const { error: readError } = await supabase
      .from('booking_messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in('id', unreadIds);
    if (readError) console.error('Unable to mark chat messages as read:', readError);
    await refreshUnreadCount();
  };

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('booking_messages')
      .select('*, sender:profiles!booking_messages_sender_id_fkey(full_name, first_name, last_name, role)')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      const conversationMessages = data.filter(message => message.message_type !== 'system');
      setMessages(conversationMessages);
      await markMessagesAsRead(conversationMessages);
    }
  };

  useEffect(() => {
    if (!bookingId || !user?.id) return undefined;
    fetchMessages();

    // Real-time subscription
    const channel = supabase
      .channel(`chat-${bookingId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'booking_messages',
        filter: `booking_id=eq.${bookingId}`
      }, (payload) => {
        if (payload.new.message_type === 'system') return;
        // Silently replace optimistic messages or append new DB confirmed ones
        setMessages(prev => {
          const filtered = prev.filter(m => !(m.status === 'sending' && m.message === payload.new.message));
          // Only append if it doesn't already exist (in case fetch Messages already got it)
          if (!filtered.some(m => m.id === payload.new.id)) {
            return [...filtered, payload.new];
          }
          return filtered;
        });
        if (payload.new.sender_id !== user.id) {
          supabase.from('booking_messages').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', payload.new.id).then(async ({ error: readError }) => {
            if (readError) console.error('Unable to mark incoming message as read:', readError);
            else await refreshUnreadCount();
          });
        }
        fetchMessages();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'booking_messages',
        filter: `booking_id=eq.${bookingId}`
      }, (payload) => {
        setMessages(prev => prev.map(message => message.id === payload.new.id ? { ...message, ...payload.new } : message));
      })
      .subscribe((status) => {
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.warn('Chat connection temporarily offline. Reconnecting...');
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [bookingId, user?.id, refreshUnreadCount]);

  // Smart Auto-scroll (REQ-NFR-30)
  const prevMsgCount = useRef(0);
  useEffect(() => {
    if (messages.length === 0) return;
    const container = chatContainerRef.current;
    if (!container) return;

    // Check if user is already near bottom (within 100px)
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

    if (isNearBottom || prevMsgCount.current === 0) {
      container.scrollTo({ top: container.scrollHeight, behavior: prevMsgCount.current === 0 ? 'auto' : 'smooth' });
    } else if (messages.length > prevMsgCount.current) {
      toast('New message received below', { icon: '⬇️', position: 'top-center' });
    }
    prevMsgCount.current = messages.length;
  }, [messages]);

  // --- SEND MESSAGE ---
  const handleSend = async (retryMessage = null) => {
    const textToSend = retryMessage?.message || newMessage.trim();
    if ((!textToSend && !attachment) || sending) return;
    setError('');
    
    const tempId = retryMessage?.id || `temp-${Date.now()}`;
    setSending(true);

    if (!retryMessage) {
      // Optimistically append to state
      const optimisticMsg = {
        id: tempId,
        booking_id: bookingId,
        sender_id: user?.id || profile?.id,
        message: textToSend,
        message_text: textToSend,
        message_type: 'text',
        created_at: new Date().toISOString(),
        status: 'sending',
        sender: profile ? { first_name: profile.first_name, role: profile.role } : null
      };
      setMessages(prev => [...prev, optimisticMsg]);
      setNewMessage('');
    } else {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sending' } : m));
    }

    try {
      const { error } = await supabase.from('booking_messages').insert({
        booking_id: bookingId,
        sender_id: user?.id || profile?.id,
        message: textToSend,
        message_type: 'text',
        is_read: false
      });
      if (error) throw error;
      const { data: booking } = await supabase.from('bookings').select('customer_id').eq('id', bookingId).maybeSingle();
      const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'ADMIN').eq('is_active', true);
      const recipients = [...new Set([
        booking?.customer_id,
        ...(admins || []).map(admin => admin.id)
      ].filter(recipientId => recipientId && recipientId !== (user?.id || profile?.id)))];
      if (recipients.length > 0) {
        await emitEventToMany(EVENTS.MESSAGE_RECEIVED, {
          userIds: recipients,
          bookingId,
          meta: { bookingRef: bookingId.substring(0, 8).toUpperCase(), senderName: profile?.full_name || profile?.first_name || 'A user' }
        });
      }
      toast.success('Message sent securely', { position: 'top-center' });
    } catch (err) {
      console.error('Send error:', {
        code: err?.code,
        status: err?.status,
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        raw: err
      });
      setError(err?.message || 'Failed to send message. Please try again.');
      // Fallback to error state
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
    } finally {
      setSending(false);
    }
  };

  // --- SEND IMAGE ---
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Attachments must be 5MB or smaller.');
      e.target.value = '';
      return;
    }

    setError('');
    setAttachment(file);
    e.target.value = '';
  };

  const handleSendAttachment = async () => {
    if (!attachment || sending) return;
    setSending(true);
    setError('');
    try {
      const safeName = attachment.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `chat/${bookingId}/${Date.now()}_${safeName}`;
      const { error: uploadErr } = await supabase.storage.from('chat_media').upload(filePath, attachment);
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(filePath);
      const { error: insertError } = await supabase.from('booking_messages').insert({
        booking_id: bookingId,
        sender_id: user.id,
        message: publicUrl,
        message_text: publicUrl,
        message_type: attachment.type.startsWith('image/') ? 'image' : 'file',
        is_read: false
      });
      if (insertError) throw insertError;
      const { data: booking } = await supabase.from('bookings').select('customer_id').eq('id', bookingId).maybeSingle();
      const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'ADMIN').eq('is_active', true);
      const recipients = [...new Set([
        booking?.customer_id,
        ...(admins || []).map(admin => admin.id)
      ].filter(recipientId => recipientId && recipientId !== user.id))];
      if (recipients.length > 0) {
        await emitEventToMany(EVENTS.MESSAGE_RECEIVED, {
          userIds: recipients,
          bookingId,
          meta: { bookingRef: bookingId.substring(0, 8).toUpperCase(), senderName: profile?.full_name || profile?.first_name || 'A user' }
        });
      }
      setAttachment(null);
      toast.success('Attachment sent securely', { position: 'top-center' });
    } catch (err) {
      console.error('Image upload error:', err);
      setError('Failed to upload attachment. Please try again.');
    } finally {
      setSending(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (sending || (!newMessage.trim() && !attachment)) return;
    if (newMessage.trim()) await handleSend();
    if (attachment) await handleSendAttachment();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- RENDER HELPERS ---
  const getRoleColor = (role) => {
    switch (role) {
      case 'ADMIN': return '#ef4444';
      case 'STAFF': return '#a855f7';
      case 'CUSTOMER': return 'var(--admin-brand)';
      default: return 'var(--admin-text-secondary)';
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'ADMIN': return 'Admin';
      case 'STAFF': return 'Technician';
      case 'CUSTOMER': return 'Customer';
      default: return 'System';
    }
  };

  const timeFormat = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-md)', overflow: 'hidden' }}>
      
      {/* Message Area */}
      <div ref={chatContainerRef} style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: 0.4 }}>
            <Bot size={32} />
            <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--admin-text-secondary)', textAlign: 'center' }}>
              No messages yet.<br/>Start a conversation about this booking.
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === user?.id;
            const isSystem = msg.message_type === 'system';
            const senderName = msg.sender
              ? msg.sender.full_name || `${msg.sender.first_name || ''} ${msg.sender.last_name || ''}`.trim() || 'Unknown'
              : 'Unknown';
            const senderRole = msg.sender?.role || 'SYSTEM';

            if (isSystem) {
              return (
                <div key={msg.id} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: '700', color: 'var(--admin-text-secondary)', background: 'rgba(var(--admin-brand-rgb), 0.03)', padding: '0.4rem 1rem', borderRadius: '20px', margin: '0.25rem auto', maxWidth: '80%' }}>
                  {msg.message}
                </div>
              );
            }

            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: '0.2rem' }}>
                {/* Sender Label */}
                {!isMe && (
                  <div style={{ fontSize: '0.65rem', fontWeight: '900', color: getRoleColor(senderRole), textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.1rem' }}>
                    {senderName} • {getRoleLabel(senderRole)}
                  </div>
                )}

                {/* Bubble */}
                {msg.message_type === 'image' ? (
                  <img 
                    src={msg.message} 
                    alt="attachment" 
                    style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)', cursor: 'zoom-in', objectFit: 'cover', opacity: msg.status === 'sending' ? 0.6 : 1 }}
                    onClick={() => window.open(msg.message, '_blank')}
                  />
                ) : msg.message_type === 'file' ? (
                  <a href={msg.message} target="_blank" rel="noreferrer" style={{ color: isMe ? '#fff' : 'var(--admin-brand)', fontWeight: '800', textDecoration: 'underline' }}>
                    Open attachment
                  </a>
                ) : (
                  <div style={{
                    background: isSystem ? 'rgba(var(--admin-brand-rgb), 0.05)' : (isMe ? 'var(--admin-brand)' : 'var(--admin-card)'),
                    color: isSystem ? 'var(--admin-text-secondary)' : (isMe ? '#fff' : 'var(--admin-text-primary)'),
                    padding: '0.6rem 1rem',
                    borderRadius: isMe ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
                    maxWidth: '75%',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                    border: isMe ? 'none' : '1px solid var(--admin-border)',
                    opacity: msg.status === 'sending' ? 0.7 : 1
                  }}>
                    {msg.message}
                  </div>
                )}

                {/* Status / Timestamp */}
                <div style={{ fontSize: '0.6rem', fontWeight: '700', color: 'var(--admin-text-secondary)', marginTop: '0.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {msg.status === 'sending' && <span>Sending...</span>}
                  {msg.status === 'failed' && (
                    <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      Failed 
                      <button onClick={() => handleSend(msg)} style={{ background: 'none', border: 'none', color: '#ef4444', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '0.6rem', fontWeight: 'bold' }}>Retry</button>
                    </span>
                  )}
                  {msg.status !== 'sending' && msg.status !== 'failed' && <span>{timeFormat(msg.created_at)}</span>}
                  {isMe && msg.status !== 'sending' && msg.status !== 'failed' && (msg.is_read ? <CheckCheck size={13} color="#34d399" title="Seen" /> : <Check size={13} title="Sent" />)}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div style={{ position: 'relative', padding: '0.75rem 1rem', borderTop: '1px solid var(--admin-border)', display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--admin-card)' }}>
        {error && <div role="alert" style={{ position: 'absolute', transform: 'translateY(-100%)', left: '1rem', right: '1rem', padding: '0.5rem 0.75rem', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', borderRadius: '4px' }}><AlertCircle size={14} /> {error}</div>}
        {attachment && <div style={{ position: 'absolute', transform: 'translateY(-100%)', left: '1rem', right: '1rem', padding: '0.5rem 0.75rem', background: 'var(--admin-card)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-secondary)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span>{attachment.name} ({(attachment.size / 1024 / 1024).toFixed(2)} MB)</span><button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment" style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer' }}><X size={14} /></button></div>}
        <input type="file" ref={fileRef} accept="image/*,.pdf" onChange={handleImageUpload} style={{ display: 'none' }} />
        <button 
          onClick={() => fileRef.current?.click()}
          style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer', padding: '0.25rem' }}
        >
          <ImageIcon size={20} />
        </button>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          style={{
            flex: 1, background: 'var(--admin-bg)', border: '1px solid var(--admin-border)',
            padding: '0.6rem 1rem', borderRadius: '20px', color: 'var(--admin-text-primary)',
            fontSize: '0.85rem', outline: 'none'
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={(!newMessage.trim() && !attachment) || sending}
          style={{
            background: (newMessage.trim() || attachment) ? 'var(--admin-brand)' : 'var(--admin-bg)',
            color: (newMessage.trim() || attachment) ? '#fff' : 'var(--admin-text-secondary)',
            border: 'none', borderRadius: '50%',
            width: '36px', height: '36px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: (newMessage.trim() || attachment) ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s'
          }}
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
};

export default BookingChat;
