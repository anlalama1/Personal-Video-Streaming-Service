/**
 * ============================================================================
 * Desktop Viewer Authentication Context & Token Decoder
 * ============================================================================
 * Enterprise Architecture Strategy: Global Auth Context & ID Token Claims Extraction.
 * Configures AWS Amplify Auth with OAuth Hosted UI domain settings, checks active
 * Cognito session states, decodes user attributes (email & custom:familyId), and
 * triggers instant UI state sync.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Amplify } from 'aws-amplify';
import { getCurrentUser, fetchAuthSession, signIn, signUp, confirmSignUp, signOut, type AuthUser } from 'aws-amplify/auth';
import api from '../api';

const USER_POOL_ID = import.meta.env.VITE_USER_POOL_ID;
const APP_CLIENT_ID = import.meta.env.VITE_APP_CLIENT_ID;
const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN || 'alexandria-vault-668616.auth.us-east-1.amazoncognito.com';

console.log('Auth Configuration:', { USER_POOL_ID, APP_CLIENT_ID, COGNITO_DOMAIN });

// Initialize AWS Amplify Auth Plugin with OAuth 2.0 Identity Federation configuration
if (USER_POOL_ID && APP_CLIENT_ID) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: USER_POOL_ID,
        userPoolClientId: APP_CLIENT_ID,
        signUpVerificationMethod: 'code',
        loginWith: {
          oauth: {
            domain: COGNITO_DOMAIN,
            scopes: ['email', 'openid', 'profile'],
            redirectSignIn: ['https://www.alexandria-plus.com/', 'http://localhost:5173/'],
            redirectSignOut: ['https://www.alexandria-plus.com/', 'http://localhost:5173/'],
            responseType: 'code'
          }
        }
      }
    }
  });
} else {
  console.error('CRITICAL: Cognito User Pool or Client ID is missing. Check environment variables.');
}

export interface UserProfile {
  email: string | null;
  familyId: string | null;
  isAdmin: boolean;
  isApproved: boolean;
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
  const [userProfile, setUserProfile] = useState<UserProfile>({
    email: null,
    familyId: null,
    isAdmin: false,
    isApproved: false
  });
  const [loading, setLoading] = useState(true);

  /**
   * Verifies active Cognito user session and extracts ID Token payload claims.
   * Keeps loading=true during token refresh to suppress premature "No Vault" warnings.
   */
  const checkUser = async () => {
    setLoading(true);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      let session = await fetchAuthSession();
      let payload = session.tokens?.idToken?.payload;
      const email = (payload?.email as string) || (currentUser.signInDetails?.loginId as string) || currentUser.username;
      let familyId = (payload?.['custom:familyId'] as string) || null;

      if (familyId) {
        try {
          await api.post('vault/members');
          session = await fetchAuthSession({ forceRefresh: true });
          payload = session.tokens?.idToken?.payload;
          familyId = (payload?.['custom:familyId'] as string) || familyId;
        } catch (registrationError) {
          console.error('Failed to initialize family vault membership:', registrationError);
        }
      }

      setUserProfile({
        email: (payload?.email as string) || email,
        familyId,
        isAdmin: payload?.['custom:isAdmin'] === 'true',
        isApproved: payload?.['custom:isApproved'] === 'true'
      });
    } catch (err) {
      setUser(null);
      setUserProfile({ email: null, familyId: null, isAdmin: false, isApproved: false });
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
    setLoading(true);
    try {
      const result = await signIn(...args);
      if (result.isSignedIn) {
        await checkUser();
      }
      return result;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Wrapped ConfirmSignUp Function: Triggers state check on confirmation complete.
   */
  const handleConfirmSignUp = async (...args: Parameters<typeof confirmSignUp>) => {
    setLoading(true);
    try {
      const result = await confirmSignUp(...args);
      if (result.isSignUpComplete) {
        await checkUser();
      }
      return result;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Signs out current user and resets in-memory profile state.
   */
  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    setUserProfile({ email: null, familyId: null, isAdmin: false, isApproved: false });
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
