import React, { useState, useEffect } from 'react';
import { SystemSettings, TemplateElement, CouponAmountConfig } from '../types';
import { supabase } from '../supabaseClient';
import { uploadCouponTemplate } from '../storageSetup';
import SettingsService from '../utils/settingsService';
import { formatRupees, getRupeeSymbol } from '../utils/currencyUtils';
import CanvasEditor from '../components/CanvasEditor';

interface User {
  id: string;
  email: string;
  created_at: string;
}

interface SettingsProps {
  settings: SystemSettings;
  onSaveSettings: (settings: SystemSettings) => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onSaveSettings }) => {
  const [activeTab, setActiveTab] = useState<'serial' | 'coupons' | 'template'>('serial');
  const [formData, setFormData] = useState<SystemSettings>({
    ...settings,
    backgroundTemplate: settings.backgroundTemplate || '',
    couponAmounts: settings.couponAmounts || []
  });
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [showUserForm, setShowUserForm] = useState(false);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [newAmountForm, setNewAmountForm] = useState({ amount: 0, validityPeriod: 30 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ amount: 0, validityPeriod: 30 });

  useEffect(() => {
    fetchUsers();
    loadTemplateImage();
    loadSettingsFromDB();
  }, []);

  const loadSettingsFromDB = async () => {
    try {
      const dbSettings = await SettingsService.loadSettings();
      setFormData({
        ...dbSettings,
        backgroundTemplate: dbSettings.backgroundTemplate || ''
      });
    } catch (err) {
      console.error('Failed to load settings from database:', err);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      // Fetch from profiles instead of auth.admin.listUsers() to avoid 403
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*');

      if (error) {
        console.warn('Could not fetch profiles (check RLS policies):', error);
        setUsers([]);
      } else {
        setUsers(profiles?.map(p => ({
          id: p.user_id || p.id,
          email: p.email || 'No email',
          created_at: p.created_at || new Date().toISOString()
        })) || []);
      }
    } catch (err) {
      console.warn('Could not fetch users', err);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadTemplateImage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('template_image_url')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profile?.template_image_url) {
          setFormData(prev => ({ ...prev, backgroundTemplate: profile.template_image_url }));
        }
      }
    } catch (err) {
      console.warn('Could not load template image', err);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteMessage('');
    try {
      const { error } = await supabase.auth.signUp({
        email: inviteEmail,
        password: invitePassword,
      });
      if (error) throw error;
      setInviteMessage('✓ User created successfully!');
      setInviteEmail('');
      setInvitePassword('');
      fetchUsers();
      setTimeout(() => { setShowUserForm(false); setInviteMessage(''); }, 2000);
    } catch (err: any) {
      setInviteMessage(err.message || 'Failed to create user');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadMessage('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Update profile with template image URL if changed
        await supabase
          .from('profiles')
          .update({
            template_image_url: formData.backgroundTemplate
          })
          .eq('user_id', user.id);
      }

      // Save settings to database
      const success = await SettingsService.saveSettings(formData);

      if (success) {
        onSaveSettings(formData);
        alert('Settings saved successfully to database!');
        setUploadMessage('✓ Settings saved to database successfully!');
      } else {
        alert('Error saving settings to database');
      }
    } catch (err: any) {
      alert('Error saving settings: ' + err.message);
      setUploadMessage('✗ Failed to save settings: ' + (err.message || 'Unknown error'));
    }

    // Clear message after 3 seconds
    setTimeout(() => setUploadMessage(''), 3000);
  };

  const handleReset = () => {
    setFormData(settings);
  };

  const handleUploadTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadMessage('✗ File is too large (max 5MB)');
      return;
    }

    setUploadingTemplate(true);
    setUploadMessage('');

    console.log('Starting upload for:', file.name);

    // Safety timeout to reset the loading state even if the promise hangs indefinitely
    const safetyTimeout = setTimeout(() => {
      console.warn('Safety timeout reached for upload state');
      setUploadingTemplate(false);
      if (!uploadMessage) {
        setUploadMessage('⚠️ Upload is taking too long. Please check your connection or console.');
      }
    }, 45000);

    try {
      // Use the storage utility with built-in error handling
      const result = await uploadCouponTemplate(file, `template-${Date.now()}.${file.name.split('.').pop()}`);

      clearTimeout(safetyTimeout);
      console.log('Upload result:', result);

      setFormData(prev => ({ ...prev, backgroundTemplate: result.url }));
      setUploadMessage('✓ Template uploaded successfully!');

      setTimeout(() => setUploadMessage(''), 3000);
    } catch (err: any) {
      clearTimeout(safetyTimeout);
      const errorMsg = err.message || 'Unknown error';
      console.error('Catch in handleUploadTemplate:', err);

      if (errorMsg.includes('RLS')) {
        setUploadMessage('⚠️ RLS policies not configured. Please run SETUP_COMPLETE_STORAGE.sql in Supabase SQL Editor');
      } else if (errorMsg.includes('must be authenticated')) {
        setUploadMessage('⚠️ You must be logged in to upload');
      } else {
        setUploadMessage('✗ Upload failed: ' + errorMsg);
      }
    } finally {
      setUploadingTemplate(false);
    }
  };

  const generateSampleSerialCode = () => {
    const startNum = parseInt(formData.startNumber.toString());

    // Determine the number of digits in the start number to preserve leading zeros
    const startNumStr = formData.startNumber.toString();
    const digits = startNumStr.length;

    // Format with leading zeros to match the start number format
    const formattedNum = startNum.toString().padStart(digits, '0');

    return `${formData.prefix}${formattedNum}${formData.suffix}`;
  };

  const addCouponAmount = () => {
    if (newAmountForm.amount <= 0 || newAmountForm.validityPeriod <= 0) {
      alert('Amount and validity period must be greater than 0');
      return;
    }

    const newConfig: CouponAmountConfig = {
      id: Date.now().toString(),
      amount: newAmountForm.amount,
      validityPeriod: newAmountForm.validityPeriod,
      isDefault: !formData.couponAmounts || formData.couponAmounts.length === 0
    };

    setFormData(prev => ({
      ...prev,
      couponAmounts: [...(prev.couponAmounts || []), newConfig]
    }));

    setNewAmountForm({ amount: 0, validityPeriod: 30 });
  };

  const deleteCouponAmount = (id: string) => {
    setFormData(prev => {
      const updated = (prev.couponAmounts || []).filter(config => config.id !== id);
      // If we deleted the default, make the first one default
      if (updated.length > 0 && !updated.some(c => c.isDefault)) {
        updated[0].isDefault = true;
      }
      return { ...prev, couponAmounts: updated };
    });
  };

  const setDefaultCouponAmount = (id: string) => {
    setFormData(prev => {
      const updatedAmounts = (prev.couponAmounts || []).map(config => ({
        ...config,
        isDefault: config.id === id
      }));
      const defaultItem = updatedAmounts.find(a => a.id === id);
      
      return {
        ...prev,
        couponAmounts: updatedAmounts,
        amount: defaultItem ? defaultItem.amount : prev.amount,
        validityPeriod: defaultItem ? defaultItem.validityPeriod : prev.validityPeriod
      };
    });
  };

  const startEditCouponAmount = (config: CouponAmountConfig) => {
    setEditingId(config.id);
    setEditForm({ amount: config.amount, validityPeriod: config.validityPeriod });
  };

  const saveEditCouponAmount = () => {
    if (editForm.amount <= 0 || editForm.validityPeriod <= 0) {
      alert('Amount and validity period must be greater than 0');
      return;
    }

    setFormData(prev => {
      const updatedAmounts = (prev.couponAmounts || []).map(config =>
        config.id === editingId
          ? { ...config, amount: editForm.amount, validityPeriod: editForm.validityPeriod }
          : config
      );
      const defaultItem = updatedAmounts.find(a => a.isDefault);
      
      return {
        ...prev,
        couponAmounts: updatedAmounts,
        amount: defaultItem ? defaultItem.amount : prev.amount,
        validityPeriod: defaultItem ? defaultItem.validityPeriod : prev.validityPeriod
      };
    });

    setEditingId(null);
  };

  const toggleCouponAmountVisibility = (id: string) => {
    setFormData(prev => ({
      ...prev,
      couponAmounts: (prev.couponAmounts || []).map(config =>
        config.id === id
          ? { ...config, isVisible: !config.isVisible }
          : config
      )
    }));
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-12 space-y-8 no-print">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">System Settings</h1>
          <p className="text-slate-500 mt-1">Configure your cafeteria coupon parameters and templates.</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleReset}
            className="px-6 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 transition shadow-sm"
          >
            Reset to Defaults
          </button>
          <button
            onClick={handleSubmit}
            className="px-8 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 transition"
          >
            Save Changes
          </button>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-8">
        <button
          onClick={() => setActiveTab('serial')}
          className={`pb-4 text-sm font-bold transition-all relative ${activeTab === 'serial' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Serial Number
          {activeTab === 'serial' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
        </button>
        <button
          onClick={() => setActiveTab('coupons')}
          className={`pb-4 text-sm font-bold transition-all relative ${activeTab === 'coupons' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Coupons
          {activeTab === 'coupons' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
        </button>
        <button
          onClick={() => setActiveTab('template')}
          className={`pb-4 text-sm font-bold transition-all relative ${activeTab === 'template' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Template
          {activeTab === 'template' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Serial Number Tab */}
        {activeTab === 'serial' && (
          <section className="bg-white shadow-sm border border-slate-100 rounded-3xl p-8 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-6">Serial Number Control</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2" htmlFor="prefix">Prefix</label>
                  <input
                    id="prefix"
                    className="block w-full rounded-xl border-slate-100 bg-slate-50 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-3 px-4 transition"
                    value={formData.prefix}
                    onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2" htmlFor="startNumber">Start Number</label>
                  <input
                    id="startNumber"
                    type="number"
                    className="block w-full rounded-xl border-slate-100 bg-slate-50 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-3 px-4 transition"
                    value={formData.startNumber}
                    onChange={(e) => setFormData({ ...formData, startNumber: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2" htmlFor="suffix">Suffix</label>
                  <input
                    id="suffix"
                    className="block w-full rounded-xl border-slate-100 bg-slate-50 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-3 px-4 transition"
                    value={formData.suffix}
                    onChange={(e) => setFormData({ ...formData, suffix: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2">Sample Serial Code Preview</p>
              <div className="text-2xl font-mono font-bold text-indigo-900">{generateSampleSerialCode()}</div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div>
                <p className="text-sm font-bold text-slate-900">QR Code Generation</p>
                <p className="text-xs text-slate-500">Generate a unique QR code for each coupon based on its serial ID</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={formData.qrEnabled || false}
                  onChange={(e) => setFormData({ ...formData, qrEnabled: e.target.checked })}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </section>
        )}

        {/* Coupons Tab */}
        {activeTab === 'coupons' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <section className="bg-white shadow-sm border border-slate-100 rounded-3xl p-8">
              <h2 className="text-lg font-bold text-slate-900 mb-6">Coupon Configuration</h2>

              {/* Default Preview */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 mb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Configuration Preview</p>
                    <p className="text-lg font-semibold text-emerald-900">
                      Each coupon will be worth <span className="text-2xl font-bold">{formatRupees(formData.amount)}</span> and valid for <span className="text-2xl font-bold">{formData.validityPeriod}</span> days
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-emerald-200 rounded-full flex items-center justify-center text-xl">
                    💵
                  </div>
                </div>
              </div>

              {/* Visibility Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-8">
                <div>
                  <p className="text-sm font-bold text-slate-900">Show Amount on Coupon</p>
                  <p className="text-xs text-slate-500">Display the coupon amount value on printed coupons</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formData.amountVisible !== false}
                    onChange={(e) => setFormData({ ...formData, amountVisible: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Add New Amount Form */}
              <div className="mb-8 p-6 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100">
                <h3 className="text-sm font-bold text-slate-900 mb-4">Add New Coupon Amount Preset</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Amount ({getRupeeSymbol()})</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="block w-full rounded-xl border-slate-100 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-3 px-4 transition"
                      value={newAmountForm.amount}
                      onChange={(e) => setNewAmountForm({ ...newAmountForm, amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Validity (Days)</label>
                    <input
                      type="number"
                      min="1"
                      className="block w-full rounded-xl border-slate-100 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-3 px-4 transition"
                      value={newAmountForm.validityPeriod}
                      onChange={(e) => setNewAmountForm({ ...newAmountForm, validityPeriod: parseInt(e.target.value) || 30 })}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={addCouponAmount}
                      className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg transition"
                    >
                      + Add Preset
                    </button>
                  </div>
                </div>
              </div>

              {/* Coupon Amounts List */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Available Presets</h3>
                {formData.couponAmounts && formData.couponAmounts.length > 0 ? (
                  <div className="space-y-3">
                    {editingId && (
                      <div className="p-4 rounded-2xl border-2 border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50">
                        <h4 className="text-sm font-bold text-slate-900 mb-3">Edit Preset</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Amount ({getRupeeSymbol()})</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="block w-full rounded-xl border-slate-100 bg-white shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 transition"
                              value={editForm.amount}
                              onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Validity (Days)</label>
                            <input
                              type="number"
                              min="1"
                              className="block w-full rounded-xl border-slate-100 bg-white shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm py-2 px-3 transition"
                              value={editForm.validityPeriod}
                              onChange={(e) => setEditForm({ ...editForm, validityPeriod: parseInt(e.target.value) || 30 })}
                            />
                          </div>
                          <div className="flex items-end gap-2">
                            <button type="button" onClick={saveEditCouponAmount} className="flex-1 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-lg transition">Save</button>
                            <button type="button" onClick={() => setEditingId(null)} className="flex-1 px-3 py-2 bg-slate-300 hover:bg-slate-400 text-white rounded-xl text-xs font-bold shadow-lg transition">Cancel</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {[...(formData.couponAmounts || [])].sort((a, b) => (b.isDefault ? 1 : -1)).map((config) => (
                      <div
                        key={config.id}
                        className={`p-4 rounded-2xl border-2 transition flex items-center justify-between ${config.isDefault ? 'bg-gradient-to-r from-emerald-50 to-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-lg font-bold text-slate-900">{formatRupees(config.amount)}</p>
                            {config.isDefault && <span className="px-2 py-1 text-xs font-bold text-emerald-600 bg-emerald-100 rounded-lg">Default</span>}
                          </div>
                          <p className="text-xs text-slate-500">Valid for {config.validityPeriod} days</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => toggleCouponAmountVisibility(config.id)} className={`p-2 rounded-lg transition ${config.isVisible !== false ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-slate-400 bg-slate-100 hover:bg-slate-200'}`} title="Toggle Visibility">
                            {config.isVisible !== false ? (
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                            ) : (
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-5.68 1.74L3.707 2.293zM6.217 6.217A7.956 7.956 0 0110 5c3.956 0 7.376 2.721 8.542 6.388-1.231 2.925-3.747 5.217-6.986 5.976-.466.08-.943.122-1.428.122-.62 0-1.236-.03-1.848-.093l2.061-2.061a3 3 0 10-4.124-4.124L6.217 6.217z" clipRule="evenodd" /></svg>
                            )}
                          </button>
                          <button type="button" onClick={() => startEditCouponAmount(config)} className="p-2 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                          {formData.couponAmounts!.length > 1 && (
                            <button type="button" onClick={() => confirm(`Delete preset?`) && deleteCouponAmount(config.id)} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></button>
                          )}
                          {!config.isDefault && (
                            <button type="button" onClick={() => setDefaultCouponAmount(config.id)} className="p-2 text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg></button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-200 rounded-3xl">
                    <p className="text-sm">No coupon amount presets configured. Add one to get started.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* Template Tab */}
        {activeTab === 'template' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <section className="bg-white shadow-sm border border-slate-100 rounded-3xl p-8">
              <h2 className="text-lg font-bold text-slate-900 mb-6">Background Management</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Current Template</p>
                  <div className="relative group rounded-2xl overflow-hidden border border-slate-200 shadow-lg">
                    <img alt="Template Preview" className="w-full h-auto object-cover aspect-[1048/598]" src={formData.backgroundTemplate} />
                  </div>
                </div>
                <div className="flex flex-col justify-center space-y-4">
                  {uploadMessage && (
                    <div className={`p-3 rounded-lg text-sm ${uploadMessage.includes('✓') ? 'bg-green-50 border border-green-200 text-green-600' : 'bg-red-50 border border-red-200 text-red-600'}`}>
                      {uploadMessage}
                    </div>
                  )}
                  <input type="file" accept="image/png,image/jpeg" onChange={handleUploadTemplate} disabled={uploadingTemplate} id="template-upload" className="hidden" />
                  <label htmlFor="template-upload" className={`w-full cursor-pointer flex items-center justify-center gap-2 px-6 py-4 ${uploadingTemplate ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'} text-white rounded-2xl text-sm font-bold shadow-xl transition-all`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    {uploadingTemplate ? 'Uploading...' : 'Upload New Template'}
                  </label>
                  <p className="text-xs text-slate-500">Supported formats: PNG, JPG (max 5MB)</p>
                </div>
              </div>
            </section>

            {formData.backgroundTemplate && (
              <section className="bg-white shadow-sm border border-slate-100 rounded-3xl p-8">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Data Element Positioning</h2>
                <p className="text-sm text-slate-600 mb-6">Customize where text elements appear on the printed coupon.</p>
                <CanvasEditor
                  templateUrl={formData.backgroundTemplate}
                  settings={formData}
                  onUpdatePositions={(elements: TemplateElement[]) => {
                    setFormData(prev => ({ ...prev, templateElements: elements }));
                  }}
                />
              </section>
            )}
          </div>
        )}

        <div className="flex justify-end gap-4 pt-4">
          <button type="submit" className="px-12 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-bold shadow-lg transition">
            Save All Settings
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;
