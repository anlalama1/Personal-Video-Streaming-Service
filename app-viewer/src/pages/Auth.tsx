import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Loader2, ShieldCheck } from 'lucide-react';

const Auth = () => {
  const { signIn, signUp, confirmSignUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [needsVerification, setNeedsVerification] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [code, setCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (needsVerification) {
        await confirmSignUp({ username: email, confirmationCode: code });
        setNeedsVerification(false);
        setIsLogin(true);
      } else if (isLogin) {
        await signIn({ username: email, password });
      } else {
        await signUp({
          username: email,
          password,
          options: {
            userAttributes: {
              email,
              'custom:familyId': familyId || `FAM_${Math.random().toString(36).substring(2, 10).toUpperCase()}`
            }
          }
        });
        setNeedsVerification(true);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-heritage-black flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-heritage-900 border border-heritage-800 rounded-3xl p-10 shadow-2xl space-y-8">
        <div className="text-center space-y-2">
            <div className="flex justify-center">
                <img src="/logo_flat.png" alt="Logo" className="h-20 w-auto" />
            </div>
            <h2 className="text-3xl font-black text-heritage-parchment uppercase tracking-tighter italic">
                {needsVerification ? 'Secure the Vault' : isLogin ? 'Welcome Back' : 'Create Vault'}
            </h2>
            <p className="text-heritage-400 text-sm font-medium px-4">
                {needsVerification ? 'Enter the code sent to your email to activate your family heritage vault.' :
                 isLogin ? 'Access your family’s digital legacy scrolls.' :
                 'Start preserving your family heritage for future generations.'}
            </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
            {!needsVerification && (
                <>
                    <input
                        type="email"
                        placeholder="Email Address"
                        className="w-full bg-heritage-black border border-heritage-800 rounded-xl px-4 py-3 text-heritage-parchment outline-none focus:ring-2 focus:ring-heritage-gold transition-all"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        className="w-full bg-heritage-black border border-heritage-800 rounded-xl px-4 py-3 text-heritage-parchment outline-none focus:ring-2 focus:ring-heritage-gold transition-all"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                    />
                    {!isLogin && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-heritage-gold uppercase tracking-widest pl-1">Optional: Family Code</label>
                            <input
                                type="text"
                                placeholder="Enter code to join existing vault"
                                className="w-full bg-heritage-black border border-heritage-800 rounded-xl px-4 py-3 text-heritage-parchment outline-none focus:ring-2 focus:ring-heritage-gold transition-all"
                                value={familyId}
                                onChange={e => setFamilyId(e.target.value)}
                            />
                        </div>
                    )}
                </>
            )}

            {needsVerification && (
                <input
                    type="text"
                    placeholder="Verification Code"
                    className="w-full bg-heritage-black border border-heritage-800 rounded-xl px-4 py-3 text-heritage-parchment outline-none focus:ring-2 focus:ring-heritage-gold transition-all"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    required
                />
            )}

            {error && <p className="text-heritage-sunset text-xs font-bold text-center bg-heritage-sunset/10 py-2 rounded-lg border border-heritage-sunset/20">{error}</p>}

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-heritage-gold to-heritage-sunset text-heritage-black font-black py-4 rounded-xl shadow-xl hover:opacity-90 active:scale-95 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2"
            >
                {loading ? <Loader2 className="animate-spin" /> : <ShieldCheck size={18} />}
                {needsVerification ? 'Verify & Launch' : isLogin ? 'Open the Vault' : 'Initialize Preservation'}
            </button>
        </form>

        {!needsVerification && (
            <div className="text-center">
                <button
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-heritage-gold text-xs font-black uppercase tracking-widest hover:underline"
                >
                    {isLogin ? 'Need a new vault? Create Account' : 'Already have a vault? Sign In'}
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default Auth;
