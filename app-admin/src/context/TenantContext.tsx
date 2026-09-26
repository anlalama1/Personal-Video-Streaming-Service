/**
 * ============================================================================
 * Demetrius Family Tenant Registry Context
 * ============================================================================
 * Enterprise Architecture Strategy: Dynamic Multi-Tenant Vault Management.
 * Manages registered family tenants, auto-generating 6-character uppercase
 * alphanumeric Family Vault Codes.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  refreshing: boolean;
  refreshProgress: number;
  addTenant: (familyName: string, contactEmail?: string) => Promise<FamilyTenant>;
  removeTenant: (familyId: string) => void;
  refreshTenants: () => Promise<void>;
}

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

/**
 * Generates a 6-character uppercase alphanumeric random string.
 */
const generate6CharAlphanumeric = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const TenantContext = createContext<TenantContextType | undefined>(undefined);
const TENANT_REFRESH_INTERVAL_MS = 30_000;
const TENANT_REFRESH_PROGRESS_INTERVAL_MS = 250;

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenants, setTenants] = useState<FamilyTenant[]>(DEFAULT_TENANTS);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);
  const refreshInFlight = useRef(false);
  const nextRefreshAt = useRef(Date.now() + TENANT_REFRESH_INTERVAL_MS);

  const fetchRemoteTenants = useCallback(async (showLoading = true) => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    if (showLoading) setLoading(true);
    try {
      const res = await api.get('tenants');
      if (Array.isArray(res.data)) {
        setTenants(res.data);
      }
    } catch (err) {
      console.warn('Could not fetch remote tenants from DynamoDB; keeping in-memory tenant state:', err);
    } finally {
      if (showLoading) setLoading(false);
      refreshInFlight.current = false;
      setRefreshing(false);
      setRefreshProgress(0);
      nextRefreshAt.current = Date.now() + TENANT_REFRESH_INTERVAL_MS;
    }
  }, []);

  useEffect(() => {
    localStorage.removeItem('alexandria_registered_tenants');
    void fetchRemoteTenants();

    const refreshInterval = window.setInterval(() => {
      const remainingMs = nextRefreshAt.current - Date.now();
      setRefreshProgress(Math.min(
        100,
        ((TENANT_REFRESH_INTERVAL_MS - Math.max(remainingMs, 0)) / TENANT_REFRESH_INTERVAL_MS) * 100
      ));

      if (remainingMs <= 0) {
        void fetchRemoteTenants(false);
      }
    }, TENANT_REFRESH_PROGRESS_INTERVAL_MS);

    return () => window.clearInterval(refreshInterval);
  }, [fetchRemoteTenants]);

  const addTenant = async (familyName: string, contactEmail?: string): Promise<FamilyTenant> => {
    const familyId = generate6CharAlphanumeric();
    const createdAt = new Date().toISOString();

    const newTenant: FamilyTenant = {
      familyId,
      familyName,
      contactEmail,
      createdAt
    };

    // Optimistically update the current session's UI state.
    setTenants(prev => [...prev, newTenant]);

    // Persist asynchronously to DynamoDB via API Gateway
    try {
      const res = await api.post('tenants', { familyName, contactEmail });
      if (res.data && res.data.familyId) {
        // Use exact backend-persisted family ID
        newTenant.familyId = res.data.familyId;
        setTenants(prev => prev.map(tenant => tenant === newTenant ? { ...newTenant } : tenant));
      }
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
    <TenantContext.Provider value={{
      tenants,
      loading,
      refreshing,
      refreshProgress,
      addTenant,
      removeTenant,
      refreshTenants: fetchRemoteTenants
    }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenants = () => {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenants must be used within TenantProvider');
  return context;
};
