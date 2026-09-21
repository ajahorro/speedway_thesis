import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { useGlobalChat } from '../context/ChatContext';
import { useAuth } from '../hooks/useAuth';
import BookingChat from './BookingChat';

const FloatingBubbleChat = () => {
  const {
    isOpen,
    activeBookingId,
    globalUnreadCount,
    closeChat,
    openChatForBooking
  } = useGlobalChat();
  const { user } = useAuth();
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ pointerId: null, startX: 0, startY: 0, originX: 0, originY: 0, moved: false });
  const chatRef = useRef(null);
  const bubbleRef = useRef(null);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDownOutside = (event) => {
      const clickedInsideChat = chatRef.current?.contains(event.target);
      const clickedBubble = bubbleRef.current?.contains(event.target);

      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }

      if (!clickedInsideChat && !clickedBubble) {
        closeTimerRef.current = setTimeout(() => {
          closeChat();
        }, 120);
      }
    };

    document.addEventListener('mousedown', handlePointerDownOutside);
    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, [isOpen, closeChat]);

  if (!user?.id) return null;

  const handlePointerDown = (event) => {
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
      moved: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (event) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    const nextX = dragRef.current.originX + event.clientX - dragRef.current.startX;
    const nextY = dragRef.current.originY + event.clientY - dragRef.current.startY;
    if (Math.abs(event.clientX - dragRef.current.startX) > 5 || Math.abs(event.clientY - dragRef.current.startY) > 5) {
      dragRef.current.moved = true;
    }
    setOffset({ x: nextX, y: nextY });
  };

  const handlePointerUp = (event) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsDragging(false);

    if (!dragRef.current.moved) {
      if (isOpen) {
        closeChat();
      } else if (activeBookingId) {
        openChatForBooking(activeBookingId);
      }
    }

    dragRef.current.pointerId = null;
  };

  return (
    <div style={{ position: 'fixed', right: '1.25rem', bottom: '1.25rem', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', transform: `translate(${offset.x}px, ${offset.y}px)`, touchAction: 'none' }}>
      {isOpen && activeBookingId && (
        <div ref={chatRef} style={{ width: 'clamp(300px, 90vw, 420px)', height: 'clamp(400px, 78vh, 620px)', marginBottom: '0.75rem', background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius)', boxShadow: '0 20px 50px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--admin-brand)', color: '#fff' }}>
            <span style={{ fontWeight: '900', fontSize: '0.8rem' }}>Booking #{activeBookingId.slice(0, 8).toUpperCase()}</span>
            <button onClick={closeChat} aria-label="Close support chat" style={{ background: 'none', border: 0, color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}><BookingChat bookingId={activeBookingId} /></div>
        </div>
      )}

      {isOpen && !activeBookingId && (
        <div style={{ width: 'clamp(280px, 85vw, 360px)', marginBottom: '0.75rem', padding: '1.25rem', background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius)', boxShadow: '0 20px 50px rgba(0,0,0,0.25)', color: 'var(--admin-text-secondary)', fontSize: '0.8rem', fontWeight: '700' }}>
          Open a booking to start a support conversation.
        </div>
      )}

      <button
        ref={bubbleRef}
        type="button"
        aria-label={isOpen ? 'Support chat open' : 'Open support chat'}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ width: '58px', height: '58px', border: 'none', borderRadius: '50%', background: 'var(--admin-brand)', color: '#fff', display: 'grid', placeItems: 'center', cursor: isDragging ? 'grabbing' : 'grab', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', position: 'relative' }}
      >
        <MessageCircle size={26} />
        {globalUnreadCount > 0 && !isOpen && <span style={{ position: 'absolute', top: '-4px', left: '-4px', minWidth: '21px', height: '21px', padding: '0 4px', borderRadius: '999px', background: '#ef4444', color: '#fff', border: '2px solid var(--admin-bg)', display: 'grid', placeItems: 'center', fontSize: '0.65rem', fontWeight: '900' }}>{globalUnreadCount > 99 ? '99+' : globalUnreadCount}</span>}
      </button>
    </div>
  );
};

export default FloatingBubbleChat;
