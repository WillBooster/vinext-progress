import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function RedirectSelfPage(): never {
  // Sends the user back to the page they navigated from, so the committed URL
  // equals the starting URL and usePathname/useSearchParams never change.
  redirect('/');
}
