import React, { useState, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Key, ShieldCheck, ExternalLink, CheckCircle2, XCircle, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { testApiKey } from '../services/ai';

export const Settings: React.FC = () => {
  const { apiKey, setApiKey, clearAllData } = useFinance();
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error' | 'quota_exceeded'>('idle');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setLocalApiKey(apiKey);
  }, [apiKey]);

  const handleSaveAndTest = async () => {
    if (!localApiKey.trim()) {
      setApiKey('');
      setStatus('idle');
      return;
    }

    setStatus('testing');
    try {
      const isValid = await testApiKey(localApiKey);
      if (isValid) {
        setApiKey(localApiKey);
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch (error: any) {
      if (error.message === 'QUOTA_EXCEEDED') {
        setApiKey(localApiKey); // Still save it, but show quota warning
        setStatus('quota_exceeded');
      } else {
        setStatus('error');
      }
    }
  };

  const handleDeleteData = () => {
    clearAllData();
    setShowDeleteConfirm(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* API Key Settings */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
            <Key className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Pengaturan API Key</h2>
            <p className="text-sm text-gray-500">Kunci akses untuk fitur asisten AI</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
              Gemini API Key
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                id="apiKey"
                type="password"
                value={localApiKey}
                onChange={(e) => {
                  setLocalApiKey(e.target.value);
                  setStatus('idle');
                }}
                placeholder="AIzaSy..."
                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-gray-900"
              />
              <button
                onClick={handleSaveAndTest}
                disabled={status === 'testing'}
                className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-70 flex items-center justify-center min-w-[140px]"
              >
                {status === 'testing' ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menguji...</>
                ) : (
                  'Simpan & Uji'
                )}
              </button>
            </div>
            
            {/* Status Messages */}
            {status === 'idle' && localApiKey !== apiKey && (
              <p className="mt-2 text-sm text-amber-600 flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-4 h-4" /> Perubahan belum disimpan. Klik "Simpan & Uji".
              </p>
            )}
            {status === 'success' && localApiKey === apiKey && (
              <p className="mt-2 text-sm text-green-600 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4" /> API Key valid dan berhasil disimpan.
              </p>
            )}
            {status === 'error' && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-1.5 font-medium">
                <XCircle className="w-4 h-4" /> API Key tidak valid. Perubahan dibatalkan.
              </p>
            )}
            {status === 'quota_exceeded' && localApiKey === apiKey && (
              <p className="mt-2 text-sm text-amber-600 flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-4 h-4" /> API Key valid dan disimpan, namun token gratis harian Anda telah habis.
              </p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Aman & Privat</p>
              <p className="mb-2">API Key Anda hanya disimpan secara lokal di browser perangkat ini (menggunakan LocalStorage) dan tidak pernah dikirim ke server kami.</p>
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-700 font-medium hover:text-blue-900"
              >
                Dapatkan API Key gratis di Google AI Studio <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Manajemen Data</h2>
            <p className="text-sm text-gray-500">Hapus semua data keuangan Anda</p>
          </div>
        </div>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2.5 bg-white border border-red-200 text-red-600 font-medium rounded-xl hover:bg-red-50 transition-colors"
          >
            Hapus Semua Data
          </button>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-800 font-medium mb-3">
              Apakah Anda yakin? Semua data pengeluaran dan anggaran akan dihapus secara permanen dari perangkat ini. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteData}
                className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                Ya, Hapus Permanen
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Batal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
