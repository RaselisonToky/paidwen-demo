import { notFound, redirect } from 'next/navigation';
import { currentUserId } from './session';

export const API_URL = (process.env.API_URL || 'http://api:4000').replace(/\/$/, '');

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export interface ApiResponse<T> {
  status: number;
  data: T;
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  userId?: string | null;
}

/** Calls the API from the server. The browser never talks to the API directly. */
export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  if (options.userId) {
    headers['x-user-id'] = options.userId;
  }
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, data: data as T };
}

/** Pages call this first: it returns the user id or sends the visitor to the login page. */
export async function requireUserId(): Promise<string> {
  const userId = await currentUserId();
  if (!userId) {
    redirect('/login');
  }
  return userId;
}

/** Loads a resource for a page and maps API errors to the matching Next.js behaviour. */
export async function load<T>(path: string, userId: string): Promise<T> {
  const response = await api<T>(path, { userId });
  if (response.status === 401) {
    redirect('/login');
  }
  if (response.status === 404) {
    notFound();
  }
  if (response.status >= 400) {
    throw new Error(`The API answered ${response.status} for ${path}`);
  }
  return response.data;
}

/** A 303 redirect. Route handlers answer form submissions with it. */
export function seeOther(location: string, setCookie?: string): Response {
  const headers = new Headers({ location });
  if (setCookie) {
    headers.append('set-cookie', setCookie);
  }
  return new Response(null, { status: 303, headers });
}

export function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
