import Constants from "expo-constants";
import { getToken } from "./api";

const BASE_URL = Constants.expoConfig?.extra?.apiUrl ?? "https://racketbuddy.app";

async function postAction(threadId, body) {
  const token = await getToken();
  const response = await fetch(`${BASE_URL}/api/v1/threads/${encodeURIComponent(threadId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error ?? data?.message ?? "The action could not be completed.");
  return data;
}

export const moderationApi = {
  reportThread: (threadId, reason, messageId = null) =>
    postAction(threadId, { action: "report", reason, messageId }),
  blockThreadUser: (threadId) => postAction(threadId, { action: "block" }),
  unblockThreadUser: (threadId) => postAction(threadId, { action: "unblock" }),
};
