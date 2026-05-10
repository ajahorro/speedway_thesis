import React from 'react';

const BrandLogo = ({ width = '150px', height = 'auto' }) => (
  <div style={{ width, height, background: 'var(--admin-brand)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
    SPEEDWAY
  </div>
);

export default BrandLogo;
