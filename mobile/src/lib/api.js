// Klient mod Tennis Makker-API'et (/api/v1 i web-repoet).
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const BASE_URL =
  Constants.expoConfig?.extra?.apiUrl ?? "https://tennis-makker.onrender.com";

const TOKEN_KEY = "tm_token";

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token) {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${BASE_URL}/api/v1${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Serveren på gratis-planen sover og kan tage op mod et minut at vågne
    throw new Error("Kan ikke få forbindelse. Tjek dit netværk og prøv igen.");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Der gik noget galt.");
  return data;
}

export const api = {
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: { email, password }, auth: false }),
  signup: (payload) =>
    request("/auth/signup", { method: "POST", body: payload, auth: false }),
  me: () => request("/me"),

  clubs: () => request("/clubs", { auth: false }),
  club: (slug, days = 7) => request(`/clubs/${slug}?dage=${days}`, { auth: false }),

  coaches: (area) =>
    request(`/coaches${area ? `?omraade=${encodeURIComponent(area)}` : ""}`, {
      auth: false,
    }),
  coach: (id) => request(`/coaches/${id}`, { auth: false }),

  matches: (params = {}) => {
    const q = new URLSearchParams();
    if (params.area) q.set("omraade", params.area);
    if (params.level) q.set("niveau", String(params.level));
    const qs = q.toString();
    return request(`/matches${qs ? `?${qs}` : ""}`);
  },
  createMatch: (payload) => request("/matches", { method: "POST", body: payload }),
  acceptMatch: (id) => request(`/matches/${id}/accept`, { method: "POST" }),

  swipeQueue: () => request("/swipe"),
  swipe: (toUserId, liked) =>
    request("/swipe", { method: "POST", body: { toUserId, liked } }),

  pendingReviews: () => request("/reviews"),
  review: (bookingId, rating, comment) =>
    request("/reviews", { method: "POST", body: { bookingId, rating, comment } }),

  threads: () => request("/threads"),
  thread: (id) => request(`/threads/${id}`),
  sendMessage: (id, body) =>
    request(`/threads/${id}`, { method: "POST", body: { body } }),

  bookings: () => request("/bookings"),
  book: (payload) => request("/bookings", { method: "POST", body: payload }),
};

export const checkoutUrl = (path) => `${BASE_URL}${path}`;
