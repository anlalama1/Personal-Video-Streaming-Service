/**
 * ============================================================================
 * Consumer Viewer Auth & Family Vault Registration Page
 * ============================================================================
 * Enterprise Architecture Strategy: Mandatory Tenancy Validation.
 * Enforces mandatory Family Vault Code validation during consumer sign-up,
 * mapping custom:familyId directly into Cognito User Pool attributes, and
 * handling unconfirmed account rerouting with 15-minute verification code resets.
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Loader2, ShieldCheck, Key, Eye, EyeOff } from 'lucide-react';
import { resendSignUpCode } from 'aws-amplify/auth';

const Auth = () => {
  const { signIn, signUp, confirmSignUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [needsVerification, setNeedsVerification] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [familyId, setFamilyId] = useState('');
  const [code, setCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendMsg, setResendMsg] = useState('');

  /**
   * Handles sign-in, registration, and unconfirmed account rerouting.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResendMsg('');

    try {
      if (needsVerification) {
        await confirmSignUp({ username: email, confirmationCode: code });
        setNeedsVerification(false);
        setIsLogin(true);
      } else if (isLogin) {
        try {
          await signIn({ username: email, password, options: { authFlowType: 'USER_PASSWORD_AUTH' } });
        } catch (signInErr: any) {
          const errName = signInErr?.name || '';
          const errMsg = signInErr?.message || '';
          if (errName === 'UserNotConfirmedException' || errMsg.includes('not confirmed')) {
            console.warn('Unconfirmed account sign-in attempt -> Rerouting to verification code view');
            setNeedsVerification(true);
            return;
          }
          throw signInErr;
        }
      } else {
        // Enforce mandatory Family Vault Code validation
        if (!familyId.trim()) {
          setError("A valid Family Vault Code from your digitization shop operator is required.");
          setLoading(false);
          return;
        }

        try {
          await signUp({
            username: email,
            password,
            options: {
              userAttributes: {
                email,
                'custom:familyId': familyId.trim().toUpperCase()
              }
            }
          });
          setNeedsVerification(true);
        } catch (signUpErr: any) {
          const errName = signUpErr?.name || '';
          const errMsg = signUpErr?.message || '';
          if (errName === 'UsernameExistsException' || errMsg.includes('already exists')) {
            // Reroute existing unconfirmed account to verification step
            setNeedsVerification(true);
            return;
          }
          throw signUpErr;
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email.trim()) {
      setError('Please enter your email address above to resend code.');
      return;
    }
    setError('');
    try {
      await resendSignUpCode({ username: email });
      setResendMsg(`New 6-digit code sent to ${email}! (Expires in 15 mins)`);
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
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
                {needsVerification ? 'Secure the Vault' : isLogin ? 'Welcome Back' : 'Join Family Vault'}
            </h2>
            <p className="text-heritage-400 text-xs font-medium px-4">
                {needsVerification ? 'Enter the 6-digit code sent to your email to activate your account.' :
                 isLogin ? 'Access your family’s digital legacy scrolls.' :
                 'Enter the Family Vault Code provided by your digitization shop to create your account.'}
            </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
            {!needsVerification && (
                <>
                    <input
                        type="email"
                        placeholder="Email Address"
                        className="w-full bg-heritage-black border border-heritage-800 rounded-xl px-4 py-3 text-heritage-parchment outline-none focus:ring-2 focus:ring-heritage-gold transition-all text-sm font-medium"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                    />
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Password"
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
                    {!isLogin && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-heritage-gold uppercase tracking-widest pl-1 flex items-center gap-1">
                                <Key size={12} />
                                Family Vault Code (Required)
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. LALAMA or A1B2C3"
                                className="w-full bg-heritage-black border border-heritage-800 rounded-xl px-4 py-3 text-heritage-parchment outline-none focus:ring-2 focus:ring-heritage-gold transition-all text-sm font-bold tracking-wider"
                                value={familyId}
                                onChange={e => setFamilyId(e.target.value)}
                                required
                            />
                            <p className="text-[10px] text-heritage-400 italic px-1">
                              Provided by your Demetrius digitization shop operator.
                            </p>
                        </div>
                    )}
                </>
            )}

            {needsVerification && (
                <div className="space-y-3">
                    <input
                        type="text"
                        placeholder="6-Digit Verification Code"
                        className="w-full bg-heritage-black border border-heritage-800 rounded-xl px-4 py-3 text-heritage-parchment outline-none focus:ring-2 focus:ring-heritage-gold transition-all text-sm font-medium"
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        required
                    />
                    <p className="text-[10px] text-heritage-gold font-bold text-center">
                        Code expires in 15 minutes.
                    </p>
                </div>
            )}

            {resendMsg && <p className="text-heritage-gold text-xs font-bold text-center bg-heritage-gold/10 py-2 rounded-lg border border-heritage-gold/20">{resendMsg}</p>}
            {error && <p className="text-heritage-sunset text-xs font-bold text-center bg-heritage-sunset/10 py-2 rounded-lg border border-heritage-sunset/20">{error}</p>}

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-heritage-gold to-heritage-sunset text-heritage-black font-black py-4 rounded-xl shadow-xl hover:opacity-90 active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
            >
                {loading ? <Loader2 className="animate-spin" /> : <ShieldCheck size={18} />}
                {needsVerification ? 'Verify & Launch' : isLogin ? 'Open the Vault' : 'Join Family Vault'}
            </button>

            {needsVerification && (
                <div className="text-center pt-2">
                    <button
                        type="button"
                        onClick={handleResendCode}
                        className="text-heritage-gold text-xs font-black uppercase tracking-widest hover:underline"
                    >
                        Resend Verification Code
                    </button>
                </div>
            )}
        </form>

        {!needsVerification && (
            <div className="text-center">
                <button
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-heritage-gold text-xs font-black uppercase tracking-widest hover:underline"
                >
                    {isLogin ? 'Have a Family Code? Join Vault' : 'Already registered? Sign In'}
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default Auth;
