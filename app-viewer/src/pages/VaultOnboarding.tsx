import { useState, type FormEvent } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const apiErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string } } }).response;
    if (response?.data?.error) return response.data.error;
  }
  return error instanceof Error ? error.message : 'Could not complete vault setup.';
};

const VaultOnboarding = () => {
  const { refreshProfile, signOut } = useAuth();
  const [familyCode, setFamilyCode] = useState('');
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const joinVault = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('vault/join', { familyCode: familyCode.trim().toUpperCase() });
      await refreshProfile();
    } catch (joinError: unknown) {
      setError(apiErrorMessage(joinError));
    } finally {
      setLoading(false);
    }
  };

  const createVault = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post<{ familyId: string }>('vault/create');
      setCreatedCode(response.data.familyId);
    } catch (createError: unknown) {
      setError(apiErrorMessage(createError));
    } finally {
      setLoading(false);
    }
  };

  const continueToVault = async () => {
    setLoading(true);
    setError('');
    try {
      await refreshProfile();
    } catch (refreshError: unknown) {
      setError(apiErrorMessage(refreshError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-heritage-black text-heritage-parchment flex items-center justify-center p-6">
      <section className="w-full max-w-lg rounded-3xl border border-heritage-800 bg-heritage-900 p-10 shadow-2xl">
        <h1 className="text-center text-2xl font-black uppercase text-heritage-gold">Set up your family vault</h1>
        {createdCode ? (
          <div className="mt-6 space-y-5 text-center">
            <p className="text-sm text-heritage-300">
              Your vault is ready and you are its administrator. Share this code with family members you want to invite.
            </p>
            <p className="select-all rounded-xl border border-heritage-gold/40 bg-heritage-black px-5 py-4 text-2xl font-black tracking-[0.2em] text-heritage-gold">
              {createdCode}
            </p>
            <button
              onClick={() => void continueToVault()}
              disabled={loading}
              className="w-full rounded-xl bg-heritage-gold px-5 py-3 font-black text-heritage-black disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Continue to your vault'}
            </button>
          </div>
        ) : (
          <>
            <p className="mt-4 text-center text-sm text-heritage-400">
              Join an existing family vault or create a new vault. Requests to join require administrator approval.
            </p>
            <form onSubmit={joinVault} className="mt-8 space-y-4">
              <label className="block text-xs font-black uppercase tracking-widest text-heritage-gold" htmlFor="family-code">
                Existing family code
              </label>
              <input
                id="family-code"
                value={familyCode}
                onChange={event => setFamilyCode(event.target.value.toUpperCase())}
                autoCapitalize="characters"
                className="w-full rounded-xl border border-heritage-800 bg-heritage-black px-4 py-3 font-bold tracking-wider text-heritage-parchment outline-none focus:border-heritage-gold"
                placeholder="Enter family code"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-heritage-gold to-heritage-sunset px-5 py-3 font-black uppercase text-heritage-black disabled:opacity-50"
              >
                {loading ? 'Submitting…' : 'Request to join'}
              </button>
            </form>
            <div className="my-6 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-heritage-500">
              <div className="h-px flex-1 bg-heritage-800" />Or<div className="h-px flex-1 bg-heritage-800" />
            </div>
            <button
              onClick={() => void createVault()}
              disabled={loading}
              className="w-full rounded-xl border border-heritage-800 px-5 py-3 font-black uppercase text-heritage-parchment hover:border-heritage-gold disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create a new vault'}
            </button>
          </>
        )}
        {error && <p role="alert" className="mt-5 rounded-lg bg-red-950/40 p-3 text-center text-sm text-red-300">{error}</p>}
        <button
          onClick={() => void signOut()}
          className="mt-6 w-full text-center text-xs font-bold text-heritage-400 hover:text-heritage-gold"
        >
          Sign out
        </button>
      </section>
    </main>
  );
};

export default VaultOnboarding;
