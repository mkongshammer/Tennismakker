// Global login-tilstand, så alle skærme kender brugeren.
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setToken, getToken, onSessionExpired } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState(null);

  const restore = useCallback(async () => {
    setLoading(true); setSessionError(null);
    try { if (await getToken()) setUser((await api.me()).user); }
    catch (error) { if (error.status !== 401) setSessionError(error.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { restore(); return onSessionExpired(() => { setUser(null); setSessionError(null); }); }, [restore]);

  const login = async (email, password) => {
    const { token, user: u } = await api.login(email, password);
    await setToken(token);
    setUser(u);
  };

  const signup = async (payload) => {
    const { token, user: u } = await api.signup(payload);
    await setToken(token);
    setUser(u);
  };

  const logout = async () => {
    await setToken(null);
    setUser(null);
    setSessionError(null);
  };

  const deleteAccount = async () => {
    await api.deleteAccount();
    await setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, sessionError, restore, login, signup, logout, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth skal bruges inde i AuthProvider");
  return ctx;
}
