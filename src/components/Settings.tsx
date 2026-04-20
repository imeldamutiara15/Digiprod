import React, { useState, useEffect, useRef } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Key, ShieldCheck, ExternalLink, CheckCircle2, XCircle, Loader2, Trash2, AlertTriangle, Download, Upload, FileJson } from 'lucide-react';
import { testApiKey } from '../services/ai';

export const Settings: React.FC = () => {
  const { apiKey, setApiKey, clearAllData, expenses, budgets, recurringExpenses, importData } = useFinance();
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error' | 'quota_exceeded'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEnvKey = false; // Disabled for commercial BYOK concept

  useEffect(() => {
    setLocalApiKey(apiKey);
  }, [apiKey]);

  const handleSaveAndTest = async () => {
    if (!localApiKey.trim()) {
      setApiKey('');
      localStorage.removeItem('gemini_api_key');
      setStatus('idle');
      return;
    }

    setStatus('testing');
    setErrorMessage('');
    try {
      const isValid = await testApiKey(localApiKey);
      if (isValid) {
        setApiKey(localApiKey);
        localStorage.setItem('gemini_api_key', localApiKey);
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMessage('API Key tidak memberikan respon. Pastikan key benar.');
      }
    } catch (error: any) {
      if (error.message === 'QUOTA_EXCEEDED') {
        setApiKey(localApiKey);
        localStorage.setItem('gemini_api_key', localApiKey);
        setStatus('quota_exceeded');
      } else {
        setStatus('error');
        setErrorMessage(error.message || 'Terjadi kesalahan saat menguji API Key.');
      }
    }
  };

  const handleDeleteData = () => {
    clearAllData();
    setShowDeleteConfirm(false);
  };

  const handleExportData = () => {
    const data = {
      expenses,
      budgets,
      recurringExpenses,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pencatatan_keuangan_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.expenses || json.budgets || json.recurringExpenses) {
          importData({
            expenses: json.expenses,
            budgets: json.budgets,
            recurringExpenses: json.recurringExpenses
          });
          setImportStatus('success');
          setTimeout(() => setImportStatus('idle'), 3000);
        } else {
          throw new Error('Format file tidak valid');
        }
      } catch (err) {
        console.error('Import failed', err);
        setImportStatus('error');
        setTimeout(() => setImportStatus('idle'), 3000);
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="space-y-6 max-w-2xl px-4 sm:px-0">
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
              AI API Key
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
            {isEnvKey && localApiKey === apiKey && (
              <p className="mt-2 text-sm text-blue-600 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Menggunakan API Key dari sistem.
              </p>
            )}
            {status === 'idle' && localApiKey !== apiKey && (
              <p className="mt-2 text-sm text-amber-600 flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-4 h-4" /> Perubahan belum disimpan. Klik "Simpan & Uji".
              </p>
            )}
            {status === 'success' && localApiKey === apiKey && (
              <p className="mt-2 text-sm text-green-600 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4" /> API Key berhasil disimpan.
              </p>
            )}
            {status === 'error' && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-1.5 font-medium">
                <XCircle className="w-4 h-4" /> {errorMessage || 'API Key tidak valid.'}
              </p>
            )}
            {status === 'quota_exceeded' && localApiKey === apiKey && (
              <p className="mt-2 text-sm text-amber-600 flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-4 h-4" /> API Key disimpan, namun batas penggunaan gratis harian telah habis.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a 
              href="https://aistudio.google.com/app/apikey" 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3 hover:bg-indigo-100 transition-colors group"
            >
              <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <ExternalLink className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-900">Dapatkan API Key Gratis</p>
                <p className="text-[10px] text-indigo-700">Klik untuk mengambil kunci akses</p>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* Backup & Restore */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
            <FileJson className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Cadangkan & Pulihkan</h2>
            <p className="text-sm text-gray-500">Ekspor data Anda atau pindahkan ke perangkat lain</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleExportData}
            className="p-4 bg-white border border-gray-200 rounded-xl flex items-center gap-3 hover:border-emerald-300 hover:bg-emerald-50 transition-all group text-left"
          >
            <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900">Ekspor Data (JSON)</p>
              <p className="text-[10px] text-gray-500">Simpan cadangan ke perangkat</p>
            </div>
          </button>

          <button
            onClick={handleImportClick}
            className="p-4 bg-white border border-gray-200 rounded-xl flex items-center gap-3 hover:border-blue-300 hover:bg-blue-50 transition-all group text-left"
          >
            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900">Impor Data (JSON)</p>
              <p className="text-[10px] text-gray-500">Gunakan file cadangan Anda</p>
            </div>
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json"
          className="hidden"
        />

        {importStatus === 'success' && (
          <p className="mt-3 text-xs text-green-600 font-bold flex items-center gap-1 animate-bounce">
            <CheckCircle2 className="w-3 h-3" /> Data berhasil diimpor!
          </p>
        )}
        {importStatus === 'error' && (
          <p className="mt-3 text-xs text-red-600 font-bold flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Gagal mengimpor file. Pastikan format benar.
          </p>
        )}
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
