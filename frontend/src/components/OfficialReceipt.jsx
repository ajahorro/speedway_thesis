<<<<<<< HEAD
import React, { useRef } from 'react';
import { Printer, Download, X, ShieldCheck, Building2, Phone, Mail, Hash } from 'lucide-react';

// ─── BUSINESS CONSTANTS ────────────────────────────────────────────────────────
const COMPANY = {
  name: 'SPEEDWAY',
  tagline: 'AutoXMoto Detail Studio',
  address: '123 Speedway Drive, Quezon City, Metro Manila 1100',
  phone: '+63 917 123 4567',
  email: 'billing@speedwayautoxmoto.com',
  tin: '123-456-789-000',
  vatReg: 'VAT Reg. TIN: 123-456-789-VAT',
};

// 12% VAT — adjustable per your BIR registration
const VAT_RATE = 0.12;

// ─── HELPERS ───────────────────────────────────────────────────────────────────
const php = (val) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(val || 0);

const fmtDate = (isoStr) =>
  isoStr
    ? new Date(isoStr).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

// ─── COMPONENT ─────────────────────────────────────────────────────────────────
/**
 * OfficialReceipt — Enterprise-grade receipt/invoice component.
 *
 * Props:
 *   booking        — booking record (required)
 *   vehicles       — array of vehicle + services (required for invoice mode)
 *   user           — current auth user object
 *   selectedPayment — if provided, renders a single-payment receipt; otherwise full invoice
 *   onClose        — called when the X button is clicked (modal mode)
 *   mode           — 'modal' (default) | 'page' (standalone page, no overlay)
 */
const OfficialReceipt = ({ booking, vehicles = [], user, selectedPayment, onClose, mode = 'modal' }) => {
  const receiptRef = useRef(null);

  // ── Derived vehicles ─────────────────────────────────────────────────────────
  const effectiveVehicles = (vehicles && vehicles.length > 0)
    ? vehicles
    : (booking?.vehicles && booking.vehicles.length > 0)
    ? booking.vehicles
    : [];

  // ── Customer info extraction ──────────────────────────────────────────────────
  const customerName = booking?.customer?.full_name || booking?.customer_name || user?.user_metadata?.full_name || 'Valued Customer';
  const customerEmail = booking?.customer?.email || booking?.customer_email || user?.email || '';
  const customerPhone = booking?.customer?.phone || booking?.customer_phone || user?.phone || '';
  const customerAddress = booking?.customer?.address || booking?.billing_address || 'Metro Manila, Philippines';

  // ── Derived identifiers ──────────────────────────────────────────────────────
  const isInvoice   = !selectedPayment;
  const docNo       = selectedPayment
    ? `RCP-${selectedPayment.id.substring(0, 8).toUpperCase()}`
    : `INV-${booking?.id?.substring(0, 8)?.toUpperCase() || 'RECEIPT'}`;
  const issuedAt    = selectedPayment?.created_at || booking?.created_at;
  const isRefunded  = selectedPayment?.status === 'REFUNDED' || booking?.refund_status === 'PROCESSED';

  // ── Transaction reference ────────────────────────────────────────────────────
  const txnId = selectedPayment?.reference_number
    || booking?.payments?.find(p => p.reference_number)?.reference_number
    || booking?.ocr_metadata?.referenceNo
    || (selectedPayment ? `TXN-${selectedPayment.id.substring(0, 12).toUpperCase()}` : `WO-${booking?.id?.substring(0, 12)?.toUpperCase() || 'REF'}`);

  // ── Financial calculations ───────────────────────────────────────────────────
  const rawTotal   = isInvoice ? (booking?.total_amount || 0) : (selectedPayment?.amount || 0);
  const vatBase    = rawTotal / (1 + VAT_RATE);
  const vatAmt     = rawTotal - vatBase;
  const grandTotal = rawTotal;

  const totalPaid   = (booking?.payments || []).filter(p => p.status === 'PAID' || p.status === 'REFUND_PENDING').reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = Math.max(0, (booking?.total_amount || 0) - totalPaid);

  // ── PDF download ─────────────────────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    if (!receiptRef.current) return;
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      html2pdf().set({
        margin: 0.5,
        filename: `Speedway-${docNo}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
      }).from(receiptRef.current).save();
    } catch (err) {
      console.error('PDF generation failed:', err);
      window.print();
    }
  };

  // ── Inline styles ────────────────────────────────────────────────────────────
  const labelSt = {
    fontSize: '0.6rem', fontWeight: '800', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: '0.25rem',
  };
  const valueSt  = { fontSize: '0.88rem', fontWeight: '700', color: '#111827', lineHeight: 1.4 };
  const valueSmSt = { fontSize: '0.78rem', color: '#374151', lineHeight: 1.4 };
  const dividerSt = { borderBottom: '1px solid #E5E7EB', margin: '1.25rem 0' };
  const thickDividerSt = { borderBottom: '2px solid #D1D5DB', margin: '1.25rem 0' };
  const monoSt = { fontFamily: '"Courier New", "Roboto Mono", monospace', fontVariantNumeric: 'tabular-nums' };
  const priceColSt = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: '"Courier New", "Roboto Mono", monospace' };

  // ── Receipt content ──────────────────────────────────────────────────────────
  const receiptContent = (
    <div
      ref={receiptRef}
      id="invoice-content"
      className="invoice-content"
      style={{ background: '#FFFFFF', color: '#111827', padding: '2.5rem', position: 'relative', fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif' }}
    >
      {/* VOID watermark */}
      {isRefunded && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-30deg)', fontSize: '6rem', fontWeight: '900', color: 'rgba(239,68,68,0.07)', pointerEvents: 'none', zIndex: 0, whiteSpace: 'nowrap', userSelect: 'none' }}>
          VOID / REFUNDED
        </div>
      )}

      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <div style={{ fontWeight: '950', fontSize: '2rem', letterSpacing: '2px', color: '#111827', fontStyle: 'italic', lineHeight: 1 }}>
            SPEED<span style={{ color: '#E61E2A' }}>WAY</span>
          </div>
          <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#6B7280', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '0.2rem' }}>
            {COMPANY.tagline}
          </div>
          <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: '#6B7280' }}>
              <Building2 size={11} /> {COMPANY.address}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: '#6B7280' }}>
              <Phone size={11} /> {COMPANY.phone} &nbsp;|&nbsp; <Mail size={11} /> {COMPANY.email}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: '#6B7280' }}>
              <Hash size={11} /> TIN: {COMPANY.tin} &nbsp;|&nbsp; {COMPANY.vatReg}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'inline-block', padding: '0.25rem 0.75rem', background: isInvoice ? '#FEF3C7' : '#ECFDF5', border: `1px solid ${isInvoice ? '#F59E0B' : '#6EE7B7'}`, borderRadius: '2px', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: '900', letterSpacing: '1.5px', textTransform: 'uppercase', color: isInvoice ? '#92400E' : '#065F46' }}>
              {isRefunded ? 'VOIDED' : isInvoice ? 'INVOICE' : 'OFFICIAL RECEIPT'}
            </span>
          </div>
          <div style={{ ...monoSt, fontWeight: '900', fontSize: '1.1rem', color: '#111827', letterSpacing: '1px' }}>
            {docNo}
          </div>
          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ fontSize: '0.72rem', color: '#6B7280' }}><span style={{ fontWeight: '700' }}>Date Issued:</span> {fmtDate(issuedAt)}</div>
            <div style={{ fontSize: '0.72rem', color: '#6B7280' }}><span style={{ fontWeight: '700' }}>Due Date:</span> {fmtDate(issuedAt)}</div>
            <div style={{ fontSize: '0.72rem', color: '#6B7280' }}><span style={{ fontWeight: '700' }}>Terms:</span> Due Upon Receipt</div>
          </div>
        </div>
      </div>

      <div style={thickDividerSt} />

      {/* ── BILLING PARTIES ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '1.75rem' }}>
        <div>
          <span style={labelSt}>Billed To</span>
          <div style={{ ...valueSt, fontSize: '1rem' }}>{customerName}</div>
          {customerEmail && <div style={{ ...valueSmSt, marginTop: '0.2rem' }}>{customerEmail}</div>}
          {customerPhone && <div style={{ ...valueSmSt, marginTop: '0.1rem', color: '#4B5563' }}>Tel: {customerPhone}</div>}
          <div style={{ ...valueSmSt, marginTop: '0.2rem', color: '#9CA3AF' }}>{customerAddress} · Consumer Account</div>
        </div>
        <div>
          <span style={labelSt}>Work Order Ref.</span>
          <div style={{ ...monoSt, fontWeight: '800', fontSize: '0.88rem', color: '#111827' }}>
            WO-{booking?.id?.substring(0, 12)?.toUpperCase() || 'REF'}
          </div>
          {booking?.start_datetime && <div style={{ ...valueSmSt, marginTop: '0.3rem' }}>Service Date: {fmtDate(booking.start_datetime)}</div>}
          <div style={{ ...valueSmSt, marginTop: '0.2rem' }}>
            Status: <span style={{ fontWeight: '800', color: isRefunded ? '#EF4444' : '#059669' }}>
              {isRefunded ? 'REFUNDED' : isInvoice ? 'ACTIVE' : 'SETTLED'}
            </span>
          </div>
        </div>
      </div>

      <div style={dividerSt} />

      {/* ── LINE ITEM TABLE ───────────────────────────────────────────────────── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <thead>
          <tr>
            {['Description', 'Qty', 'Unit Price', 'Tax', 'Line Total'].map((h, i) => (
              <th key={h} style={{ padding: '0.6rem 0.5rem', textAlign: i === 0 ? 'left' : 'right', fontSize: '0.62rem', fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid #E5E7EB' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {selectedPayment ? (
            <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
              <td style={{ padding: '0.9rem 0.5rem' }}>
                <div style={{ fontWeight: '700', color: '#111827' }}>Service Installment / Settlement Payment</div>
                {effectiveVehicles.length > 0 && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#F3F4F6', padding: '0.2rem 0.5rem', borderRadius: '3px', marginTop: '0.35rem', border: '1px solid #E5E7EB' }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: '800', color: '#6B7280', textTransform: 'uppercase' }}>Vehicle</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#111827' }}>
                      {effectiveVehicles.map(v => `${v.brand} ${v.model}${v.plate_number ? ` (${v.plate_number})` : ''}`).join(', ')}
                    </span>
                  </div>
                )}
                <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginTop: '0.25rem' }}>Booking Ref: WO-{booking?.id?.substring(0, 12)?.toUpperCase() || 'REF'}</div>
              </td>
              <td style={{ ...priceColSt, padding: '0.9rem 0.5rem', color: '#374151' }}>1</td>
              <td style={{ ...priceColSt, padding: '0.9rem 0.5rem', color: '#374151' }}>{php(selectedPayment.amount / (1 + VAT_RATE))}</td>
              <td style={{ ...priceColSt, padding: '0.9rem 0.5rem', color: '#6B7280' }}>{php(selectedPayment.amount - selectedPayment.amount / (1 + VAT_RATE))}</td>
              <td style={{ ...priceColSt, padding: '0.9rem 0.5rem', fontWeight: '800', color: '#111827' }}>{php(selectedPayment.amount)}</td>
            </tr>
          ) : effectiveVehicles.length > 0 ? (
            effectiveVehicles.map((v) => (
              <React.Fragment key={v.id || `${v.brand}-${v.model}`}>
                {/* Vehicle group header */}
                <tr>
                  <td colSpan={5} style={{ padding: '1rem 0.5rem 0.4rem', borderTop: '1px solid #F3F4F6' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#F3F4F6', padding: '0.25rem 0.6rem', borderRadius: '2px', border: '1px solid #E5E7EB' }}>
                      <span style={{ fontSize: '0.62rem', fontWeight: '900', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1px' }}>Vehicle</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#111827' }}>{v.brand} {v.model}{v.plate_number ? ` · ${v.plate_number}` : ''}</span>
                      {v.vehicle_type && <span style={{ fontSize: '0.62rem', color: '#9CA3AF' }}>({v.vehicle_type})</span>}
                    </div>
                  </td>
                </tr>
                {(v.services || []).map((svc, idx) => {
                  const linePrice = Number(svc.price || svc.price_snapshot || 0);
                  const lineBase  = linePrice / (1 + VAT_RATE);
                  const lineVat   = linePrice - lineBase;
                  return (
                    <tr key={svc.id || idx} style={{ borderBottom: '1px solid #F9FAFB' }}>
                      <td style={{ padding: '0.6rem 0.5rem 0.6rem 1.25rem', color: '#374151', fontWeight: '600' }}>{svc.service_name || svc.service_name_snapshot || '—'}</td>
                      <td style={{ ...priceColSt, padding: '0.6rem 0.5rem', color: '#6B7280' }}>1</td>
                      <td style={{ ...priceColSt, padding: '0.6rem 0.5rem', color: '#6B7280' }}>{php(lineBase)}</td>
                      <td style={{ ...priceColSt, padding: '0.6rem 0.5rem', color: '#9CA3AF', fontSize: '0.75rem' }}>{php(lineVat)}</td>
                      <td style={{ ...priceColSt, padding: '0.6rem 0.5rem', fontWeight: '700', color: '#111827' }}>{php(linePrice)}</td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))
          ) : (
            <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
              <td style={{ padding: '0.9rem 0.5rem' }}>
                <div style={{ fontWeight: '700', color: '#111827' }}>{booking?.service_package || 'Professional Auto Detail & Care Package'}</div>
                <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginTop: '0.15rem' }}>Work Order Ref: WO-{booking?.id?.substring(0, 12)?.toUpperCase() || 'REF'}</div>
              </td>
              <td style={{ ...priceColSt, padding: '0.9rem 0.5rem', color: '#374151' }}>1</td>
              <td style={{ ...priceColSt, padding: '0.9rem 0.5rem', color: '#374151' }}>{php(vatBase)}</td>
              <td style={{ ...priceColSt, padding: '0.9rem 0.5rem', color: '#6B7280' }}>{php(vatAmt)}</td>
              <td style={{ ...priceColSt, padding: '0.9rem 0.5rem', fontWeight: '800', color: '#111827' }}>{php(rawTotal)}</td>
            </tr>
          )}
          {isRefunded && (
            <tr style={{ borderTop: '1px dashed #FCA5A5' }}>
              <td colSpan={4} style={{ padding: '0.75rem 0.5rem', fontSize: '0.82rem', color: '#EF4444', fontWeight: '800' }}>FINANCIAL REVERSAL — Refund Processed</td>
              <td style={{ ...priceColSt, padding: '0.75rem 0.5rem', color: '#EF4444', fontWeight: '800' }}>
                ({php((booking?.payments || []).filter(p => p.status === 'REFUNDED').reduce((acc, p) => acc + Number(p.amount), 0))})
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={dividerSt} />

      {/* ── FINANCIAL SUMMARY ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: '300px' }}>
          {[
            { label: 'Subtotal (excl. VAT)', value: php(vatBase) },
            { label: `VAT (${(VAT_RATE * 100).toFixed(0)}%)`, value: php(vatAmt) },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: '0.78rem', color: '#9CA3AF', fontWeight: '600' }}>{row.label}</span>
              <span className="price-column" style={{ ...monoSt, fontSize: '0.78rem', color: '#374151', fontWeight: '700' }}>{row.value}</span>
            </div>
          ))}

          {!isInvoice && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: '0.78rem', color: '#9CA3AF', fontWeight: '600' }}>Payment Received</span>
              <span className="price-column" style={{ ...monoSt, fontSize: '0.78rem', color: '#059669', fontWeight: '800' }}>{php(selectedPayment?.amount)}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', marginTop: '0.25rem', borderTop: '2px solid #111827' }}>
            <span style={{ fontWeight: '900', fontSize: '0.88rem', color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Grand Total (VAT Incl.)</span>
            <span className="price-column" style={{ ...monoSt, fontWeight: '950', fontSize: '1.2rem', color: '#111827' }}>{php(grandTotal)}</span>
          </div>

          {isInvoice && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #F3F4F6' }}>
                <span style={{ fontSize: '0.78rem', color: '#9CA3AF', fontWeight: '600' }}>Total Settled</span>
                <span className="price-column" style={{ ...monoSt, fontSize: '0.78rem', color: '#059669', fontWeight: '800' }}>{php(totalPaid)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderTop: outstanding > 0 ? '2px solid #E61E2A' : '2px solid #059669', marginTop: '0.25rem' }}>
                <span style={{ fontWeight: '900', fontSize: '0.88rem', color: outstanding > 0 ? '#E61E2A' : '#059669' }}>
                  {outstanding > 0 ? 'OUTSTANDING BALANCE' : 'FULLY SETTLED ✓'}
                </span>
                <span className="price-column" style={{ ...monoSt, fontWeight: '950', fontSize: '1.1rem', color: outstanding > 0 ? '#E61E2A' : '#059669' }}>{php(outstanding)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={dividerSt} />

      {/* ── PAYMENT & TRANSACTION BLOCK ───────────────────────────────────────── */}
      <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '4px', padding: '1.1rem 1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
        <div>
          <span style={labelSt}>Payment Method</span>
          <div style={valueSt}>{selectedPayment?.method || (booking?.payments?.find(p => p.status === 'PAID')?.method) || 'Verified Channel'}</div>
        </div>
        <div>
          <span style={labelSt}>Transaction ID</span>
          <div style={{ ...valueSt, ...monoSt, fontSize: '0.76rem', wordBreak: 'break-all' }}>{txnId}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={labelSt}>Verification</span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <ShieldCheck size={14} color="#059669" />
            <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#059669' }}>VERIFIED</span>
          </div>
        </div>
      </div>

      {/* ── FOOTER ────────────────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginTop: '2.5rem', paddingTop: '1.25rem', borderTop: '1px solid #E5E7EB' }}>
        <div style={{ fontSize: '0.65rem', color: '#9CA3AF', fontWeight: '600' }}>This is a computer-generated document from Speedway AutoXMoto Detail Studio.</div>
        <div style={{ fontSize: '0.6rem', color: '#D1D5DB', marginTop: '0.2rem' }}>{COMPANY.address} · {COMPANY.email} · TIN: {COMPANY.tin}</div>
      </div>
    </div>
  );

  // ── PAGE MODE ─────────────────────────────────────────────────────────────────
  if (mode === 'page') {
    return (
      <div style={{ background: '#F3F4F6', minHeight: '100vh', padding: '2rem 1rem' }}>
        <div className="no-print action-buttons-container" style={{ maxWidth: '780px', margin: '0 auto 1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button onClick={handleDownloadPDF} style={btnSt('#111827')}><Download size={16} /> Download PDF</button>
          <button onClick={() => window.print()} style={btnSt('#E61E2A')}><Printer size={16} /> Print Receipt</button>
        </div>
        <div style={{ maxWidth: '780px', margin: '0 auto', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', borderRadius: '4px', overflow: 'hidden' }}>
          {receiptContent}
        </div>
      </div>
    );
  }

  // ── MODAL MODE ────────────────────────────────────────────────────────────────
  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1.5rem' }}>
      <div className="no-print-bg" style={{ background: '#fff', width: '100%', maxWidth: '700px', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}>

        {/* Header bar */}
        <div className="header-close-button" style={{ background: '#111827', color: '#fff', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ShieldCheck size={20} color="#E61E2A" />
            <span style={{ fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '0.82rem' }}>
              {selectedPayment ? 'Official Receipt — Verified' : 'Invoice — Consolidated'}
            </span>
          </div>
          {onClose && (
            <button onClick={onClose} className="header-close-button" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} />
=======
import React from 'react';

const formatCurrency = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value || 0));

const getReceiptTotalRows = ({ subtotal, discountAmount = 0, vatRate = 0.12 }) => {
  const safeSubtotal = Number(subtotal || 0);
  const safeDiscount = Number(discountAmount || 0);
  const vatableSales = Math.max(0, safeSubtotal - safeDiscount);
  const vatAmount = Math.max(0, vatableSales * vatRate);
  const totalDue = safeSubtotal - safeDiscount + vatAmount;

  return {
    subtotal: safeSubtotal,
    discountAmount: safeDiscount,
    vatableSales,
    vatAmount,
    totalDue,
  };
};

const bodyFontStyle = {
  fontFamily: 'Inter, system-ui, sans-serif',
  letterSpacing: 0,
  fontFeatureSettings: '"tnum" 1',
  fontVariantNumeric: 'tabular-nums',
};

const OfficialReceipt = ({
  title = 'OFFICIAL RECEIPT',
  receiptNumber,
  bookingReference,
  issuedAt,
  paymentMethod = 'Digital / Online Payment',
  processedBy = 'System Admin',
  customerName = 'Customer',
  customerContact = '-',
  customerAddress = '-',
  customerTaxId = '-',
  items = [],
  subtotal,
  discountAmount = 0,
  vatRate = 0.12,
  onClose,
  showCloseButton = true,
}) => {
  const totals = getReceiptTotalRows({ subtotal, discountAmount, vatRate });
  const safeItems = Array.isArray(items) && items.length > 0 ? items : [{
    vehicle: 'Service Summary',
    service: 'Booking Service Summary',
    qty: 1,
    unitPrice: totals.totalDue,
    lineTotal: totals.totalDue,
  }];

  const handleDownloadPdf = () => {
    const popup = window.open('', '_blank', 'width=1000,height=1000');
    if (!popup) {
      return;
    }

    const rowHtml = safeItems.map((item) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
          <div style="font-weight: 700; color: #111827; font-size: 13px;">${(item.vehicle || 'Vehicle Unit')}</div>
          <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">${(item.service || 'Service')}</div>
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #111827; font-feature-settings: 'tnum' 1; font-variant-numeric: tabular-nums;">${item.qty ?? 1}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 12px; color: #111827; font-feature-settings: 'tnum' 1; font-variant-numeric: tabular-nums;">${formatCurrency(item.unitPrice ?? item.lineTotal ?? 0)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 12px; color: #111827; font-weight: 700; font-feature-settings: 'tnum' 1; font-variant-numeric: tabular-nums;">${formatCurrency(item.lineTotal ?? item.unitPrice ?? 0)}</td>
      </tr>
    `).join('');

    popup.document.write(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            body { font-family: Inter, system-ui, sans-serif; background: #ffffff; color: #111827; margin: 0; padding: 28px; }
            .page { max-width: 820px; margin: 0 auto; border: 1px solid #111827; border-radius: 16px; overflow: hidden; }
            .header { background: #111827; color: #fff; padding: 18px 24px; text-align: center; }
            .brand { font-size: 1.125rem; font-weight: 800; letter-spacing: 0.28em; text-transform: uppercase; }
            .sub { margin-top: 6px; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: #d1d5db; }
            .body { padding: 24px; }
            .meta-row { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 20px; }
            .meta-box { flex: 1; }
            .label { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 5px; }
            .value { font-size: 13px; font-weight: 600; color: #111827; font-feature-settings: 'tnum' 1; font-variant-numeric: tabular-nums; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 20px; margin-bottom: 18px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th { background: #f9fafb; color: #4b5563; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; padding: 10px 12px; text-align: left; font-weight: 600; }
            th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: right; }
            .totals { margin-top: 18px; border-top: 2px solid #111827; padding-top: 14px; }
            .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #4b5563; }
            .row.total { font-size: 18px; font-weight: 800; color: #111827; }
            .footer { margin-top: 20px; font-size: 11px; color: #4b5563; text-align: center; }
            @page { size: A4; margin: 18mm; }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header">
              <div class="brand">SPEEDWAY</div>
              <div class="sub">AutoxMoto Detail Studio</div>
            </div>
            <div class="body">
              <div class="meta-row">
                <div class="meta-box">
                  <div class="label">Receipt Type</div>
                  <div class="value">${title}</div>
                </div>
                <div class="meta-box" style="text-align: right;">
                  <div class="label">Receipt No.</div>
                  <div class="value">${receiptNumber || 'AUTO-' + Date.now().toString().slice(-6)}</div>
                </div>
              </div>

              <div class="grid">
                <div class="meta-box">
                  <div class="label">Business Details</div>
                  <div class="value">AutoxMoto Detail Studio</div>
                  <div style="font-size: 12px; color: #4b5563; margin-top: 4px;">123 Auto Avenue, Mandaluyong City</div>
                  <div style="font-size: 12px; color: #4b5563; margin-top: 2px;">+63 917 123 4567 | hello@speedwaystudio.ph | www.speedwaystudio.ph</div>
                  <div style="font-size: 12px; color: #4b5563; margin-top: 2px;">VAT Reg. No. 000-123-456-000</div>
                </div>
                <div class="meta-box" style="text-align: right;">
                  <div class="label">Booking Reference</div>
                  <div class="value">${bookingReference || 'N/A'}</div>
                  <div class="label" style="margin-top: 10px;">Issued</div>
                  <div class="value">${issuedAt ? new Date(issuedAt).toLocaleString() : new Date().toLocaleString()}</div>
                  <div class="label" style="margin-top: 10px;">Payment Method</div>
                  <div class="value">${paymentMethod}</div>
                </div>
              </div>

              <div class="grid">
                <div class="meta-box">
                  <div class="label">Customer</div>
                  <div class="value">${customerName}</div>
                  <div style="font-size: 12px; color: #4b5563; margin-top: 4px;">${customerContact}</div>
                  <div style="font-size: 12px; color: #4b5563; margin-top: 2px;">${customerAddress}</div>
                </div>
                <div class="meta-box" style="text-align: right;">
                  <div class="label">Processed By</div>
                  <div class="value">${processedBy}</div>
                  <div class="label" style="margin-top: 10px;">Customer Tax ID</div>
                  <div class="value">${customerTaxId}</div>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style="width: 42%;">Vehicle / Service</th>
                    <th style="width: 12%; text-align: center;">Qty</th>
                    <th style="width: 23%; text-align: right;">Unit Price</th>
                    <th style="width: 23%; text-align: right;">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowHtml}
                </tbody>
              </table>

              <div class="totals">
                <div class="row"><span>Subtotal</span><span>${formatCurrency(totals.subtotal)}</span></div>
                <div class="row"><span>Discount / Promo</span><span>- ${formatCurrency(totals.discountAmount)}</span></div>
                <div class="row"><span>Vatable Sales</span><span>${formatCurrency(totals.vatableSales)}</span></div>
                <div class="row"><span>VAT (12%)</span><span>${formatCurrency(totals.vatAmount)}</span></div>
                <div class="row total"><span>Total Amount Due</span><span>${formatCurrency(totals.totalDue)}</span></div>
              </div>

              <div class="footer">This receipt is valid for tax and audit purposes. Thank you for choosing Speedway AutoxMoto Detail Studio.</div>
            </div>
          </div>
        </body>
      </html>
    `);
    popup.document.close();
    setTimeout(() => popup.print(), 300);
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '1rem',
        ...bodyFontStyle,
      }}
    >
      <div
        style={{
          width: 'min(95vw, 640px)',
          maxHeight: '85vh',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          boxShadow: '0 28px 70px rgba(0, 0, 0, 0.45)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          border: '1px solid rgba(17, 24, 39, 0.08)',
          color: '#111827',
        }}
      >
        <div
          className="no-print"
          style={{
            background: '#111827',
            borderBottom: '1px solid #262626',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            ...bodyFontStyle,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{ width: '1.5rem', height: '1.5rem', borderRadius: '9999px', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: '700', color: '#fff' }}>S</div>
            <div style={{ fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#f3f4f6' }}>{title}</div>
          </div>
          {showCloseButton && (
            <button
              onClick={onClose}
              aria-label="Close receipt"
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.18)',
                color: '#d4d4d8',
                cursor: 'pointer',
                width: '1.75rem',
                height: '1.75rem',
                borderRadius: '0.375rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
                lineHeight: 1,
              }}
            >
              ×
>>>>>>> e23099d5 (Logic inconsistencies still exists)
            </button>
          )}
        </div>

<<<<<<< HEAD
        {/* Scrollable body */}
        <div id="printable-receipt" style={{ overflowY: 'auto', flex: 1, overscrollBehavior: 'contain' }}>
          {receiptContent}
        </div>

        {/* Action footer */}
        <div className="action-buttons-container no-print" style={{ padding: '1rem 1.5rem', background: '#F9FAFB', borderTop: '1px solid #E5E7EB', display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
          <button onClick={handleDownloadPDF} style={{ ...btnSt('#111827'), flex: 1, justifyContent: 'center' }}><Download size={16} /> Download PDF</button>
          <button onClick={() => window.print()} style={{ ...btnSt('#374151', '#F3F4F6', '#111827'), flex: 1, justifyContent: 'center' }}><Printer size={16} /> Print</button>
          {onClose && (
            <button onClick={onClose} style={{ ...btnSt('transparent', '#fff', '#374151', '1px solid #E5E7EB'), flex: 0.6, justifyContent: 'center' }}>Close</button>
          )}
        </div>
      </div>
=======
        <div
          id="official-receipt-printable"
          style={{
            background: '#ffffff',
            color: '#111827',
            overflowY: 'auto',
            padding: '1.5rem 1.5rem 0',
            ...bodyFontStyle,
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '1.125rem', fontWeight: 800, letterSpacing: '0.24em', textTransform: 'uppercase', color: '#111827' }}>SPEEDWAY</div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#4b5563', marginTop: '0.35rem' }}>AutoxMoto Detail Studio</div>
            <div style={{ width: '3.5rem', height: '2px', background: '#111827', margin: '0.75rem auto 0' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem 1rem', marginBottom: '1.1rem' }}>
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>Receipt No.</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', ...bodyFontStyle }}>{receiptNumber || 'AUTO-' + Date.now().toString().slice(-6)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>Issued</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', ...bodyFontStyle }}>{issuedAt ? new Date(issuedAt).toLocaleString() : new Date().toLocaleString()}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem 1rem', marginBottom: '1.1rem' }}>
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>Business Details</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', marginBottom: '0.2rem' }}>AutoxMoto Detail Studio</div>
              <div style={{ fontSize: '0.75rem', color: '#4b5563' }}>123 Auto Avenue, Mandaluyong City</div>
              <div style={{ fontSize: '0.75rem', color: '#4b5563' }}>+63 917 123 4567 | hello@speedwaystudio.ph</div>
              <div style={{ fontSize: '0.75rem', color: '#4b5563' }}>VAT Reg. No. 000-123-456-000</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>Booking Reference</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', ...bodyFontStyle }}>{bookingReference || 'N/A'}</div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.7rem', marginBottom: '0.25rem' }}>Payment Method</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', ...bodyFontStyle }}>{paymentMethod}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem 1rem', marginBottom: '1.1rem' }}>
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>Customer</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{customerName}</div>
              <div style={{ fontSize: '0.75rem', color: '#4b5563', marginTop: '0.2rem' }}>{customerContact}</div>
              <div style={{ fontSize: '0.75rem', color: '#4b5563', marginTop: '0.1rem' }}>{customerAddress}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>Processed By</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{processedBy}</div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.7rem', marginBottom: '0.25rem' }}>Customer Tax ID</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{customerTaxId}</div>
            </div>
          </div>

          <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '420px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', background: '#f9fafb', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', padding: '0.55rem 0.75rem', fontSize: '0.6875rem', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Vehicle / Service</th>
                  <th style={{ textAlign: 'center', background: '#f9fafb', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', padding: '0.55rem 0.75rem', fontSize: '0.6875rem', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Qty</th>
                  <th style={{ textAlign: 'right', background: '#f9fafb', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', padding: '0.55rem 0.75rem', fontSize: '0.6875rem', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Unit Price</th>
                  <th style={{ textAlign: 'right', background: '#f9fafb', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', padding: '0.55rem 0.75rem', fontSize: '0.6875rem', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {safeItems.map((item, idx) => (
                  <tr key={`${item.vehicle || item.service || 'row'}-${idx}`}>
                    <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.7rem 0.75rem', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.8125rem' }}>{item.vehicle || 'Vehicle Unit'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.2rem' }}>{item.service || 'Service Description'}</div>
                    </td>
                    <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.7rem 0.75rem', textAlign: 'center', fontWeight: 600, fontSize: '0.8125rem', ...bodyFontStyle }}>{item.qty ?? 1}</td>
                    <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.7rem 0.75rem', textAlign: 'right', fontWeight: 500, fontSize: '0.8125rem', ...bodyFontStyle }}>{formatCurrency(item.unitPrice ?? item.lineTotal ?? 0)}</td>
                    <td style={{ borderBottom: '1px solid #e5e7eb', padding: '0.7rem 0.75rem', textAlign: 'right', fontWeight: 700, fontSize: '0.8125rem', ...bodyFontStyle }}>{formatCurrency(item.lineTotal ?? item.unitPrice ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ maxWidth: '19rem', marginLeft: 'auto', paddingTop: '0.9rem', borderTop: '2px solid #111827' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem', color: '#4b5563', fontSize: '0.8125rem' }}>
              <span>Subtotal</span>
              <span style={{ ...bodyFontStyle }}>{formatCurrency(totals.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem', color: '#4b5563', fontSize: '0.8125rem' }}>
              <span>Discount / Promo</span>
              <span style={{ ...bodyFontStyle }}>- {formatCurrency(totals.discountAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem', color: '#4b5563', fontSize: '0.8125rem' }}>
              <span>Vatable Sales</span>
              <span style={{ ...bodyFontStyle }}>{formatCurrency(totals.vatableSales)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem', color: '#4b5563', fontSize: '0.8125rem' }}>
              <span>VAT (12%)</span>
              <span style={{ ...bodyFontStyle }}>{formatCurrency(totals.vatAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>
              <span>Total Amount Due</span>
              <span style={{ fontSize: '1.125rem', fontWeight: 800, color: '#111827', ...bodyFontStyle }}>{formatCurrency(totals.totalDue)}</span>
            </div>
          </div>
        </div>

        <div
          className="no-print"
          style={{
            background: '#111827',
            borderTop: '1px solid #262626',
            padding: '0.9rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            flexWrap: 'wrap',
            ...bodyFontStyle,
          }}
        >
          <button
            onClick={handleDownloadPdf}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1rem',
              borderRadius: '0.5rem',
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Download PDF
          </button>
          {showCloseButton && (
            <button
              onClick={onClose}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.65rem 1rem',
                borderRadius: '0.5rem',
                background: '#262626',
                color: '#d4d4d8',
                border: '1px solid #404040',
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #official-receipt-printable, #official-receipt-printable * { visibility: visible; }
          #official-receipt-printable { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
        @media (max-width: 640px) {
          .modal-overlay { padding: 0.5rem !important; }
         }
      `}</style>
>>>>>>> e23099d5 (Logic inconsistencies still exists)
    </div>
  );
};

<<<<<<< HEAD
const btnSt = (bg, hoverBg, color = '#fff', border = 'none') => ({
  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
  padding: '0.65rem 1.25rem', background: bg, color,
  border, borderRadius: '4px', fontWeight: '800', fontSize: '0.78rem',
  cursor: 'pointer', letterSpacing: '0.5px', textTransform: 'uppercase', transition: 'all 0.2s',
});

=======
>>>>>>> e23099d5 (Logic inconsistencies still exists)
export default OfficialReceipt;
