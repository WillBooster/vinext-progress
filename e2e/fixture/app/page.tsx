import Form from 'next/form';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { ManualControls } from './ManualControls';
import { PushButton } from './PushButton';

export default function HomePage(): ReactNode {
  return (
    <main>
      <h1>Home</h1>
      <ul>
        <li>
          <Link data-testid="to-slow" href="/slow" prefetch={false}>
            Slow page
          </Link>
        </li>
        <li>
          <Link data-testid="to-instant" href="/instant">
            Instant page
          </Link>
        </li>
        <li>
          <Link data-testid="to-same" href="/">
            Same URL
          </Link>
        </li>
        <li>
          <a data-testid="to-hash" href="#bottom">
            Hash only
          </a>
        </li>
        <li>
          <Link data-testid="to-redirect-self" href="/redirect-self" prefetch={false}>
            Redirect back to this page
          </Link>
        </li>
        <li>
          <PushButton />
        </li>
        <li>
          <ManualControls />
        </li>
        <li>
          <Form action="/slow">
            <button data-testid="form-to-slow" type="submit">
              Submit form to slow page
            </button>
          </Form>
        </li>
      </ul>
      <div id="bottom" />
    </main>
  );
}
