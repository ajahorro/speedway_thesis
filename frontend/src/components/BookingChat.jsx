import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Send, Image as ImageIcon, Bot } from 'lucide-react';

/**
 * BookingChat — Unified real-time chat per booking.
 * Participants: Customer, Admin, Assigned Technician.
 * Supports text messages, image uploads, and system auto-messages.
 */
const BookingChat = ({ bookingId }) => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  // --- FETCH MESSAGES ---
  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('booking_messages')
      .select('*, sender:profiles!booking_messages_sender_id_fkey(first_name, last_name, role)')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true });

    if (!error && data) setMessages(data);
  };

  useEffect(() => {
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
        // Optimistically append new message
        setMessages(prev => [...prev, payload.new]);
        // Then fetch full data to get sender profile
        fetchMessages();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [bookingId]); // eslint-disable-line

  // Auto-scroll to bottom (Strictly for live updates only)
  const prevMsgCount = useRef(0);
  useEffect(() => {
    if (messages.length > prevMsgCount.current) {
      const isInitialFetch = prevMsgCount.current === 0;
      prevMsgCount.current = messages.length;
      if (isInitialFetch) return; // Strictly ignore the first batch of history
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // --- SEND MESSAGE ---
  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.from('booking_messages').insert({
        booking_id: bookingId,
        sender_id: user.id,
        message: newMessage.trim(),
        message_type: 'text'
      });
      if (error) throw error;
      setNewMessage('');
    } catch (err) {
      console.error('Send error:', err);
    } finally {
      setSending(false);
    }
  };

  // --- SEND IMAGE ---
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSending(true);
    try {
      const filePath = `chat/${bookingId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from('chat-attachments').upload(filePath, file);
      
      let imageUrl = filePath;
      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);
        imageUrl = publicUrl;
      }

      await supabase.from('booking_messages').insert({
        booking_id: bookingId,
        sender_id: user.id,
        message: imageUrl,
        message_type: 'image'
      });
    } catch (err) {
      console.error('Image upload error:', err);
    } finally {
      setSending(false);
      if (fileRef.current) fileRef.current.value = '';
    }
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
      <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
            const senderName = msg.sender ? `${msg.sender.first_name}` : 'Unknown';
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
                    style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)', cursor: 'zoom-in', objectFit: 'cover' }}
                    onClick={() => window.open(msg.message, '_blank')}
                  />
                ) : (
                  <div style={{
                    background: isMe ? 'var(--admin-brand)' : 'var(--admin-card)',
                    color: isMe ? '#fff' : 'var(--admin-text-primary)',
                    padding: '0.6rem 1rem',
                    borderRadius: isMe ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
                    maxWidth: '75%',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                    border: isMe ? 'none' : '1px solid var(--admin-border)'
                  }}>
                    {msg.message}
                  </div>
                )}

                {/* Timestamp */}
                <div style={{ fontSize: '0.6rem', fontWeight: '700', color: 'var(--admin-text-secondary)', marginTop: '0.1rem' }}>
                  {timeFormat(msg.created_at)}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--admin-border)', display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--admin-card)' }}>
        <input type="file" ref={fileRef} accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
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
          onClick={handleSend}
          disabled={!newMessage.trim() || sending}
          style={{
            background: newMessage.trim() ? 'var(--admin-brand)' : 'var(--admin-bg)',
            color: newMessage.trim() ? '#fff' : 'var(--admin-text-secondary)',
            border: 'none', borderRadius: '50%',
            width: '36px', height: '36px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s'
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};

export default BookingChat;
