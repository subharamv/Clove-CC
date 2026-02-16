import { supabase } from '../supabaseClient';
import { SystemSettings } from '../types';

export interface SystemSetting {
  setting_key: string;
  setting_value: string;
  setting_type: string;
  description: string;
}

class SettingsService {
  // Load settings from database for current user
  static async loadSettings(): Promise<SystemSettings> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        return this.getSettingsFromLocalStorage();
      }

      const { data, error } = await supabase
        .from('system_settings')
        .select('*');

      if (error) {
        console.error('Error loading settings from DB:', error);
        return this.getSettingsFromLocalStorage();
      }

      if (!data || data.length === 0) {
        // No settings yet, use defaults or localStorage
        return this.getSettingsFromLocalStorage();
      }

      // Parse settings data from the setting_value and setting_type structure
      const settings: SystemSettings = {
        prefix: data.find((s: any) => s.setting_key === 'prefix')?.setting_value || 'CLV-',
        startNumber: parseInt(data.find((s: any) => s.setting_key === 'start_number')?.setting_value || '1001'),
        suffix: data.find((s: any) => s.setting_key === 'suffix')?.setting_value || '',
        amount: parseFloat(data.find((s: any) => s.setting_key === 'amount')?.setting_value || '50.00'),
        validityPeriod: parseInt(data.find((s: any) => s.setting_key === 'validity_period')?.setting_value || '30'),
        useFixedDate: data.find((s: any) => s.setting_key === 'use_fixed_date')?.setting_value === 'true',
        fixedDate: data.find((s: any) => s.setting_key === 'fixed_date')?.setting_value || '',
        backgroundTemplate: data.find((s: any) => s.setting_key === 'background_template')?.setting_value || 'https://images.unsplash.com/photo-1495521821757-ac1bb6849e8a?w=800&q=80',
        templateElements: (() => {
          const found = data.find((s: any) => s.setting_key === 'template_elements');
          if (found && found.setting_value) {
            try {
              return JSON.parse(found.setting_value);
            } catch (e) {
              console.warn('Failed to parse template_elements JSON', e);
              return undefined;
            }
          }
          return undefined;
        })(),
        qrEnabled: data.find((s: any) => s.setting_key === 'qr_enabled')?.setting_value === 'true',
        couponAmounts: (() => {
          const found = data.find((s: any) => s.setting_key === 'coupon_amounts');
          if (found && found.setting_value) {
            try {
              return JSON.parse(found.setting_value);
            } catch (e) {
              console.warn('Failed to parse coupon_amounts JSON', e);
              return undefined;
            }
          }
          return undefined;
        })(),
        amountVisible: data.find((s: any) => s.setting_key === 'amount_visible')?.setting_value !== 'false'
      };

      this.saveSettingsToLocalStorage(settings);
      return settings;
    } catch (err) {
      console.error('Settings Service Load Error:', err);
      return this.getSettingsFromLocalStorage();
    }
  }

  // Save all settings
  static async saveSettings(settings: SystemSettings): Promise<boolean> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return false;

      const settingsData = [
        { setting_key: 'prefix', setting_value: settings.prefix, setting_type: 'string' },
        { setting_key: 'start_number', setting_value: settings.startNumber.toString(), setting_type: 'number' },
        { setting_key: 'suffix', setting_value: settings.suffix, setting_type: 'string' },
        { setting_key: 'amount', setting_value: settings.amount.toString(), setting_type: 'string' },
        { setting_key: 'validity_period', setting_value: settings.validityPeriod.toString(), setting_type: 'number' },
        { setting_key: 'use_fixed_date', setting_value: settings.useFixedDate.toString(), setting_type: 'boolean' },
        { setting_key: 'fixed_date', setting_value: settings.fixedDate || '', setting_type: 'string' },
        { setting_key: 'background_template', setting_value: settings.backgroundTemplate, setting_type: 'string' },
        { setting_key: 'template_elements', setting_value: settings.templateElements ? JSON.stringify(settings.templateElements) : '', setting_type: 'json' },
        { setting_key: 'qr_enabled', setting_value: (settings.qrEnabled || false).toString(), setting_type: 'boolean' },
        { setting_key: 'coupon_amounts', setting_value: settings.couponAmounts ? JSON.stringify(settings.couponAmounts) : '', setting_type: 'json' },
        { setting_key: 'amount_visible', setting_value: (settings.amountVisible !== false).toString(), setting_type: 'boolean' }
      ];

      const { error } = await supabase.rpc('update_multiple_settings', {
        settings_data: settingsData
      });

      if (error) {
        console.error('Error saving settings to DB:', error);
        return false;
      }

      this.saveSettingsToLocalStorage(settings);
      return true;
    } catch (err) {
      console.error('Settings Service Save Error:', err);
      return false;
    }
  }

  // Get settings from localStorage (fallback)
  static getSettingsFromLocalStorage(): SystemSettings {
    try {
      const saved = localStorage.getItem('settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure all required fields exist
        return {
          prefix: parsed.prefix || 'CLV-',
          startNumber: parsed.startNumber || 1001,
          suffix: parsed.suffix || '',
          amount: parsed.amount || 50.00,
          validityPeriod: parsed.validityPeriod || 30,
          useFixedDate: parsed.useFixedDate || false,
          fixedDate: parsed.fixedDate || '',
          backgroundTemplate: parsed.backgroundTemplate || 'https://images.unsplash.com/photo-1495521821757-ac1bb6849e8a?w=800&q=80',
          templateElements: parsed.templateElements,
          qrEnabled: parsed.qrEnabled || false,
          couponAmounts: parsed.couponAmounts,
          amountVisible: parsed.amountVisible !== false
        };
      }
    } catch (err) {
      console.warn('Failed to load settings from localStorage:', err);
    }

    return {
      prefix: 'CLV-',
      startNumber: 1001,
      suffix: '',
      amount: 50.00,
      validityPeriod: 30,
      useFixedDate: false,
      fixedDate: '',
      backgroundTemplate: 'https://images.unsplash.com/photo-1495521821757-ac1bb6849e8a?w=800&q=80',
      templateElements: undefined,
      qrEnabled: false,
      couponAmounts: undefined,
      amountVisible: true
    };
  }

  // Save settings to localStorage
  static saveSettingsToLocalStorage(settings: SystemSettings): void {
    try {
      localStorage.setItem('settings', JSON.stringify(settings));
    } catch (err) {
      console.error('Failed to save settings to localStorage:', err);
    }
  }
}

export default SettingsService;