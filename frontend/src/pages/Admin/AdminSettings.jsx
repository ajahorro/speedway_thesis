import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { VEHICLE_TYPE_OPTIONS } from '../../config/constants';
import { 
  Save, Upload, Clock, CreditCard, Sparkles, MapPin, 
  Building2, QrCode, Trash2, Gauge, Tag, RefreshCcw, X, Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/PageHeader';
import { useTheme } from '../../context/ThemeContext';
import { useConfig } from '../../context/ConfigContext';
import { useAuth } from '../../hooks/useAuth';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { logger } from '../../utils/logger';

const AdminSettings = () => {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { refreshConfig } = useConfig();
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [customServices, setCustomServices] = useState([]);
  const [promoRules, setPromoRules] = useState([]);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [newService, setNewService] = useState({ name: '', price: '', description: '', durationMinutes: '60' });

  
  const [settings, setSettings] = useState({
    business_name: '',
    contact_number: '',
    email_address: '',
    business_address: '',
    opening_hour: '',
    closing_hour: '',
    payment_account_number: '',
    payment_account_name: '',
    payment_qr_url: '',
    slots_per_hour: 2,
    max_vehicles_per_staff: 4
  });

  // Helper to convert "08:00 AM" to "08:00" for time input
  const formatForInput = (timeStr) => {
    if (!timeStr) return "08:00";
    if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
    const parts = timeStr.split(' ');
    if (parts.length !== 2) return timeStr;
    const [time, modifier] = parts;
    let [hours, minutes] = time.split(':');
    if (modifier === 'PM' && hours !== '12') hours = parseInt(hours, 10) + 12;
    if (modifier === 'AM' && hours === '12') hours = '00';
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  };

  const fetchSettings = async () => {
    setFetching(true);
    try {
      logger.admin('Fetching global studio configuration...');
      const { data, error } = await supabase
        .from('business_config')
        .select('*')
        .limit(1)
        .single();

      if (error) {
        // Fallback to local storage
        const saved = localStorage.getItem('speedway_business_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          setSettings(prev => ({ 
            ...prev, 
            ...parsed,
            opening_hour: formatForInput(parsed.opening_hour),
            closing_hour: formatForInput(parsed.closing_hour),
            max_vehicles_per_staff: Number(parsed.max_vehicles_per_staff) || 4
          }));
        }
        logger.warn('Using local settings fallback.');
      } else {
        setSettings({
          ...data,
          payment_account_number: data.payment_account_number || data.gcash_number || '',
          payment_account_name: data.payment_account_name || data.gcash_name || '',
          payment_qr_url: data.payment_qr_url || data.gcash_qr_url || '',
          opening_hour: formatForInput(data.opening_hour),
          closing_hour: formatForInput(data.closing_hour),
          max_vehicles_per_staff: Number(data.max_vehicles_per_staff) || 4
        });
        logger.admin('Global studio parameters synchronized.');
      }

      const storedServices = JSON.parse(localStorage.getItem('speedway_custom_services') || '[]');
      const storedRules = JSON.parse(localStorage.getItem('speedway_promo_rules') || '[]');
      setCustomServices(Array.isArray(storedServices) ? storedServices : []);
      setPromoRules(Array.isArray(storedRules) ? storedRules : []);
    } catch (err) {
      logger.error('Fetch Settings Error', err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      logger.admin('Updating global business parameters...');

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user) throw new Error('No active admin session. Please sign in again.');
      if (profile?.role?.toUpperCase() !== 'ADMIN') throw new Error('Admin access is required to save company settings.');
      
      const { error } = await supabase
        .from('business_config')
        .upsert({
          id: settings.id || 1,
          business_name: settings.business_name,
          contact_number: settings.contact_number,
          email_address: settings.email_address,
          business_address: settings.business_address,
          opening_hour: settings.opening_hour,
          closing_hour: settings.closing_hour,
          payment_account_number: settings.payment_account_number,
          payment_account_name: settings.payment_account_name,
          payment_qr_url: settings.payment_qr_url,
          gcash_number: settings.payment_account_number,
          gcash_name: settings.payment_account_name,
          gcash_qr_url: settings.payment_qr_url,
          slots_per_hour: settings.slots_per_hour,
          max_vehicles_per_staff: Number(settings.max_vehicles_per_staff) || 4,
          promo_rules: promoRules,
          custom_services: customServices,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      localStorage.setItem('speedway_business_settings', JSON.stringify({ ...settings, max_vehicles_per_staff: Number(settings.max_vehicles_per_staff) || 4 }));
      localStorage.setItem('speedway_custom_services', JSON.stringify(customServices));
      localStorage.setItem('speedway_promo_rules', JSON.stringify(promoRules));
      await refreshConfig();
      toast.success('Global settings updated successfully!');
      logger.admin('Global parameters committed to database.');
    } catch (err) {
      logger.error('Settings Save Error', err);
      toast.error('Failed to sync with database.');
    } finally {
      setLoading(false);
    }
  };

  const addCustomService = () => {
    if (!newService.name.trim()) {
      toast.error('Service name is required.');
      return;
    }

    const item = {
      id: editingServiceId || `custom_${Date.now()}`,
      name: newService.name.trim(),
      price: Number(newService.price) || 0,
      description: newService.description.trim() || 'Admin-added service',
      durationMinutes: Number(newService.durationMinutes) || 60,
      archived: false,
      updatedAt: new Date().toISOString()
    };

    const nextServices = editingServiceId
      ? customServices.map(service => service.id === editingServiceId ? item : service)
      : [...customServices, item];

    setCustomServices(nextServices);
    localStorage.setItem('speedway_custom_services', JSON.stringify(nextServices));
    setNewService({ name: '', price: '', description: '', durationMinutes: '60' });
    setEditingServiceId(null);
    toast.success(editingServiceId ? 'Service updated.' : 'Service saved to the active catalog.');
  };

  const editCustomService = (service) => {
    setEditingServiceId(service.id);
    setNewService({
      name: service.name || '',
      price: String(service.price || ''),
      description: service.description || '',
      durationMinutes: String(service.durationMinutes || 60)
    });
  };

  const removeCustomService = (id) => {
    const nextServices = customServices.map(service => service.id === id ? { ...service, archived: true, archivedAt: new Date().toISOString() } : service);
    setCustomServices(nextServices);
    localStorage.setItem('speedway_custom_services', JSON.stringify(nextServices));
    toast.success('Service archived while preserving historical booking snapshots.');
  };


  const removePromoRule = (id) => {
    const nextRules = promoRules.filter(rule => rule.id !== id);
    setPromoRules(nextRules);
    localStorage.setItem('speedway_promo_rules', JSON.stringify(nextRules));
    toast.success('Promo rule removed.');
  };

  const handleQRUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSettings(prev => ({ ...prev, payment_qr_url: reader.result }));
      toast.success('QR Code loaded. Save to persist.');
    };
    reader.readAsDataURL(file);
  };

  const removeQR = () => {
    setSettings(prev => ({ ...prev, payment_qr_url: '' }));
    toast.success('QR Code cleared.');
  };

  const vehicleMatrixColumns = [
    { key: 'Sedan', label: 'Sedan' },
    { key: 'SUV', label: 'SUV' },
    { key: 'Van/L300', label: 'Van / L300' },
    { key: 'Motorcycle Regular', label: 'Moto Reg' },
    { key: 'Bigbike', label: 'Bigbike' }
  ];

  const matrixFallbackServices = [
    { id: 'svc-1', name: 'Supreme Wash', category: 'Wash & Exterior', archived: false, description: 'Signature exterior wash', pricing: { Sedan: { price: 350, duration: 45 }, SUV: { price: 450, duration: 60 }, 'Van/L300': { price: 600, duration: 75 }, 'Motorcycle Regular': { price: 220, duration: 30 }, Bigbike: { price: 260, duration: 35 } } },
    { id: 'svc-2', name: 'Engine Degreasing', category: 'Wash & Exterior', archived: false, description: 'Engine bay cleanup', pricing: { Sedan: { price: 500, duration: 30 }, SUV: { price: 600, duration: 30 }, 'Van/L300': { price: 800, duration: 45 }, 'Motorcycle Regular': { price: 280, duration: 25 }, Bigbike: { price: 320, duration: 30 } } },
    { id: 'svc-3', name: 'Ceramic Boost', category: 'Protection', archived: false, description: 'Surface protection layer', pricing: { Sedan: { price: 1800, duration: 120 }, SUV: { price: 2200, duration: 150 }, 'Van/L300': { price: 2600, duration: 180 }, 'Motorcycle Regular': { price: 1200, duration: 90 }, Bigbike: { price: 1400, duration: 105 } } },
    { id: 'svc-4', name: 'Interior Refresh', category: 'Interior Detailing', archived: false, description: 'Vacuum and upholstery reset', pricing: { Sedan: { price: 700, duration: 60 }, SUV: { price: 900, duration: 75 }, 'Van/L300': { price: 1200, duration: 90 }, 'Motorcycle Regular': { price: 390, duration: 35 }, Bigbike: { price: 450, duration: 45 } } },
    { id: 'svc-5', name: 'Paint Correction', category: 'Protection', archived: true, description: 'Advanced correction pass', pricing: { Sedan: { price: 3200, duration: 180 }, SUV: { price: 3900, duration: 210 }, 'Van/L300': { price: 4600, duration: 240 }, 'Motorcycle Regular': { price: 2200, duration: 150 }, Bigbike: { price: 2600, duration: 180 } } }
  ];

  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedVehicleTab, setSelectedVehicleTab] = useState('All');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [showNewServiceForm, setShowNewServiceForm] = useState(false);
  const [showArchivedDrawer, setShowArchivedDrawer] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({
    'Wash & Exterior': true,
    'Interior Detailing': true,
    Protection: true,
    'General Services': true
  });

  const normalizedServiceRows = (customServices.length ? customServices : matrixFallbackServices).map(service => ({
    id: service.id,
    name: service.name,
    category: service.category || 'General Services',
    archived: Boolean(service.archived),
    description: service.description || 'Admin-added service',
    pricing: service.pricing || {
      Sedan: { price: Number(service.price || 0), duration: Number(service.durationMinutes || 60) },
      SUV: { price: Number(service.price || 0), duration: Number(service.durationMinutes || 60) },
      'Van/L300': { price: Number(service.price || 0), duration: Number(service.durationMinutes || 60) },
      'Motorcycle Regular': { price: Number(service.price || 0), duration: Number(service.durationMinutes || 60) },
      Bigbike: { price: Number(service.price || 0), duration: Number(service.durationMinutes || 60) }
    }
  }));

  const allCategories = Array.from(new Set(normalizedServiceRows.map(service => service.category)));

  const filteredServices = normalizedServiceRows.filter(service => {
    const searchMatch = !serviceSearch || service.name.toLowerCase().includes(serviceSearch.toLowerCase()) || service.description.toLowerCase().includes(serviceSearch.toLowerCase());
    const categoryMatch = selectedCategoryFilter === 'All' || service.category === selectedCategoryFilter;
    return searchMatch && categoryMatch && (!service.archived || showArchivedDrawer);
  });

  const categoryGroups = allCategories.map(category => ({
    title: category,
    services: filteredServices.filter(service => service.category === category)
  })).filter(group => group.services.length > 0);

  const archivedServices = normalizedServiceRows.filter(service => service.archived);

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const sectionStyle = {
    background: 'var(--admin-card)',
    borderRadius: '4px',
    border: '1px solid var(--admin-border)',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    color: 'var(--admin-text-primary)'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.65rem',
    fontWeight: '950',
    color: 'var(--admin-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '0.5rem'
  };

  const inputStyle = {
    width: '100%',
    padding: '0.75rem 1rem',
    background: 'var(--admin-bg)',
    border: '1px solid var(--admin-border)',
    borderRadius: '4px',
    color: 'var(--admin-text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
    fontWeight: '700'
  };

  if (fetching) return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--admin-text-secondary)', fontWeight: '950' }}>SYNCHRONIZING STUDIO PARAMETERS...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem' }}>
      <PageHeader 
        badge="STUDIO CONFIGURATION"
        title="Business Settings and Logistics"
        subtitle="Operational parameters, business hours, and payment infrastructure."
        onRefresh={fetchSettings}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'stretch' }}>
        
        {/* Business Settings Module */}
        <div style={{ ...sectionStyle, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Building2 size={20} color="var(--admin-brand)" />
            <h2 style={{ fontSize: '1rem', fontWeight: '950', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Business Settings</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
            <div>
              <label style={labelStyle}>Business Name</label>
              <input 
                type="text" 
                value={settings.business_name}
                onChange={(e) => setSettings({...settings, business_name: e.target.value})}
                style={inputStyle} 
              />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Contact Number</label>
                <input 
                  type="text" 
                  value={settings.contact_number}
                  onChange={(e) => setSettings({...settings, contact_number: e.target.value})}
                  style={inputStyle} 
                />
              </div>
              <div>
                <label style={labelStyle}>Email Address</label>
                <input 
                  type="email" 
                  value={settings.email_address}
                  onChange={(e) => setSettings({...settings, email_address: e.target.value})}
                  style={inputStyle} 
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Business Address</label>
              <textarea 
                value={settings.business_address}
                onChange={(e) => setSettings({...settings, business_address: e.target.value})}
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }} 
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Opening Hour</label>
                <input 
                  type="time" 
                  value={settings.opening_hour}
                  onChange={(e) => setSettings({...settings, opening_hour: e.target.value})}
                  style={inputStyle} 
                />
              </div>
              <div>
                <label style={labelStyle}>Closing Hour</label>
                <input 
                  type="time" 
                  value={settings.closing_hour}
                  onChange={(e) => setSettings({...settings, closing_hour: e.target.value})}
                  style={inputStyle} 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem', borderTop: '1px solid var(--admin-border)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Gauge size={20} color="var(--admin-brand)" />
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Maximum Concurrent Bookings</label>
                  <input 
                    type="number" 
                    min="1" max="10"
                    value={settings.slots_per_hour || 2}
                    onChange={(e) => setSettings({...settings, slots_per_hour: parseInt(e.target.value)})}
                    style={{ ...inputStyle, width: '80px', textAlign: 'center', fontSize: '1.25rem' }} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Users size={20} color="var(--admin-brand)" />
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Max Units / Vehicles Per Staff</label>
                  <input 
                    type="number" 
                    min="1" max="12"
                    value={settings.max_vehicles_per_staff || 4}
                    onChange={(e) => setSettings({...settings, max_vehicles_per_staff: Math.max(1, parseInt(e.target.value) || 1)})}
                    style={{ ...inputStyle, width: '80px', textAlign: 'center', fontSize: '1.25rem' }} 
                  />
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--admin-border)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Sparkles size={20} color="var(--admin-brand)" />
                <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '950', textTransform: 'uppercase' }}>Dynamic Service Management</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 0.8fr 0.8fr', gap: '0.75rem' }}>
                <input
                  type="text"
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  placeholder="Search services..."
                  style={inputStyle}
                />
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  style={inputStyle}
                >
                  <option value="All">Filter Category: All</option>
                  {allCategories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewServiceForm(prev => !prev)}
                  style={{ background: 'var(--admin-brand)', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                >
                  {showNewServiceForm ? 'Close' : '+ Create New Service'}
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {['All', ...vehicleMatrixColumns.map(v => v.key)].map(vehicle => (
                  <button
                    key={vehicle}
                    type="button"
                    onClick={() => setSelectedVehicleTab(vehicle)}
                    style={{
                      padding: '0.45rem 0.72rem',
                      borderRadius: '4px',
                      border: `1px solid ${selectedVehicleTab === vehicle ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
                      background: selectedVehicleTab === vehicle ? 'var(--admin-brand)' : 'var(--admin-bg)',
                      color: selectedVehicleTab === vehicle ? '#fff' : 'var(--admin-text-primary)',
                      fontSize: '0.64rem',
                      fontWeight: '950',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      cursor: 'pointer'
                    }}
                  >
                    {vehicle}
                  </button>
                ))}
              </div>

              {showNewServiceForm && (
                <div style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '4px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.3fr 0.7fr 0.7fr 0.7fr', gap: '0.75rem' }}>
                    <input type="text" placeholder="Service name" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} style={inputStyle} />
                    <input type="number" min="0" placeholder="Price" value={newService.price} onChange={(e) => setNewService({ ...newService, price: e.target.value })} style={inputStyle} />
                    <input type="number" min="15" step="15" placeholder="Minutes" value={newService.durationMinutes} onChange={(e) => setNewService({ ...newService, durationMinutes: e.target.value })} style={inputStyle} />
                    <button type="button" onClick={addCustomService} style={{ background: 'var(--admin-brand)', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: '950', cursor: 'pointer' }}>{editingServiceId ? 'Update' : 'Add'}</button>
                  </div>
                  <textarea placeholder="Service details / description" value={newService.description} onChange={(e) => setNewService({ ...newService, description: e.target.value })} style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} />
                </div>
              )}

              {categoryGroups.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  {categoryGroups.map(group => (
                    <div key={group.title} style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '6px', overflow: 'hidden' }}>
                      <button
                        type="button"
                        onClick={() => toggleCategory(group.title)}
                        style={{ width: '100%', background: 'transparent', border: 'none', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: 'var(--admin-text-primary)', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.68rem' }}
                      >
                        <span>{group.title} ({group.services.length} Services)</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>Select All Category</span>
                          <span>{expandedCategories[group.title] ? '▾' : '▸'}</span>
                        </span>
                      </button>

                      {expandedCategories[group.title] && (
                        <div style={{ overflowX: 'auto', borderTop: '1px solid var(--admin-border)' }}>
                          <div style={{ minWidth: '760px', display: 'grid', gridTemplateColumns: 'minmax(180px, 1.7fr) repeat(5, minmax(120px, 1fr)) 110px', background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ padding: '0.7rem 0.75rem', fontSize: '0.62rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--admin-text-secondary)', borderRight: '1px solid var(--admin-border)' }}>Service Name</div>
                            {vehicleMatrixColumns.map(vehicle => (
                              <div key={vehicle.key} style={{ padding: '0.7rem 0.5rem', textAlign: 'center', fontSize: '0.62rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '0.08em', color: selectedVehicleTab === vehicle.key || selectedVehicleTab === 'All' ? 'var(--admin-text-primary)' : 'var(--admin-text-secondary)', borderRight: '1px solid var(--admin-border)' }}>
                                {vehicle.label}
                              </div>
                            ))}
                            <div style={{ padding: '0.7rem 0.5rem', textAlign: 'center', fontSize: '0.62rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--admin-text-secondary)' }}>Actions</div>

                            {group.services.map(service => (
                              <>
                                <div key={`${service.id}-name`} style={{ padding: '0.8rem 0.75rem', borderTop: '1px solid var(--admin-border)', borderRight: '1px solid var(--admin-border)', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                  <span style={{ fontWeight: '900', color: 'var(--admin-text-primary)' }}>{service.name}</span>
                                  <span style={{ fontSize: '0.58rem', color: 'var(--admin-text-secondary)' }}>{service.description}</span>
                                </div>
                                {vehicleMatrixColumns.map(vehicle => {
                                  const rate = service.pricing[vehicle.key] || { price: 0, duration: 0 };
                                  const isActive = selectedVehicleTab === 'All' || selectedVehicleTab === vehicle.key;
                                  return (
                                    <div key={`${service.id}-${vehicle.key}`} style={{ padding: '0.8rem 0.5rem', textAlign: 'center', borderTop: '1px solid var(--admin-border)', borderRight: '1px solid var(--admin-border)', background: isActive ? 'rgba(255,255,255,0.02)' : 'transparent', color: 'var(--admin-text-primary)', fontSize: '0.7rem', fontWeight: '800' }}>
                                      ₱{Number(rate.price || 0).toLocaleString()}<br />
                                      <span style={{ color: 'var(--admin-text-secondary)', fontSize: '0.56rem' }}>{Number(rate.duration || 0)}m</span>
                                    </div>
                                  );
                                })}
                                <div key={`${service.id}-actions`} style={{ padding: '0.8rem 0.5rem', borderTop: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}>
                                  <button type="button" onClick={() => editCustomService({ ...service, price: service.pricing.Sedan?.price || 0, durationMinutes: service.pricing.Sedan?.duration || 60 })} style={{ border: '1px solid var(--admin-border)', background: 'transparent', color: 'var(--admin-text-primary)', padding: '0.35rem 0.45rem', borderRadius: '4px', fontWeight: '900', cursor: 'pointer', fontSize: '0.56rem' }}>✏️</button>
                                  <button type="button" onClick={() => removeCustomService(service.id)} style={{ border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', padding: '0.35rem 0.45rem', borderRadius: '4px', fontWeight: '900', cursor: 'pointer', fontSize: '0.56rem' }}>🗑️</button>
                                </div>
                              </>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '4px', padding: '1rem', color: 'var(--admin-text-secondary)', fontSize: '0.72rem' }}>
                  No services match the current search and filter settings.
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--admin-border)', paddingTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowArchivedDrawer(prev => !prev)}
                  style={{ width: '100%', background: 'transparent', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', borderRadius: '4px', padding: '0.7rem 0.9rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer' }}
                >
                  Archived Services: {archivedServices.length} {showArchivedDrawer ? '▾' : '▸'}
                </button>

                {showArchivedDrawer && archivedServices.length > 0 && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {archivedServices.map(service => (
                      <div key={service.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '4px', padding: '0.7rem 0.8rem' }}>
                        <div>
                          <div style={{ fontWeight: '950' }}>{service.name}</div>
                          <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.68rem' }}>{service.category}</div>
                        </div>
                        <button type="button" onClick={() => { const restored = normalizedServiceRows.find(item => item.id === service.id); if (restored) { const next = customServices.map(item => item.id === service.id ? { ...item, archived: false } : item); setCustomServices(next); localStorage.setItem('speedway_custom_services', JSON.stringify(next)); toast.success(`${service.name} restored.`); } }} style={{ border: '1px solid var(--admin-border)', background: 'transparent', color: 'var(--admin-text-primary)', padding: '0.4rem 0.7rem', borderRadius: '4px', fontWeight: '900', cursor: 'pointer' }}>Restore</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button 
              onClick={handleSave}
              disabled={loading}
              style={{ 
                marginTop: '1rem', padding: '0.85rem', background: 'var(--admin-brand)', 
                color: 'white', borderRadius: '4px', fontSize: '0.75rem', 
                fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase'
              }}
            >
              {loading ? 'SYNCHRONIZING...' : 'COMMIT CHANGES'}
            </button>
          </div>
        </div>

        {/* Payment & Infrastructure */}
        <div style={{ ...sectionStyle, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <CreditCard size={20} color="var(--admin-brand)" />
            <h2 style={{ fontSize: '1rem', fontWeight: '950', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Payment Infrastructure</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>GCash Number</label>
              <input 
                type="text" 
                value={settings.payment_account_number}
                onChange={(e) => setSettings({...settings, payment_account_number: e.target.value})}
                style={inputStyle} 
              />
            </div>
            <div>
              <label style={labelStyle}>Account Name</label>
              <input 
                type="text" 
                value={settings.payment_account_name}
                onChange={(e) => setSettings({...settings, payment_account_name: e.target.value})}
                style={inputStyle} 
              />
            </div>
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <label style={labelStyle}>Payment QR Code</label>
            {settings.payment_qr_url ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', background: 'var(--admin-bg)', padding: '1.5rem', borderRadius: '4px', border: '1px dashed var(--admin-border)' }}>
                <img src={settings.payment_qr_url} alt="Payment QR" style={{ maxWidth: '200px', height: 'auto', borderRadius: '4px' }} />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <label style={{ padding: '0.6rem 1.25rem', background: 'var(--admin-brand)', color: 'white', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '900', cursor: 'pointer', textTransform: 'uppercase' }}>
                    REPLACE
                    <input type="file" onChange={handleQRUpload} style={{ display: 'none' }} accept="image/*" />
                  </label>
                  <button onClick={removeQR} style={{ padding: '0.6rem 1.25rem', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '900', cursor: 'pointer', textTransform: 'uppercase' }}>
                    REMOVE
                  </button>
                </div>
              </div>
            ) : (
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '3rem', border: '2px dashed var(--admin-border)', borderRadius: '4px', cursor: 'pointer' }}>
                <Upload size={32} style={{ opacity: 0.2 }} />
                <span style={{ fontSize: '0.75rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Upload QR Code</span>
                <input type="file" onChange={handleQRUpload} style={{ display: 'none' }} accept="image/*" />
              </label>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--admin-border)', paddingTop: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <Sparkles size={20} color="var(--admin-brand)" />
              <h3 style={{ fontSize: '0.85rem', fontWeight: '950', margin: 0, textTransform: 'uppercase' }}>System Appearance</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              {['system', 'light', 'dark'].map(t => (
                <button
                  key={t}
                  onClick={() => toggleTheme(t)}
                  style={{
                    padding: '0.75rem', background: theme === t ? 'var(--admin-brand)' : 'var(--admin-bg)',
                    color: theme === t ? '#fff' : 'var(--admin-text-primary)',
                    border: '1px solid var(--admin-border)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase'
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminSettings;
