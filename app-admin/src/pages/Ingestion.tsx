import React, { useState } from 'react';
import { useUpload } from '../context/UploadContext';
import { useTenants } from '../context/TenantContext';
import { CheckCircle2, CloudUpload, Plus, Users, ShieldCheck } from 'lucide-react';

const Ingestion = () => {
  const { startUpload } = useUpload();
  const { tenants, addTenant } = useTenants();
  const [file, setFile] = useState<File | null>(null);
  const [familyId, setFamilyId] = useState('PUBLIC');
  const [isSuccess, setIsSuccess] = useState(false);

  // Quick Tenant Creation Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setIsSuccess(false);
    }
  };

  const handleFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFamilyId(e.target.value);
  };

  const handleCreateNewTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFamilyName.trim()) return;

    const created = await addTenant(newFamilyName.trim(), newContactEmail.trim());
    setFamilyId(created.familyId); // Auto select newly created family tenant
    setNewFamilyName('');
    setNewContactEmail('');
    setShowCreateModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    // Build optimized default metadata values from the raw file info
    const optimizedDefaults = {
      title: file.name.split('.')[0],
      genre: 'Unknown',
      releaseYear: new Date().getFullYear().toString(),
      familyId: familyId
    };

    // Trigger background upload chunker process
    startUpload(file, optimizedDefaults);

    setFile(null);
    setIsSuccess(true);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <header className="text-center">
        <h2 className="text-3xl font-black text-heritage-parchment mb-2 text-glow-gold">Media Vault Ingestion</h2>
        <p className="text-heritage-400 font-medium">Upload raw media rolls. AI will automatically draft metadata and index logs for human approval.</p>
      </header>

      <form onSubmit={handleSubmit} className="bg-heritage-900 p-8 rounded-2xl border border-heritage-800 shadow-2xl space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-heritage-400">Target Family Partition</label>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="text-[10px] font-black text-heritage-gold uppercase tracking-wider hover:underline flex items-center gap-1"
            >
              <Plus size={12} />
              New Family Tenant
            </button>
          </div>

          <select
            name="familyId"
            value={familyId}
            onChange={handleFamilyChange}
            className="w-full bg-heritage-black border border-heritage-800 rounded-lg px-4 py-3 text-heritage-parchment outline-none focus:ring-2 focus:ring-heritage-gold transition-all cursor-pointer font-bold"
          >
            {tenants.map(tenant => (
              <option key={tenant.familyId} value={tenant.familyId}>
                {tenant.familyName} ({tenant.familyId})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 pt-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-heritage-400">Select Media File (MP4)</label>
          <div className="group border-2 border-dashed border-heritage-800 rounded-xl p-12 text-center hover:border-heritage-gold hover:bg-heritage-gold/5 transition-all cursor-pointer relative">
            <input
              type="file"
              accept="video/mp4"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-3">
              <CloudUpload className="text-heritage-800 group-hover:text-heritage-gold transition-colors" size={44} />
              {file ? (
                <div className="text-heritage-gold font-bold text-sm tracking-wide break-all">{file.name}</div>
              ) : (
                <div className="text-heritage-400 font-bold text-xs uppercase tracking-widest italic opacity-60">Click or drag and drop MP4 video here</div>
              )}
            </div>
          </div>
        </div>

        <button
          disabled={!file}
          className="w-full bg-gradient-to-r from-heritage-gold to-heritage-sunset hover:opacity-90 disabled:from-heritage-800 disabled:to-heritage-800 disabled:cursor-not-allowed text-heritage-black font-black py-4 rounded-xl transition-all shadow-2xl tracking-[0.2em] uppercase text-xs"
        >
          Begin Ingestion Pass
        </button>

        {isSuccess && (
          <div className="bg-heritage-gold/10 border border-heritage-gold/30 p-4 rounded-lg flex items-center gap-3 text-heritage-gold">
            <CheckCircle2 className="text-heritage-gold" size={18} />
            <span className="text-xs font-black uppercase tracking-wider">Video added to background thread! Track progress in the upload drawer.</span>
          </div>
        )}
      </form>

      {/* Quick Tenant Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-heritage-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-heritage-900 border border-heritage-800 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-heritage-black border border-heritage-800 rounded-xl text-heritage-gold">
                <Users size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-heritage-parchment uppercase tracking-tight">Register Family Tenant</h3>
                <p className="text-xs text-heritage-400 font-medium">Provision a new family vault partition on the fly.</p>
              </div>
            </div>

            <form onSubmit={handleCreateNewTenant} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-heritage-400">Family Vault Name</label>
                <input
                  type="text"
                  placeholder="e.g. Harrison Family Archive"
                  value={newFamilyName}
                  onChange={e => setNewFamilyName(e.target.value)}
                  className="w-full bg-heritage-black border border-heritage-800 rounded-xl px-4 py-3 text-heritage-parchment outline-none focus:ring-2 focus:ring-heritage-gold transition-all text-sm font-bold"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-heritage-400">Admin Contact Email (Optional)</label>
                <input
                  type="email"
                  placeholder="e.g. admin@harrison.com"
                  value={newContactEmail}
                  onChange={e => setNewContactEmail(e.target.value)}
                  className="w-full bg-heritage-black border border-heritage-800 rounded-xl px-4 py-3 text-heritage-parchment outline-none focus:ring-2 focus:ring-heritage-gold transition-all text-sm font-bold"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-heritage-black border border-heritage-800 text-heritage-400 font-bold py-3.5 rounded-xl hover:bg-heritage-800 transition-colors uppercase text-xs tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-heritage-gold to-heritage-sunset text-heritage-black font-black py-3.5 rounded-xl shadow-xl hover:opacity-90 transition-all uppercase text-xs tracking-wider flex items-center justify-center gap-2"
                >
                  <ShieldCheck size={16} />
                  Register Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Ingestion;
