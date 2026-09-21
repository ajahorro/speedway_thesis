import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ExternalLink, Info, Calendar, Star, Megaphone, Bell } from 'lucide-react';
import toast from 'react-hot-toast';

const TYPE_ICONS = {
  ANNOUNCEMENT: Megaphone,
  BOOKING_CREATED: Calendar,
  BOOKING_UPDATED: Calendar,
  BOOKING_CONFIRMED: Calendar,
  BOOKING_CANCELLED: Calendar,
  PAYMENT_SUBMITTED: Star,
  PAYMENT_VERIFIED: Star,
  default: Info,
};

const getIcon = (type) => TYPE_ICONS[type] || TYPE_ICONS.default;

const NotificationDetailsModal = ({ notification, onClose, onMarkRead, profile }) => {
  const navigate = useNavigate();
  if (!notification) return null;
  const Icon = getIcon(notification.notification_type);

  // Determine correct role prefix for routing
  const role = profile?.role?.toUpperCase();
  const rolePrefix = role === 'ADMIN' ? '/admin' : role === 'STAFF' ? '/staff' : '/customer';

  const handleViewBooking = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    const bookingTarget = notification.booking_id || notification.message?.match(/#([A-Za-z0-9_-]{8})/)?.[1];
    if (bookingTarget) {
      const targetUrl = `${rolePrefix}/bookings/${bookingTarget}${notification.notification_type === 'MESSAGE_RECEIVED' || notification.title?.toLowerCase().includes('new message') ? '?chat=open' : ''}`;
      onClose();
      navigate(targetUrl);
    } else {
      toast.error('Associated booking record not found.');
    }
  };

  // Helper to highlight and parse booking references inside the message text
  const renderFormattedMessage = (message) => {
    if (!message) return '';
    const parts = message.split(/(#[A-Za-z0-9_-]+)/g);
    const hasBookingReference = parts.some(part => /^#[A-Za-z0-9_-]+$/.test(part));
    return parts.map((part, index) => {
      if (part.startsWith('#')) {
        if (notification.booking_id || hasBookingReference) {
          return (
            <span
              key={index}
              onClick={(e) => handleViewBooking(e)}
              style={{
                color: 'var(--admin-brand)',
                fontWeight: '950',
                cursor: 'pointer',
                textDecoration: 'underline',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px'
              }}
              title="Click to view booking details"
            >
              {part} <ExternalLink size={12} />
            </span>
          );
        }
        // If there is no associated booking, return as plain text with slight highlight
        return (
          <span key={index} style={{ color: 'var(--admin-brand)', fontWeight: '950' }}>
            {part}
          </span>
        );
      }
      return part;
    }).concat(notification.booking_id && !hasBookingReference ? [
      <span key="booking-reference" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.35rem' }}>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          onClick={handleViewBooking}
          style={{ background: 'none', border: 'none', padding: 0, color: 'var(--admin-brand)', fontWeight: '950', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
        >
          #{String(notification.booking_id).slice(0, 8).toUpperCase()}
          <ExternalLink size={12} style={{ verticalAlign: 'middle', marginLeft: '0.2rem' }} />
        </button>
      </span>
    ] : []);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999999,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem'
    }} onClick={onClose}>
      <div style={{
        background: 'var(--admin-card)',
        border: '1px solid var(--admin-border)',
        borderRadius: 'var(--admin-radius)',
        padding: '2rem',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        position: 'relative'
      }} onClick={e => e.stopPropagation()}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'rgba(var(--admin-brand-rgb), 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <Icon size={20} color="var(--admin-brand)" />
          </div>
          <div>
            <span style={{ fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-brand)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {notification.notification_type || 'SYSTEM'}
            </span>
            <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-secondary)', fontWeight: '600' }}>
              {new Date(notification.created_at).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Title */}
        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.15rem', fontWeight: '950', color: 'white', textTransform: 'uppercase' }}>
          {notification.title || 'Notification Details'}
        </h3>

        {/* Full Elaboration Message with Clickable Booking IDs */}
        <div style={{
          background: 'var(--admin-bg)',
          border: '1px solid var(--admin-border)',
          borderRadius: 'var(--admin-radius-sm)',
          padding: '1rem',
          marginBottom: '1.5rem',
          fontSize: '0.9rem',
          color: 'var(--admin-text-primary)',
          lineHeight: 1.6,
          fontWeight: '600',
          wordBreak: 'break-word'
        }}>
          {renderFormattedMessage(notification.message)}
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {(notification.booking_id || notification.message?.match(/#[A-Za-z0-9_-]{8}/)) && (
            <button
              onClick={handleViewBooking}
              style={{ padding: '0.75rem 1.25rem', background: 'var(--admin-brand)', border: 'none', borderRadius: 'var(--admin-radius-sm)', color: 'white', fontWeight: '950', fontSize: '0.75rem', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              View Booking <ExternalLink size={14} />
            </button>
          )}
          {!notification.is_read && onMarkRead && (
            <button
              onClick={() => { onMarkRead(notification.id); }}
              style={{ padding: '0.75rem 1.25rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', color: 'var(--admin-text-primary)', fontWeight: '950', fontSize: '0.75rem', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Mark as Read
            </button>
          )}
          <button
            onClick={onClose}
            style={{ padding: '0.75rem 1.5rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', color: 'var(--admin-text-primary)', fontWeight: '950', fontSize: '0.75rem', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationDetailsModal;
