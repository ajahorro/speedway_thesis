/**
 * paymentUtils.js
 * Centralized source of truth for calculating booking and payment statuses.
 */

export const calculatePaymentStatus = (booking) => {
  const payments = booking.payments || [];
  const totalAmount = Number(booking.total_amount || 0);
  
  const totalPaid = payments
    .filter(p => p.status === 'PAID')
    .reduce((sum, p) => sum + Number(p.amount), 0);
    
  const isPendingVerification = payments.some(p => p.status === 'FOR_VERIFICATION');
  const requiredDownpayment = calculateRequiredDownpayment(totalAmount).amount;
  
  if (totalAmount <= 0) return 'UNPAID';
  
  if (totalPaid >= totalAmount) {
    return 'PAID';
  } else if (isPendingVerification) {
    return 'VERIFYING';
  } else if (totalPaid >= requiredDownpayment) {
    return 'DOWNPAYMENT_PAID';
  }
  
  return 'UNPAID';
};

export const requiresDownpayment = (totalAmount) => Number(totalAmount || 0) >= 1000;

export const calculateRequiredDownpayment = (totalAmount) => {
  const total = Number(totalAmount || 0);
  const percentage = total >= 2000 ? 50 : 30;
  return {
    percentage,
    amount: Math.round(total * (percentage / 100) * 100) / 100
  };
};

export const getRequiredDownpayment = (totalAmount) => calculateRequiredDownpayment(totalAmount).amount;

export const getPaymentStatusUI = (status) => {
  switch (status) {
    case 'PAID': 
      return { label: 'FULLY PAID', color: '#10b981' };
    case 'VERIFYING': 
      return { label: 'VERIFYING', color: '#8b5cf6' };
    case 'DOWNPAYMENT_PAID': 
      return { label: 'DOWNPAYMENT', color: '#3b82f6' };
    default: 
      return { label: 'UNPAID', color: '#ef4444' };
  }
};
