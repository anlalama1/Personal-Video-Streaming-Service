import React, { useState } from 'react';
import { Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { resendSignUpCode, signInWithRedirect } from 'aws-amplify/auth';
import { useAuth } from '../context/AuthContext';

const isUnconfirmedUserError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  return error.name === 'UserNotConfirmedException' || error.message.toLowerCase().includes('not confirmed');
};

const isExistingUserError = (error: unknown) =>
  error instanceof Error && error.name === 'UsernameExistsException';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Authentication failed.';

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
  const [resendMsg, setResendMsg] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResendMsg('');

    try {
      if (needsVerification) {
        await confirmSignUp({ username: email, confirmationCode: code });
        const result = await signIn({
          username: email,
          password
        });
        if (!result.isSignedIn && result.nextStep.signInStep === 'CONFIRM_SIGN_UP') {
          setNeedsVerification(true);
          setError('This account still needs email confirmation. Resend the code and try again.');
        } else if (!result.isSignedIn) {
          setError(`Sign-in needs another step: ${result.nextStep.signInStep}`);
        }
        if (result.isSignedIn) setNeedsVerification(false);
      } else if (isLogin) {
        try {
          const result = await signIn({ username: email, password });
          if (!result.isSignedIn && result.nextStep.signInStep === 'CONFIRM_SIGN_UP') {
            setNeedsVerification(true);
            setError('This account is not confirmed. Enter the verification code sent to your email.');
          }
        } catch (signInError: unknown) {
          if (isUnconfirmedUserError(signInError)) {
            setNeedsVerification(true);
            setError('This account is not confirmed. Enter the verification code sent to your email.');
            return;
          }
          throw signInError;
        }
      } else {
        try {
          const result = await signUp({
            username: email,
            password,
            options: { userAttributes: { email } }
          });
          if (result.isSignUpComplete) {
            const signInResult = await signIn({
              username: email,
              password
            });
            if (!signInResult.isSignedIn && signInResult.nextStep.signInStep === 'CONFIRM_SIGN_UP') {
              setNeedsVerification(true);
              setError('This account is not confirmed. Enter the verification code sent to your email.');
            } else if (!signInResult.isSignedIn) {
              setError(`Sign-in needs another step: ${signInResult.nextStep.signInStep}`);
            }
          } else {
            setNeedsVerification(true);
          }
        } catch (signUpError: unknown) {
          if (!isExistingUserError(signUpError)) throw signUpError;
          try {
            const result = await signIn({ username: email, password });
            if (!result.isSignedIn && result.nextStep.signInStep === 'CONFIRM_SIGN_UP') {
              setNeedsVerification(true);
              setError('This account is not confirmed. Enter the verification code sent to your email.');
            }
          } catch (existingUserSignInError: unknown) {
            if (isUnconfirmedUserError(existingUserSignInError)) {
              setNeedsVerification(true);
              setError('This account is not confirmed. Enter the verification code sent to your email.');
              return;
            }
            throw new Error('An account with this email already exists. Sign in instead.');
          }
        }
      }
    } catch (authError: unknown) {
      setError(getErrorMessage(authError));
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email.trim()) {
      setError('Enter your email address to resend the verification code.');
      return;
    }
    setError('');
    try {
      await resendSignUpCode({ username: email });
      setResendMsg(`A new verification code was sent to ${email}.`);
    } catch (resendError: unknown) {
      setError(getErrorMessage(resendError));
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
            {needsVerification ? 'Verify your account' : isLogin ? 'Welcome Back' : 'Create your account'}
          </h2>
          <p className="text-heritage-400 text-xs font-medium px-4">
            {needsVerification
              ? 'Enter the verification code sent to your email before continuing.'
              : isLogin
                ? 'Sign in to continue to family vault setup or your vault.'
                : 'Create your account first. You can join or create a family vault after signing in.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!needsVerification ? (
            <>
              <input
                type="email"
                placeholder="Email Address"
                className="w-full bg-heritage-black border border-heritage-800 rounded-xl px-4 py-3 text-heritage-parchment outline-none focus:ring-2 focus:ring-heritage-gold transition-all text-sm font-medium"
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
              />
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  className="w-full bg-heritage-black border border-heritage-800 rounded-xl px-4 py-3 text-heritage-parchment outline-none focus:ring-2 focus:ring-heritage-gold transition-all text-sm font-medium pr-12"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-heritage-400 hover:text-heritage-gold transition-colors p-1"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-center text-heritage-parchment text-sm">Verification email sent to {email}</p>
              <input
                type="text"
                placeholder="Verification Code"
                className="w-full bg-heritage-black border border-heritage-800 rounded-xl px-4 py-3 text-heritage-parchment outline-none focus:ring-2 focus:ring-heritage-gold transition-all text-sm font-medium"
                value={code}
                onChange={event => setCode(event.target.value)}
                required
              />
              <p className="text-[10px] text-heritage-gold font-bold text-center">Enter the latest code sent to your email.</p>
            </>
          )}

          {resendMsg && <p className="text-heritage-gold text-xs font-bold text-center">{resendMsg}</p>}
          {error && <p className="text-heritage-sunset text-xs font-bold text-center bg-heritage-sunset/10 py-2 rounded-lg border border-heritage-sunset/20">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-heritage-gold to-heritage-sunset text-heritage-black font-black py-4 rounded-xl shadow-xl hover:opacity-90 active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : <ShieldCheck size={18} />}
            {needsVerification ? 'Verify & Continue' : isLogin ? 'Sign In' : 'Create Account'}
          </button>

          {needsVerification && (
            <button
              type="button"
              onClick={() => void handleResendCode()}
              className="w-full text-heritage-gold text-xs font-black uppercase tracking-widest hover:underline"
            >
              Resend Verification Code
            </button>
          )}
        </form>

        {!needsVerification && (
          <div className="space-y-4 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-heritage-gold text-xs font-black uppercase tracking-widest hover:underline"
            >
              {isLogin ? 'Create an account' : 'Already registered? Sign In'}
            </button>
            <div className="flex items-center gap-3 pt-2">
              <div className="flex-1 h-px bg-heritage-800" />
              <span className="text-[10px] text-heritage-400 uppercase font-black tracking-widest">Or</span>
              <div className="flex-1 h-px bg-heritage-800" />
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await signInWithRedirect({ provider: 'Google' });
                } catch (googleError: unknown) {
                  setError(getErrorMessage(googleError));
                }
              }}
              className="w-full bg-heritage-black border border-heritage-800 hover:border-heritage-gold text-heritage-parchment font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-wider cursor-pointer"
            >
              <span>Continue with Google</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;
