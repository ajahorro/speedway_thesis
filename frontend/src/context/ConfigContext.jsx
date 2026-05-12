import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SHOP_CONFIG } from '../config/constants';
import { logger } from '../utils/logger';

const ConfigContext = createContext();

export const ConfigProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    MAX_BAYS: SHOP_CONFIG.MAX_BAYS,
    OPENING_HOUR: SHOP_CONFIG.OPENING_HOUR,
    CLOSING_HOUR: SHOP_CONFIG.CLOSING_HOUR,
    BUSINESS_NAME: 'SPEEDWAY STUDIO',
    GCASH_NAME: 'SPEEDWAY STUDIO',
    GCASH_NUMBER: '0912 345 6789',
    GCASH_QR_URL: null,
    loaded: false
  });

  const parseHour = (timeStr, defaultHour) => {
    if (!timeStr) return defaultHour;
    try {
      const upperTime = timeStr.toUpperCase();
      // Handle "08:00 AM" or "17:00"
      if (!upperTime.includes('AM') && !upperTime.includes('PM')) {
        return parseInt(upperTime.split(':')[0], 10);
      }
      const [time, modifier] = upperTime.split(' ');
      let [h] = time.split(':');
      h = parseInt(h, 10);
      if (modifier === 'PM' && h < 12) h += 12;
      if (modifier === 'AM' && h === 12) h = 0;
      return h;
    } catch (e) {
      return defaultHour;
    }
  };

  const refreshConfig = async () => {
    try {
      logger.admin('Synchronizing live shop configuration...');
      const { data, error } = await supabase
        .from('business_config')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          MAX_BAYS: data.slots_per_hour || SHOP_CONFIG.MAX_BAYS,
          OPENING_HOUR: parseHour(data.opening_hour, SHOP_CONFIG.OPENING_HOUR),
          CLOSING_HOUR: parseHour(data.closing_hour, SHOP_CONFIG.CLOSING_HOUR),
          BUSINESS_NAME: data.business_name || 'SPEEDWAY STUDIO',
          GCASH_NAME: data.gcash_name || 'SPEEDWAY STUDIO',
          GCASH_NUMBER: data.gcash_number || '0912 345 6789',
          GCASH_QR_URL: data.gcash_qr_url || null,
          loaded: true
        });
      } else {
        // Table is empty, use defaults and mark as loaded
        setSettings(prev => ({ ...prev, loaded: true }));
        logger.warn('Business configuration is empty. Using defaults.');
      }
    } catch (err) {
      logger.error('Config Sync Error', err);
      setSettings(prev => ({ ...prev, loaded: true })); // Proceed with defaults
    }
  };

  useEffect(() => {
    refreshConfig();

    // REAL-TIME SYNC: Listen for live updates to business settings
    const channel = supabase
      .channel('public:business_config')
      .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'business_config' }, 
          () => {
            logger.admin('Live configuration update detected. Synchronizing...');
            refreshConfig();
          }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <ConfigContext.Provider value={{ settings, refreshConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) throw new Error('useConfig must be used within a ConfigProvider');
  return context;
};
