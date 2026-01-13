import { fetchPrivyTokens, handlePrivyToken } from './checkToken.js';

export async function getCurrentBearerToken() {
  // Ensure token is fresh, then return it
  await handlePrivyToken(); // This will refresh if expired
  const tokens = await fetchPrivyTokens();

  // Try regular token first, fallback to PAT
  const token = tokens?.privy_token || tokens?.privy_pat || null;
  return token;
}