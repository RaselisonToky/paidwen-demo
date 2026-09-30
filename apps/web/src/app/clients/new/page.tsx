import { requireUserId, single, type SearchParams } from '@/lib/api';

export default async function NewClientPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUserId();
  const params = await searchParams;
  const error = single(params.error) === 'invalid' ? 'Fill in the name and the email address.' : undefined;
  return (
    <section className="card narrow">
      <h1>New client</h1>
      {error ? (
        <p className="alert error" role="alert">
          {error}
        </p>
      ) : null}
      <form className="form" action="/api/clients" method="post">
        <div>
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" required maxLength={200} />
        </div>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required />
        </div>
        <div className="actions">
          <button type="submit" className="button">
            Create client
          </button>
          <a href="/clients" className="button secondary">
            Cancel
          </a>
        </div>
      </form>
    </section>
  );
}
