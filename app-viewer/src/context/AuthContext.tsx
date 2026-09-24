/**
 * ============================================================================
 * Desktop Viewer Authentication Context & Token Decoder
 * ============================================================================
 * Enterprise Architecture Strategy: Global Auth Context & ID Token Claims Extraction.
 * Configures AWS Amplify Auth, checks active Cognito session states, decodes
 * user attributes (email & custom:familyId), and triggers instant UI state sync.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Amplify } from 'aws-amplify';
import { getCurrentUser, fetchAuthSession, signIn, signUp, confirmSignUp, signOut, type AuthUser } from 'aws-amplify/auth';

const USER_POOL_ID = import.meta.env.VITE_USER_POOL_ID;
const APP_CLIENT_ID = import.meta.env.VITE_APP_CLIENT_ID;

console.log('Auth Configuration:', { USER_POOL_ID, APP_CLIENT_ID });

// Initialize AWS Amplify Auth Plugin
if (USER_POOL_ID && APP_CLIENT_ID) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: USER_POOL_ID,
        userPoolClientId: APP_CLIENT_ID,
        signUpVerificationMethod: 'code'
      }
    }
  });
} else {
  console.error('CRITICAL: Cognito User Pool or Client ID is missing. Check environment variables.');
}

export interface UserProfile {
  email: string | null;
  familyId: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  userProfile: UserProfile;
  loading: boolean;
  signIn: typeof signIn;
  signUp: typeof signUp;
  confirmSignUp: typeof confirmSignUp;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>({ email: null, familyId: null });
  const [loading, setLoading] = useState(true);

  /**
   * Verifies active Cognito user session and extracts ID Token payload claims.
   */
  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      const session = await fetchAuthSession();
      const payload = session.tokens?.idToken?.payload;
      const email = (payload?.email as string) || (currentUser.signInDetails?.loginId as string) || currentUser.username;
      const familyId = (payload?.['custom:familyId'] as string) || null;

      setUserProfile({ email, familyId });
    } catch (err) {
      setUser(null);
      setUserProfile({ email: null, familyId: null });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkUser();
  }, []);

  /**
   * Wrapped SignIn Function: Triggers instant React state sync on successful authentication.
   * Uses rest parameters (...args) to resolve TypeScript overload signatures cleanly.
   */
  const handleSignIn = async (...args: Parameters<typeof signIn>) => {
    const result = await signIn(...args);
    if (result.isSignedIn) {
      await checkUser();
    }
    return result;
  };

  /**
   * Wrapped ConfirmSignUp Function: Triggers state check on confirmation complete.
   */
  const handleConfirmSignUp = async (...args: Parameters<typeof confirmSignUp>) => {
    const result = await confirmSignUp(...args);
    if (result.isSignUpComplete) {
      await checkUser();
    }
    return result;
  };

  /**
   * Signs out current user and resets in-memory profile state.
   */
  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    setUserProfile({ email: null, familyId: null });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        signIn: handleSignIn as typeof signIn,
        signUp,
        confirmSignUp: handleConfirmSignUp as typeof confirmSignUp,
        signOut: handleSignOut,
        refreshProfile: checkUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
