import { single, type SearchParams } from '@/lib/api';

const ERRORS: Record<string, string> = {
  'email-taken': 'An account with this email already exists.',
  invalid: 'Fill in every field. The password needs at least 8 characters.',
};

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  if (single(params.sent)) {
    const email = single(params.email);
    return (
      <section className="card narrow">
        <h1>Check your email</h1>
        <p role="status">
          We sent a confirmation link to {email || 'your email address'}. Open it to activate your account.
        </p>
        <p>
          <a href="/login">Back to log in</a>
        </p>
      </section>
    );
  }

  const error = ERRORS[single(params.error) ?? ''];
  return (
    <section className="card narrow">
      <h1>Create your account</h1>
      {error ? (
        <p className="alert error" role="alert">
          {error}
        </p>
      ) : null}
      <form className="form" action="/api/signup" method="post">
        <div>
          <label htmlFor="companyName">Company name</label>
          <input id="companyName" name="companyName" type="text" required maxLength={200} autoComplete="organization" />
        </div>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        </div>
        <div>
          <button type="submit" className="button">
            Create account
          </button>
        </div>
      </form>
      <p className="muted">
        Already have an account? <a href="/login">Log in</a>
      </p>
    </section>
  );
}
