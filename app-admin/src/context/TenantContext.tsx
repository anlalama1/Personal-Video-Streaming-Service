import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

export interface FamilyTenant {
  familyId: string;
  familyName: string;
  contactEmail?: string;
  createdAt: string;
}

interface TenantContextType {
  tenants: FamilyTenant[];
  loading: boolean;
  addTenant: (familyName: string, contactEmail?: string) => Promise<FamilyTenant>;
  removeTenant: (familyId: string) => void;
  refreshTenants: () => Promise<void>;
}

const LOCAL_STORAGE_KEY = 'alexandria_registered_tenants';

const DEFAULT_TENANTS: FamilyTenant[] = [
  {
    familyId: 'PUBLIC',
    familyName: 'Public Access Pool',
    contactEmail: 'public@alexandria-plus.com',
    createdAt: new Date().toISOString()
  },
  {
    familyId: 'FAM_LALAMA',
    familyName: 'Lalama Family Vault',
    contactEmail: 'family@lalama.com',
    createdAt: new Date().toISOString()
  },
  {
    familyId: 'FAM_SMITH',
    familyName: 'Smith Family Vault',
    contactEmail: 'smith@familyvault.com',
    createdAt: new Date().toISOString()
  }
];

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenants, setTenants] = useState<FamilyTenant[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!saved) return DEFAULT_TENANTS;
    try {
      return JSON.parse(saved);
    } catch {
      return DEFAULT_TENANTS;
    }
  });
  const [loading, setLoading] = useState(false);

  const fetchRemoteTenants = async () => {
    setLoading(true);
    try {
      const res = await api.get('tenants');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setTenants(res.data);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(res.data));
      }
    } catch (err) {
      console.warn('Could not fetch remote tenants from DynamoDB, falling back to cached state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRemoteTenants();
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tenants));
  }, [tenants]);

  const addTenant = async (familyName: string, contactEmail?: string): Promise<FamilyTenant> => {
    const slug = familyName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    const uniqueHash = Math.random().toString(36).substring(2, 6).toUpperCase();
    const familyId = `FAM_${slug}_${uniqueHash}`;
    const createdAt = new Date().toISOString();

    const newTenant: FamilyTenant = {
      familyId,
      familyName,
      contactEmail,
      createdAt
    };

    // Optimistically update local UI & cache
    setTenants(prev => [...prev, newTenant]);

    // Persist asynchronously to DynamoDB via API Gateway
    try {
      await api.post('tenants', { familyName, contactEmail });
    } catch (err) {
      console.error('Failed to persist tenant to DynamoDB backend:', err);
    }

    return newTenant;
  };

  const removeTenant = (familyId: string) => {
    if (familyId === 'PUBLIC') {
      alert("Cannot delete the Default Public Access Pool.");
      return;
    }
    setTenants(prev => prev.filter(t => t.familyId !== familyId));
  };

  return (
    <TenantContext.Provider value={{ tenants, loading, addTenant, removeTenant, refreshTenants: fetchRemoteTenants }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenants = () => {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenants must be used within TenantProvider');
  return context;
};
