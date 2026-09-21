import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeBookingId, setActiveBookingId] = useState(null);
  const [globalUnreadCount, setGlobalUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!user?.id) {
      setGlobalUnreadCount(0);
      return;
    }

    let unreadQuery = supabase
      .from('booking_messages')
      .select('id', { count: 'exact', head: true })
      .neq('message_type', 'system')
      .eq('is_read', false)
      .neq('sender_id', user.id);

    if (activeBookingId) unreadQuery = unreadQuery.neq('booking_id', activeBookingId);

    const { count, error } = await unreadQuery;

    if (!error) setGlobalUnreadCount(count || 0);
  }, [user?.id, activeBookingId]);

  useEffect(() => {
    if (!user?.id) {
      setGlobalUnreadCount(0);
      setActiveBookingId(null);
      setIsOpen(false);
      return undefined;
    }

    refreshUnreadCount();

    const channel = supabase
      .channel(`global-chat-unread-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'booking_messages'
      }, (payload) => {
        if (payload.new.message_type === 'system') return;
        if (payload.new.sender_id !== user.id && !payload.new.is_read && payload.new.booking_id !== activeBookingId) {
          setGlobalUnreadCount(previous => previous + 1);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'booking_messages'
      }, (payload) => {
        if (payload.new.is_read) refreshUnreadCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, activeBookingId, refreshUnreadCount]);

  const openChatForBooking = (bookingId) => {
    if (!bookingId) return;
    setActiveBookingId(bookingId);
    setIsOpen(true);
  };

  const closeChat = () => {
    setIsOpen(false);
    refreshUnreadCount();
  };

  return (
    <ChatContext.Provider value={{
      isOpen,
      activeBookingId,
      globalUnreadCount,
      setGlobalUnreadCount,
      refreshUnreadCount,
      setActiveBookingId,
      openChatForBooking,
      closeChat
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useGlobalChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useGlobalChat must be used within a ChatProvider');
  return context;
};
