import React, { useState } from 'react';
import { useTenants } from '../context/TenantContext';
import { Users, Plus, Trash2, Building, ShieldCheck, Mail, Key, Copy } from 'lucide-react';

const Tenants = () => {
  const { tenants, addTenant, removeTenant } = useTenants();
  const [showModal, setShowModal] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyName.trim()) return;

    await addTenant(familyName.trim(), contactEmail.trim());
    setFamilyName('');
    setContactEmail('');
    setShowModal(false);
  };

  const handleCopyCode = (familyId: string) => {
    navigator.clipboard.writeText(familyId);
    alert(`Copied Family Vault Code "${familyId}" to clipboard!\n\nShare this code with the customer so they can register and access their digital vault on the Desktop Viewer or Android app.`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-heritage-parchment text-glow-gold">Family Tenant Registry</h2>
          <p className="text-heritage-400 font-medium text-sm mt-1">
            Manage registered family partitions. Provide the generated Family Vault Code to family members so they can register on the Desktop or Android Viewer.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-gradient-to-r from-heritage-gold to-heritage-sunset text-heritage-black font-black px-5 py-3 rounded-xl flex items-center gap-2 shadow-xl hover:opacity-90 active:scale-95 transition-all text-xs tracking-wider uppercase"
        >
          <Plus size={18} />
          Register New Tenant
        </button>
      </header>

      {/* Tenant List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tenants.map(tenant => (
          <div
            key={tenant.familyId}
            className="bg-heritage-900 border border-heritage-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4 hover:border-heritage-gold/50 transition-all"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-heritage-black border border-heritage-800 rounded-xl text-heritage-gold">
                    <Building size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-heritage-parchment">{tenant.familyName}</h3>
                    <span className="text-[10px] font-black uppercase tracking-wider text-heritage-gold bg-heritage-gold/10 px-2 py-0.5 rounded border border-heritage-gold/20 inline-block mt-0.5">
                      Tenant Active
                    </span>
                  </div>
                </div>

                {tenant.familyId !== 'PUBLIC' && (
                  <button
                    onClick={() => removeTenant(tenant.familyId)}
                    className="text-heritage-400 hover:text-heritage-sunset p-2 rounded-lg hover:bg-heritage-sunset/10 transition-colors"
                    title="Delete Tenant"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              <div className="bg-heritage-black/60 border border-heritage-800 rounded-xl p-3 space-y-2 text-xs font-mono text-heritage-400">
                <div className="flex items-center justify-between text-heritage-parchment">
                  <div className="flex items-center gap-2">
                    <Key size={14} className="text-heritage-gold shrink-0" />
                    <span className="font-bold text-[11px]">Vault Code:</span>
                    <span className="text-heritage-gold font-bold select-all tracking-wide">{tenant.familyId}</span>
                  </div>
                  <button
                    onClick={() => handleCopyCode(tenant.familyId)}
                    className="text-[10px] bg-heritage-gold/10 border border-heritage-gold/30 text-heritage-gold font-bold px-2 py-1 rounded hover:bg-heritage-gold/20 transition-all flex items-center gap-1 uppercase"
                    title="Copy Vault Code for Customer"
                  >
                    <Copy size={12} />
                    Copy Code
                  </button>
                </div>
                {tenant.contactEmail && (
                  <div className="flex items-center gap-2 text-heritage-400 pt-1 border-t border-heritage-800/60">
                    <Mail size={14} className="shrink-0 text-heritage-400" />
                    <span>{tenant.contactEmail}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="text-[10px] text-heritage-400 font-medium border-t border-heritage-800/60 pt-3 flex justify-between items-center">
              <span>Registered: {new Date(tenant.createdAt).toLocaleDateString()}</span>
              <span className="text-heritage-gold/80 font-bold">Partition Key Active</span>
            </div>
          </div>
        ))}
      </div>

      {/* Register Tenant Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-heritage-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-heritage-900 border border-heritage-800 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-heritage-black border border-heritage-800 rounded-xl text-heritage-gold">
                <Users size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-heritage-parchment uppercase tracking-tight">Register Family Tenant</h3>
                <p className="text-xs text-heritage-400 font-medium">Provision a new isolated family vault partition.</p>
              </div>
            </div>

            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-heritage-400">Family Vault Name</label>
                <input
                  type="text"
                  placeholder="e.g. Harrison Family Archive"
                  value={familyName}
                  onChange={e => setFamilyName(e.target.value)}
                  className="w-full bg-heritage-black border border-heritage-800 rounded-xl px-4 py-3 text-heritage-parchment outline-none focus:ring-2 focus:ring-heritage-gold transition-all text-sm font-bold"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-heritage-400">Admin Contact Email (Optional)</label>
                <input
                  type="email"
                  placeholder="e.g. admin@harrison.com"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  className="w-full bg-heritage-black border border-heritage-800 rounded-xl px-4 py-3 text-heritage-parchment outline-none focus:ring-2 focus:ring-heritage-gold transition-all text-sm font-bold"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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

export default Tenants;
