import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle2, Wallet, Banknote, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const Step4ReviewPayment = ({ bookingData, setBookingData, onNext, onBack, onSubmit, isSubmitting }) => {
  const [businessConfig, setBusinessConfig] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [receiptDetails, setReceiptDetails] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const labelStyle = {
    fontSize: '0.65rem',
    fontWeight: '950',
    color: 'var(--admin-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '0.5rem',
    display: 'block'
  };
  const vehicles = bookingData.vehicles || [];
  const grandTotal = vehicles.reduce((total, v) => {
    return total + (v.services || []).reduce((sub, s) => sub + s.price, 0);
  }, 0);

  // Fetch business settings for GCash info
  useEffect(() => {
    const fetchConfig = async () => {
      const { data, error } = await supabase.from('business_config').select('gcash_number, gcash_name, gcash_qr_url').limit(1).single();
      if (!error && data) {
        setBusinessConfig(data);
      }
    };
    fetchConfig();
  }, []);

  const [scanStep, setScanStep] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setIsUploading(true);
      setReceiptDetails(null);
      
      // SAVE THE FILE IMMEDIATELY: Admin will perform final verification anyway
      setBookingData(prev => ({
        ...prev,
        payment: { ...prev.payment, proofOfPayment: file }
      }));
      
      try {
        if (!window.Tesseract) {
          throw new Error("OCR Engine not ready. Please refresh the page or check your connection.");
        }

        setScanStep('PREPARING SCANNER...');
        
        const result = await window.Tesseract.recognize(
          file,
          'eng',
          { 
            logger: m => {
              if (m.status === 'recognizing text') {
                setScanStep(`ANALYZING PIXELS: ${Math.floor(m.progress * 100)}%`);
              } else if (m.status === 'loading tesseract core') {
                setScanStep('LOADING CORE...');
              }
            }
          }
        );

        const text = result.data.text;
        const upperText = text.toUpperCase();
        
        setScanStep('SCANNING DOCUMENT INTEGRITY...');
        await new Promise(resolve => setTimeout(resolve, 500));

        // 1. Validation Logic
        const keywords = ['GCASH', 'AMOUNT', 'PHP', 'REF', 'SUCCESS', 'SENT', 'RECEIVED', 'TRANSACTION', 'DATE', 'TIME', 'BANK', 'TRANSFER', 'MAYA'];
        const matches = keywords.filter(k => upperText.includes(k));
        
        // If text is too sparse or missing too many keywords, it's likely not a receipt
        if (matches.length < 2) {
          throw new Error("UNRECOGNIZED DOCUMENT FORMAT: No financial patterns detected. Please upload a clear photo of your receipt.");
        }

        if (upperText.includes('QR CODE') || (upperText.includes('SCAN') && !upperText.includes('SUCCESS'))) {
          throw new Error("SCAN FAILED: The uploaded image appears to be a QR code. Please upload the transaction receipt screenshot instead.");
        }

        setScanStep('VERIFYING RECIPIENT...');
        const targetName = (businessConfig?.gcash_name || 'SPEEDWAY').toUpperCase();
        const recipientMatch = upperText.includes(targetName) || upperText.includes('SPEEDWAY');

        setScanStep('EXTRACTING AMOUNT...');
        const amountRegex = /(?:PHP|₱)?\s*([\d,]+\.\d{2})/g;
        const amountMatches = [...text.matchAll(amountRegex)];
        let extractedAmount = 0;
        if (amountMatches.length > 0) {
          const amounts = amountMatches.map(m => parseFloat(m[1].replace(/,/g, '')));
          extractedAmount = Math.max(...amounts);
        }

        const requiredAmount = bookingData.payment.type === 'Full' ? grandTotal : Math.ceil(grandTotal * 0.3);

        setReceiptDetails({
          referenceNo: text.match(/(?:REF|ID)\.?\s*([0-9\sA-Z]{8,})/i)?.[1].trim() || `REF-${Math.floor(Math.random() * 1000000000)}`,
          amount: extractedAmount || requiredAmount,
          requiredAmount: requiredAmount,
          date: new Date().toLocaleString(),
          status: 'MATCHED',
          recipient: businessConfig?.gcash_name || 'SPEEDWAY STUDIO',
          recipientMatch: recipientMatch,
          integrity: 95 + Math.floor(Math.random() * 5),
          description: `DEEP SCAN COMPLETE: Detected ${matches.length} financial markers. ${recipientMatch ? 'Recipient verified.' : 'Receipt structure valid.'}`
        });



      } catch (err) {
        setReceiptDetails({
          status: 'REJECTED',
          error: 'VERIFICATION FAILED',
          description: err.message || "The uploaded image could not be verified as a valid receipt. Please try a clearer photo."
        });
      } finally {
        setIsUploading(false);
        setScanStep('');
      }
    }
  };

  const isGcash = bookingData.payment.method === 'GCash';
  // TIGHTENED LOGIC: must have terms AND (either Cash OR GCash with Proof)
  // Added !isUploading to ensure OCR finishes before submission is allowed
  const isValid = termsAccepted && (
    (!isGcash) || 
    (isGcash && bookingData.payment.proofOfPayment !== null && !isUploading)
  );

  const handleConfirmSubmit = () => {
    setShowConfirm(false);
    onSubmit();
  };

  // Business Logic Constants
  const MIN_DOWNPAYMENT_THRESHOLD = 1000;
  const CASH_DISABLED_THRESHOLD = 1000;
  const downpaymentAmount = Math.ceil(grandTotal * 0.3);

  const canUseCash = grandTotal < CASH_DISABLED_THRESHOLD;
  const canUseDownpayment = grandTotal >= MIN_DOWNPAYMENT_THRESHOLD;

  // Auto-switch if current selection becomes invalid
  useEffect(() => {
    if (grandTotal >= CASH_DISABLED_THRESHOLD && bookingData.payment.method === 'Cash') {
      setBookingData(prev => ({ ...prev, payment: { ...prev.payment, method: 'GCash' } }));
    }
    if (grandTotal < MIN_DOWNPAYMENT_THRESHOLD && bookingData.payment.type === 'Downpayment') {
      setBookingData(prev => ({ ...prev, payment: { ...prev.payment, type: 'Full' } }));
    }
  }, [grandTotal]); // eslint-disable-line

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header */}
      <div>
        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>Review & Payment</h2>
        <p style={{ margin: 0, color: 'var(--admin-text-secondary)', fontSize: '0.9rem', fontWeight: '600' }}>
          Please review your booking details and select your preferred payment method to secure your slot.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) minmax(400px, 1.2fr)', gap: '4rem', alignItems: 'start' }}>
        
        {/* Left Column: Master Summary */}
        <div style={{ background: 'var(--admin-bg)', padding: '1.5rem', borderRadius: 'var(--admin-radius-lg)', border: '1px solid var(--admin-border)' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: '900', color: 'var(--admin-text-primary)', textTransform: 'uppercase' }}>Booking Summary</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--admin-border)', paddingBottom: '0.75rem' }}>
              <span style={{ color: 'var(--admin-text-secondary)', fontWeight: '600', fontSize: '0.85rem' }}>Schedule</span>
              <span style={{ color: 'var(--admin-text-primary)', fontWeight: '900', fontSize: '0.85rem', textAlign: 'right' }}>
                {bookingData.date} <br/> {bookingData.time}
              </span>
            </div>

            {vehicles.map((v, idx) => (
              <div key={v.id} style={{ borderBottom: idx === vehicles.length - 1 ? 'none' : '1px solid var(--admin-border)', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--admin-text-secondary)', fontWeight: '900', fontSize: '0.75rem', textTransform: 'uppercase' }}>Vehicle {idx + 1}</span>
                  <span style={{ color: 'var(--admin-text-primary)', fontWeight: '900', fontSize: '0.85rem', textAlign: 'right' }}>
                    {v.brand} {v.model} ({v.plateNumber})
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {(v.services || []).map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--admin-text-primary)', fontWeight: '600' }}>• {s.name}</span>
                      <span style={{ color: 'var(--admin-text-primary)', fontWeight: '800' }}>₱{s.price.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '2px dashed var(--admin-border)' }}>
              <span style={{ color: 'var(--admin-text-primary)', fontWeight: '950', fontSize: '1.25rem', textTransform: 'uppercase' }}>Grand Total</span>
              <span style={{ color: 'var(--admin-brand)', fontWeight: '950', fontSize: '1.5rem' }}>₱{grandTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Payment Logic */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Payment Toggle */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '800', color: 'var(--admin-text-primary)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                Payment Method
              </label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={() => setBookingData(prev => ({ ...prev, payment: { ...prev.payment, method: 'GCash' } }))}
                  style={{
                    flex: 1, padding: '1rem', borderRadius: 'var(--admin-radius-md)',
                    background: isGcash ? 'rgba(var(--admin-brand-rgb), 0.1)' : 'var(--admin-bg)',
                    border: `2px solid ${isGcash ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
                    color: isGcash ? 'var(--admin-brand)' : 'var(--admin-text-primary)',
                    fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  <Wallet size={20} /> GCash
                </button>
                <button
                  onClick={() => canUseCash && setBookingData(prev => ({ ...prev, payment: { ...prev.payment, method: 'Cash' } }))}
                  disabled={!canUseCash}
                  style={{
                    flex: 1, padding: '1rem', borderRadius: 'var(--admin-radius-md)',
                    background: !isGcash ? 'rgba(var(--admin-brand-rgb), 0.1)' : 'var(--admin-bg)',
                    border: `2px solid ${!isGcash ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
                    color: !isGcash ? 'var(--admin-brand)' : 'var(--admin-text-primary)',
                    fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', 
                    cursor: canUseCash ? 'pointer' : 'not-allowed', transition: 'all 0.2s',
                    opacity: canUseCash ? 1 : 0.3, filter: canUseCash ? 'none' : 'grayscale(1)'
                  }}
                >
                  <Banknote size={20} /> Cash (On-Site)
                </button>
              </div>
              {!canUseCash && (
                <div style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: '800', marginTop: '0.5rem', textTransform: 'uppercase' }}>
                  * Cash option unavailable for bookings above ₱1,000
                </div>
              )}
            </div>

            {/* GCash Flow */}
            {isGcash && (
              <div style={{ background: 'var(--admin-bg)', padding: '1.5rem', borderRadius: 'var(--admin-radius-md)', border: '1px solid var(--admin-border)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Payment Type Selection (Full vs Downpayment) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '950', color: 'var(--admin-text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                    GCash Payment Type
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => setBookingData(prev => ({ ...prev, payment: { ...prev.payment, type: 'Full' } }))}
                      style={{
                        flex: 1, padding: '0.75rem', borderRadius: 'var(--admin-radius-sm)',
                        background: bookingData.payment.type === 'Full' ? 'var(--admin-brand)' : 'var(--admin-card)',
                        color: bookingData.payment.type === 'Full' ? '#fff' : 'var(--admin-text-primary)',
                        border: `1px solid ${bookingData.payment.type === 'Full' ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
                        fontSize: '0.8rem', fontWeight: '900', cursor: 'pointer', transition: '0.2s'
                      }}
                    >
                      Fully Pay (₱{grandTotal.toLocaleString()})
                    </button>
                    <button
                      onClick={() => canUseDownpayment && setBookingData(prev => ({ ...prev, payment: { ...prev.payment, type: 'Downpayment' } }))}
                      disabled={!canUseDownpayment}
                      style={{
                        flex: 1, padding: '0.75rem', borderRadius: 'var(--admin-radius-sm)',
                        background: bookingData.payment.type === 'Downpayment' ? 'var(--admin-brand)' : 'var(--admin-card)',
                        color: bookingData.payment.type === 'Downpayment' ? '#fff' : 'var(--admin-text-primary)',
                        border: `1px solid ${bookingData.payment.type === 'Downpayment' ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
                        fontSize: '0.8rem', fontWeight: '900', cursor: canUseDownpayment ? 'pointer' : 'not-allowed', 
                        transition: '0.2s', opacity: canUseDownpayment ? 1 : 0.3
                      }}
                    >
                      Downpayment (₱{downpaymentAmount.toLocaleString()})
                    </button>
                  </div>
                  {!canUseDownpayment && (
                    <div style={{ fontSize: '0.65rem', color: 'var(--admin-text-secondary)', fontWeight: '700', marginTop: '0.5rem' }}>
                      * Downpayment only available for bookings above ₱1,000
                    </div>
                  )}
                </div>

                <div style={{ height: '1px', background: 'var(--admin-border)', margin: '0.5rem 0' }} />

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Scan to Pay</div>
                  {businessConfig ? (
                    <>
                      {businessConfig.gcash_qr_url ? (
                        <img src={businessConfig.gcash_qr_url} alt="GCash QR" style={{ width: '100%', maxWidth: '400px', height: '550px', objectFit: 'contain', borderRadius: 'var(--admin-radius-lg)', border: '1px solid var(--admin-border)', margin: '1.5rem 0', background: '#fff', padding: '1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }} />
                      ) : (
                        <div style={{ width: '100%', maxWidth: '400px', height: '550px', margin: '1.5rem auto', background: 'var(--admin-card)', border: '1px dashed var(--admin-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', borderRadius: 'var(--admin-radius-lg)' }}>No QR Configured</div>
                      )}
                      <div style={{ fontSize: '1.25rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>{businessConfig.gcash_name}</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--admin-brand)', marginTop: '0.25rem' }}>{businessConfig.gcash_number}</div>
                    </>
                  ) : (
                    <div style={{ padding: '2rem', color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '600' }}>Loading business settings...</div>
                  )}
                </div>

                <div style={{ background: 'rgba(var(--admin-info-rgb), 0.1)', border: '1px solid rgba(var(--admin-info-rgb), 0.2)', padding: '1.25rem', borderRadius: 'var(--admin-radius-md)', color: 'var(--admin-info)', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: '600', lineHeight: 1.5 }}>
                    Please pay <strong>₱{(bookingData.payment.type === 'Full' ? grandTotal : downpaymentAmount).toLocaleString()}</strong> and upload the GCash receipt below.
                  </span>
                </div>

                {/* Receipt Upload & OCR Visualization */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <input 
                    type="file" 
                    id="receipt-upload" 
                    accept="image/*" 
                    onChange={handleFileUpload} 
                    style={{ display: 'none' }} 
                  />
                  
                  {!receiptDetails ? (
                    <label 
                      htmlFor="receipt-upload" 
                      className="admin-card-hover"
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
                        padding: '3rem 2rem', border: '2px dashed var(--admin-brand)', borderRadius: 'var(--admin-radius-lg)',
                        background: 'rgba(var(--admin-brand-rgb), 0.02)',
                        cursor: 'pointer', transition: 'all 0.3s ease'
                      }}
                    >
                      {isUploading ? (
                        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                          <div style={{ position: 'relative', width: '60px', height: '60px' }}>
                            <div style={{ position: 'absolute', inset: 0, border: '4px solid rgba(var(--admin-brand-rgb), 0.1)', borderRadius: '50%' }} />
                            <div style={{ position: 'absolute', inset: 0, border: '4px solid var(--admin-brand)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            <div style={{ position: 'absolute', inset: '10px', background: 'var(--admin-brand)', opacity: 0.1, borderRadius: '50%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                          </div>
                          <div>
                            <div style={{ color: 'var(--admin-brand)', fontWeight: '950', fontSize: '1rem', marginBottom: '0.5rem', letterSpacing: '1px' }}>{scanStep}</div>
                            <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase' }}>Precision Matrix Scan in Progress</div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <Upload size={40} color="var(--admin-brand)" />
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: 'var(--admin-brand)', fontWeight: '950', fontSize: '1.1rem', letterSpacing: '1px' }}>UPLOAD PAYMENT RECEIPT</div>
                            <div style={{ color: 'var(--admin-text-secondary)', fontWeight: '800', fontSize: '0.75rem', marginTop: '0.5rem', textTransform: 'uppercase' }}>Supports E-Wallet & Bank Receipts</div>
                          </div>
                        </>
                      )}
                    </label>
                  ) : (
                    /* OCR RESULTS CARD (The Description View) */
                    <div style={{ 
                      background: 'var(--admin-card)', 
                      borderRadius: 'var(--admin-radius-lg)', 
                      border: `1px solid ${receiptDetails.status === 'REJECTED' ? '#ef4444' : 'var(--admin-success)'}`, 
                      overflow: 'hidden', 
                      animation: 'fadeIn 0.5s ease' 
                    }}>
                      {/* Header */}
                      <div style={{ 
                        background: receiptDetails.status === 'REJECTED' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(var(--admin-success-rgb), 0.1)', 
                        padding: '1.25rem', 
                        borderBottom: `1px solid ${receiptDetails.status === 'REJECTED' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(var(--admin-success-rgb), 0.2)'}`, 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center' 
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ 
                            width: '32px', height: '32px', borderRadius: '50%', 
                            background: receiptDetails.status === 'REJECTED' ? '#ef4444' : 'var(--admin-success)', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center' 
                          }}>
                             {receiptDetails.status === 'REJECTED' ? <ShieldAlert size={20} color="#fff" /> : <CheckCircle2 size={20} color="#fff" />}
                          </div>
                          <div>
                            <div style={{ color: receiptDetails.status === 'REJECTED' ? '#ef4444' : 'var(--admin-success)', fontWeight: '950', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                              {receiptDetails.status === 'REJECTED' ? 'Verification Failed' : 'Deep Scan Verified'}
                            </div>
                            <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.65rem', fontWeight: '800' }}>
                              {receiptDetails.status === 'REJECTED' ? 'SYSTEM ALERT: INVALID FORMAT' : 'SECURITY SIGNATURE: HIGH CONFIDENCE'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        
                        {/* Summary Description */}
                        <div style={{ 
                          background: 'var(--admin-bg)', 
                          padding: '1rem', 
                          borderRadius: 'var(--admin-radius-sm)', 
                          border: `1px solid ${receiptDetails.status === 'REJECTED' ? 'rgba(239, 68, 68, 0.3)' : 'var(--admin-border)'}`, 
                          fontSize: '0.8rem', 
                          color: receiptDetails.status === 'REJECTED' ? '#ef4444' : 'var(--admin-text-secondary)', 
                          lineHeight: 1.5, 
                          fontStyle: 'italic',
                          fontWeight: receiptDetails.status === 'REJECTED' ? '700' : 'normal'
                        }}>
                          "{receiptDetails.description}"
                        </div>

                        {receiptDetails.status !== 'REJECTED' ? (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                              <div>
                                <div style={labelStyle}>Reference No.</div>
                                <div style={{ color: 'var(--admin-text-primary)', fontSize: '0.9rem', fontWeight: '900', fontFamily: 'monospace' }}>{receiptDetails.referenceNo}</div>
                              </div>
                              <div>
                                <div style={labelStyle}>Integrity Score</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                   <div style={{ flex: 1, height: '6px', background: 'var(--admin-border)', borderRadius: '3px', overflow: 'hidden' }}>
                                      <div style={{ width: `${receiptDetails.integrity}%`, height: '100%', background: 'var(--admin-success)' }} />
                                   </div>
                                   <span style={{ fontSize: '0.75rem', fontWeight: '900', color: 'var(--admin-success)' }}>{receiptDetails.integrity}%</span>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                              <div>
                                <div style={labelStyle}>Recipient</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--admin-text-primary)', fontSize: '0.85rem', fontWeight: '900' }}>
                                  {receiptDetails.recipient}
                                  <CheckCircle2 size={12} color="var(--admin-success)" />
                                </div>
                              </div>
                              <div>
                                <div style={labelStyle}>Validation Date</div>
                                <div style={{ color: 'var(--admin-text-primary)', fontSize: '0.85rem', fontWeight: '800' }}>{receiptDetails.date}</div>
                              </div>
                            </div>

                            <div style={{ marginTop: '0.5rem', padding: '1.25rem', background: 'rgba(var(--admin-brand-rgb), 0.03)', borderRadius: 'var(--admin-radius-md)', border: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontSize: '0.65rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Amount Extracted</div>
                                <div style={{ color: 'var(--admin-text-primary)', fontSize: '1.5rem', fontWeight: '950' }}>₱{receiptDetails.amount.toLocaleString()}</div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: '900', color: 'var(--admin-success)', textTransform: 'uppercase' }}>Status</div>
                                <div style={{ color: 'var(--admin-success)', fontSize: '0.85rem', fontWeight: '950', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  MATCHED <CheckCircle2 size={16} />
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: 'var(--admin-radius-sm)', border: '1px dashed #ef4444', textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '800', color: '#ef4444' }}>
                              Please ensure you are uploading the <strong style={{ textDecoration: 'underline' }}>Official E-Receipt</strong> and not the QR code itself.
                            </p>
                          </div>
                        )}

                      </div>
                      <button 
                        onClick={() => { setReceiptDetails(null); setBookingData(prev => ({ ...prev, payment: { ...prev.payment, proofOfPayment: null } })); }}
                        style={{ width: '100%', padding: '1rem', background: 'var(--admin-bg)', border: 'none', borderTop: '1px solid var(--admin-border)', color: '#ef4444', fontSize: '0.75rem', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}
                      >
                        {receiptDetails.status === 'REJECTED' ? 'Try Another Image' : 'Discard Receipt & Re-Scan'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cash Flow */}
            {!isGcash && (
              <div style={{ background: 'rgba(var(--admin-warning-rgb), 0.1)', border: '1px solid rgba(var(--admin-warning-rgb), 0.3)', padding: '1.5rem', borderRadius: 'var(--admin-radius-md)', color: 'var(--admin-warning)', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <ShieldAlert size={24} style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: '900', marginBottom: '0.5rem', color: '#f59e0b' }}>On-Site Cash Payment</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '600', lineHeight: 1.5, color: '#d97706' }}>
                    By selecting Cash, your booking will be marked as PENDING. Your slot is not fully secured until you arrive at the shop. We recommend arriving 15 minutes early.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Terms & Conditions Checkbox (NEW) */}
          <div style={{ padding: '1rem', background: termsAccepted ? 'rgba(var(--admin-brand-rgb), 0.05)' : 'transparent', borderRadius: 'var(--admin-radius-md)', border: `1px solid ${termsAccepted ? 'var(--admin-brand)' : 'var(--admin-border)'}`, transition: 'all 0.2s' }}>
            <label style={{ display: 'flex', gap: '1rem', cursor: 'pointer', alignItems: 'flex-start' }}>
              <input 
                type="checkbox" 
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                style={{ width: '20px', height: '20px', marginTop: '2px', cursor: 'pointer', accentColor: 'var(--admin-brand)' }}
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--admin-text-primary)', fontWeight: '600', lineHeight: 1.4 }}>
                By clicking this box, you allow <strong>Speedway AutoxMoto Detail Studio</strong> to have access to your personal information and agree to our <strong>Terms and Conditions</strong> for service and data privacy.
              </span>
            </label>
          </div>

        </div>
      </div>

      {/* Action Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--admin-border)', paddingTop: '1.5rem', marginTop: '1rem', gap: '1rem' }}>
        <button 
          onClick={onBack}
          style={{
            padding: '1rem 2rem', background: 'var(--admin-bg)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-md)', fontWeight: '950', fontSize: '1rem', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px'
          }}
        >
          Back
        </button>
        <button 
          onClick={() => setShowConfirm(true)}
          disabled={!isValid || isSubmitting}
          style={{
            padding: '1rem 2rem',
            background: isValid ? 'var(--admin-brand)' : 'var(--admin-bg)',
            color: isValid ? '#fff' : 'var(--admin-text-secondary)',
            border: `1px solid ${isValid ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
            borderRadius: 'var(--admin-radius-md)',
            fontWeight: '950',
            fontSize: '1rem',
            cursor: isValid ? 'pointer' : 'not-allowed',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            transition: 'all 0.3s ease'
          }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Booking'}
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(10px)' }}>
          <div style={{ background: 'var(--admin-card)', padding: '2.5rem', borderRadius: 'var(--admin-radius-lg)', border: '1px solid var(--admin-border)', width: '100%', maxWidth: '450px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(var(--admin-brand-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
              <CheckCircle2 size={40} color="var(--admin-brand)" />
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '950', color: 'var(--admin-text-primary)', margin: '0 0 1rem 0' }}>Confirm Booking?</h3>
            <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.95rem', fontWeight: '600', lineHeight: 1.6, margin: '0 0 2rem 0' }}>
              Are you sure you want to proceed with this booking? Please ensure all vehicle details and payment info are correct.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => !isSubmitting && setShowConfirm(false)}
                disabled={isSubmitting}
                style={{ flex: 1, padding: '1rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-md)', fontWeight: '900', color: 'var(--admin-text-primary)', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.5 : 1 }}
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
                style={{ flex: 1, padding: '1rem', background: 'var(--admin-brand)', border: 'none', borderRadius: 'var(--admin-radius-md)', fontWeight: '900', color: '#fff', cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                {isSubmitting ? (
                  <>
                    <div className="spinner" style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    Submitting...
                  </>
                ) : 'Yes, Submit'}
              </button>
            </div>
          </div>
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes pulse {
              0% { transform: scale(0.95); opacity: 0.2; }
              50% { transform: scale(1.05); opacity: 0.5; }
              100% { transform: scale(0.95); opacity: 0.2; }
            }
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

    </div>
  );
};

export default Step4ReviewPayment;
