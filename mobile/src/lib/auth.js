// Global login-tilstand, så alle skærme kender brugeren.
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, clearSessionTokens, getRefreshToken, getToken, onSessionExpired, setSessionTokens } from "./api";

import { restoreInternational,setInternational } from "./international";
import { disablePush } from "./push";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState(null);

  const restore = useCallback(async () => {
    setLoading(true); setSessionError(null);
    try {
      await restoreInternational();
      if (await getToken()) {
        const u=(await api.me()).user;
        setUser(u);
        await setInternational(u);
        // Existing installations only have the old bearer token. Upgrade it
        // while it is still valid so those users are never forced to sign in
        // again just because the legacy 30-day token reaches its expiry.
        if (!(await getRefreshToken())) {
          const persistent = await api.bootstrapSession();
          await setSessionTokens(persistent.token, persistent.refreshToken);
        }
      }
    }
    catch (error) { if (error.status !== 401) setSessionError(error.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { restore(); return onSessionExpired(() => { setUser(null); setSessionError(null); }); }, [restore]);

  const acceptSession = async (result) => {
    await setSessionTokens(result.token, result.refreshToken);
    setUser(result.user);
    await setInternational(result.user);
    return result.user;
  };

  const login = async (email, password, clubOnly = false) => {
    const result = await api.login(email, password);
    if (clubOnly && result.user.role !== "CLUB_ADMIN") throw Error("Brug en klubadministrators konto her. Spillere og trænere bruger almindeligt login.");
    return acceptSession(result);
  };

  const signup = async (payload) => acceptSession(await api.signup(payload));
  const socialLogin = async (payload) => acceptSession(await api.socialLogin(payload));
  const requestPasswordReset = async (email) => api.requestPasswordReset(email);

  const savePreferences=async payload=>{const u=(await api.savePreferences(payload)).user;setUser(u);await setInternational(u);};
  const saveLocation=async payload=>{const u=(await api.saveLocation(payload)).user;setUser(u);await setInternational(u);};

  const logout = async () => {
    try { await disablePush(); } catch {}
    try { await api.logout(user?.country); } catch {}
    await clearSessionTokens();
    setUser(null);
    setSessionError(null);
  };

  const deleteAccount = async () => {
    await api.deleteAccount();
    await clearSessionTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, sessionError, restore, login, signup, socialLogin, requestPasswordReset, logout, deleteAccount,savePreferences,saveLocation }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth skal bruges inde i AuthProvider");
  return ctx;
}
