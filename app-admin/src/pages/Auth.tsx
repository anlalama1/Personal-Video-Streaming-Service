import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Loader2, ShieldCheck, Building2, Eye, EyeOff } from 'lucide-react';

/**
 * Generates a 5-character uppercase alphanumeric Operator Tenant ID (e.g. SHOP_A8K2P).
 * Provides 60.46 Million unique combinations with zero length collision against 8-character Family Vault Codes.
 */
const generate5CharOperatorId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `SHOP_${result}`;
};

const Auth = () => {
  const { signIn, signUp, confirmSignUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [needsVerification, setNeedsVerification] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        await signIn({ username: email, password, options: { authFlowType: 'USER_PASSWORD_AUTH' } });
      } else {
        const operatorTenantId = generate5CharOperatorId();
        await signUp({
          username: email,
          password,
          options: {
            userAttributes: {
              email,
              'custom:role': 'ShopAdmin',
              'custom:tenantId': operatorTenantId
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
        <div className="text-center space-y-3">
            <div className="flex justify-center">
                <img src="/logo_flat.png" alt="Logo" className="h-20 w-auto" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-heritage-gold/10 border border-heritage-gold/20 text-heritage-gold text-[10px] font-black uppercase tracking-widest">
              <Building2 size={12} />
              Demetrius Shop Operator Portal
            </div>
            <h2 className="text-2xl font-black text-heritage-parchment uppercase tracking-tight">
                {needsVerification ? 'Verify Operator Account' : isLogin ? 'Shop Operator Login' : 'Register Shop Operator'}
            </h2>
            <p className="text-heritage-400 text-xs font-medium px-4">
                {needsVerification ? 'Enter the verification code to activate your shop operator credentials.' :
                 isLogin ? 'Manage raw ingestion passes and register family tenant vaults.' :
                 'Join the Alexandria+ ecosystem as a professional preservation shop operator.'}
            </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
            {!needsVerification && (
                <>
                    <input
                        type="email"
                        placeholder="Shop Operator Email"
                        className="w-full bg-heritage-black border border-heritage-800 rounded-xl px-4 py-3 text-heritage-parchment outline-none focus:ring-2 focus:ring-heritage-gold transition-all text-sm font-medium"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                    />
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Operator Password"
                            className="w-full bg-heritage-black border border-heritage-800 rounded-xl px-4 py-3 text-heritage-parchment outline-none focus:ring-2 focus:ring-heritage-gold transition-all text-sm font-medium pr-12"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-heritage-400 hover:text-heritage-gold transition-colors p-1"
                            title={showPassword ? "Hide password" : "Show password"}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </>
            )}

            {needsVerification && (
                <input
                    type="text"
                    placeholder="Verification Code"
                    className="w-full bg-heritage-black border border-heritage-800 rounded-xl px-4 py-3 text-heritage-parchment outline-none focus:ring-2 focus:ring-heritage-gold transition-all text-sm font-medium"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    required
                />
            )}

            {error && <p className="text-heritage-sunset text-xs font-bold text-center bg-heritage-sunset/10 py-2 rounded-lg border border-heritage-sunset/20">{error}</p>}

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-heritage-gold to-heritage-sunset text-heritage-black font-black py-4 rounded-xl shadow-xl hover:opacity-90 active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
            >
                {loading ? <Loader2 className="animate-spin" /> : <ShieldCheck size={18} />}
                {needsVerification ? 'Verify Operator' : isLogin ? 'Access Operator Portal' : 'Register Operator Account'}
            </button>
        </form>

        {!needsVerification && (
            <div className="text-center">
                <button
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-heritage-gold text-xs font-black uppercase tracking-widest hover:underline"
                >
                    {isLogin ? 'Register a new shop operator?' : 'Already have a shop operator account?'}
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default Auth;
