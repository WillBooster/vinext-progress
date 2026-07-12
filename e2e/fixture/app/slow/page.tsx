import Form from 'next/form';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

export default async function SlowPage(): Promise<ReactNode> {
  // Slow server render so the progress bar is reliably observable during navigation.
  await new Promise((resolve) => setTimeout(resolve, 800));
  return (
    <>
      <h1>Slow page</h1>
      {/* Submits to the current pathname; only the search params change. */}
      <Form action="/slow">
        <input defaultValue="test" name="q" type="text" />
        <button data-testid="form-same-path" type="submit">
          Search on this page
        </button>
      </Form>
    </>
  );
}
