import { single, type SearchParams } from '@/lib/api';

const ERRORS: Record<string, string> = {
  invalid: 'Invalid email or password.',
  unconfirmed: 'Confirm your email first.',
  'invalid-token': 'This confirmation link is invalid or has already been used.',
};

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const error = ERRORS[single(params.error) ?? ''];
  return (
    <section className="card narrow">
      <h1>Log in</h1>
      {error ? (
        <p className="alert error" role="alert">
          {error}
        </p>
      ) : null}
      <form className="form" action="/api/login" method="post">
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <div>
          <button type="submit" className="button">
            Log in
          </button>
        </div>
      </form>
      <p className="muted">
        No account yet? <a href="/signup">Create an account</a>
      </p>
    </section>
  );
}
