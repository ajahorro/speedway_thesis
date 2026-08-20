import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchCustomerBookings, subscribeToCustomerBookings } from '../services/bookingService';
import { fetchNotifications, subscribeToNotifications } from '../services/notificationService';
import { useAuth } from '../hooks/useAuth';

const UnifiedContext = createContext();

export const UnifiedProvider = ({ children }) => {
    const { user } = useAuth();

    const [bookings, setBookings] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Define loadData using useCallback so it can be safely called from anywhere
    const loadData = useCallback(async () => {
        if (!user) return;
        try {
            const [bookingsData, notificationsData] = await Promise.all([
                fetchCustomerBookings(user.id),
                fetchNotifications(user.id)
            ]);
            setBookings(bookingsData);
            setNotifications(notificationsData);
        } catch (error) {
            console.error('Failed to fetch global data:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!user) {
            setBookings([]);
            setNotifications([]);
            setIsLoading(false);
            return;
        }

        loadData();

        // Real-Time Listeners
        const bookingSub = subscribeToCustomerBookings(user.id, () => {
            fetchCustomerBookings(user.id).then(setBookings);
        });

        const notificationSub = subscribeToNotifications(user.id, () => {
            fetchNotifications(user.id).then(setNotifications);
        });

        return () => {
            if (bookingSub) bookingSub.unsubscribe();
            if (notificationSub) notificationSub.unsubscribe();
        };
    }, [user, loadData]);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <UnifiedContext.Provider value={{
            bookings,
            notifications,
            unreadCount,
            isLoading,
            refreshData: loadData // <-- Exposed here so components can call it!
        }}>
            {children}
        </UnifiedContext.Provider>
    );
};

export const useUnifiedData = () => useContext(UnifiedContext);