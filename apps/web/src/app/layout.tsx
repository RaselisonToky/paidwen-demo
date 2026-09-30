import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import type { MeDto } from '@norbill/shared';
import { api } from '@/lib/api';
import { currentUserId } from '@/lib/session';
import './globals.css';

export const metadata: Metadata = {
  title: 'Norbill',
  description: 'Invoicing for freelancers and small teams.',
};

async function loadMe(): Promise<MeDto | null> {
  const userId = await currentUserId();
  if (!userId) {
    return null;
  }
  try {
    const response = await api<MeDto>('/me', { userId });
    return response.status === 200 ? response.data : null;
  } catch {
    return null;
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const me = await loadMe();
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <a className="brand" href={me ? '/dashboard' : '/login'}>
              Norbill
            </a>
            {me ? (
              <>
                <nav aria-label="Main">
                  <a href="/dashboard">Dashboard</a>
                  <a href="/clients">Clients</a>
                  <a href="/invoices">Invoices</a>
                  <a href="/billing">Billing</a>
                </nav>
                <span className="muted">{me.user.email}</span>
                <form action="/api/logout" method="post">
                  <button type="submit" className="button secondary">
                    Log out
                  </button>
                </form>
              </>
            ) : (
              <nav aria-label="Main">
                <a href="/login">Log in</a>
                <a href="/signup">Sign up</a>
              </nav>
            )}
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
