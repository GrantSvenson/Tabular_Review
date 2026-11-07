// Only the backend URL is public. Credentials stay in the Python service.
export const API_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export async function readApiResponse(response: Response): Promise<any> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof data?.detail === 'string' ? data.detail : `Request failed (${response.status}).`);
  }
  if (!data) throw new Error('The server returned an invalid response.');
  return data;
}
