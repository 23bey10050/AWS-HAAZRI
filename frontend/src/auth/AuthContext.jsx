import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import {
  requestOtp as cognitoRequestOtp,
  verifyOtp as cognitoVerifyOtp,
  refreshTokens as cognitoRefreshTokens,
} from "./cognitoClient";
import { setAuthToken } from "../api/client";

const AuthContext = createContext(null);
const STORAGE_KEY = "haazri-auth-tokens";
const REFRESH_CHECK_MS = 5 * 60 * 1000; // check every 5 min while the app stays open

function loadStoredTokens() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // private browsing / storage disabled — session just won't persist
  }
}

function persistTokens(tokens) {
  try {
    if (tokens) localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore — nothing we can do if storage is unavailable
  }
}

// Decodes the JWT payload to read its expiry — no signature check needed client-side,
// the backend verifies the token on every request regardless.
function isExpired(idToken, bufferMs = 60_000) {
  try {
    const base64Url = idToken.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return Date.now() >= payload.exp * 1000 - bufferMs;
  } catch {
    return true;
  }
}

export function AuthProvider({ children }) {
  const [tokens, setTokensState] = useState(null); // { IdToken, AccessToken, RefreshToken }
  const [phone, setPhone] = useState(null);
  const [restoring, setRestoring] = useState(true); // true while attempting silent restore on boot
  const tokensRef = useRef(null);

  const setTokens = useCallback((t) => {
    tokensRef.current = t;
    setTokensState(t);
    persistTokens(t);
    setAuthToken(t?.IdToken ?? null);
  }, []);

  // On boot: restore a persisted session without ever asking for OTP again, unless the
  // refresh token itself has expired or been revoked.
  useEffect(() => {
    (async () => {
      const stored = loadStoredTokens();
      if (!stored?.RefreshToken) {
        setRestoring(false);
        return;
      }
      if (!isExpired(stored.IdToken)) {
        setTokens(stored);
        setRestoring(false);
        return;
      }
      try {
        const fresh = await cognitoRefreshTokens(stored.RefreshToken);
        setTokens({ ...fresh, RefreshToken: stored.RefreshToken });
      } catch {
        persistTokens(null); // refresh token expired/revoked — back to Login
      } finally {
        setRestoring(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While the app stays open across a long shift, proactively refresh before the
  // 1-hour IdToken actually expires, so an in-progress session never gets kicked out.
  useEffect(() => {
    const id = setInterval(async () => {
      const current = tokensRef.current;
      if (!current || !isExpired(current.IdToken)) return;
      try {
        const fresh = await cognitoRefreshTokens(current.RefreshToken);
        setTokens({ ...fresh, RefreshToken: current.RefreshToken });
      } catch {
        setTokens(null); // refresh token itself is gone — force back to Login
      }
    }, REFRESH_CHECK_MS);
    return () => clearInterval(id);
  }, [setTokens]);

  const requestOtp = useCallback(async (phoneE164) => {
    setPhone(phoneE164);
    return cognitoRequestOtp(phoneE164);
  }, []);

  const verifyOtp = useCallback(
    async (otp, session) => {
      const result = await cognitoVerifyOtp(phone, otp, session);
      setTokens(result);
      return result;
    },
    [phone, setTokens]
  );

  const logout = useCallback(() => {
    setTokens(null);
    setPhone(null);
  }, [setTokens]);

  return (
    <AuthContext.Provider value={{ tokens, phone, restoring, requestOtp, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
