import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Interacting before hydration would fall back to full-page navigations.
  await expect(page.getByTestId('hydrated')).toBeAttached();
});

test('link click: bar appears during a slow navigation and disappears after commit', async ({ page }) => {
  await page.getByTestId('to-slow').click();
  await expect(page.getByRole('progressbar')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Slow page' })).toBeVisible();
  // Regression guard for pushState-patching loaders under vinext:
  // the bar must complete right after the URL commit instead of lingering.
  await expect(page.getByRole('progressbar')).toHaveCount(0);
});

test('router.push: bar appears and completes', async ({ page }) => {
  await page.getByTestId('push-slow').click();
  await expect(page.getByRole('progressbar')).toBeVisible();
  await expect(page).toHaveURL(/\/slow\?via=push$/);
  await expect(page.getByRole('heading', { name: 'Slow page' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
});

// vinext's own `<Link>` requires `target === '_self'` exactly, so an uppercase `_SELF` falls back to a
// full page load. The bar must stay away rather than announce a client-side navigation that never happens.
test('link click with an uppercase _SELF target: bar does not start, matching the router', async ({ page }) => {
  await page.getByTestId('to-slow-uppercase-target').click();
  await expect(page.getByRole('heading', { name: 'Slow page' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
});

test('instant navigation: bar never lingers', async ({ page }) => {
  await page.getByTestId('to-instant').click();
  await expect(page.getByRole('heading', { name: 'Instant page' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
});

test('same-URL link click: bar completes without lingering', async ({ page }) => {
  // vinext really performs this navigation (it refetches the page), so the
  // settlement watcher may briefly show the bar; it must finish promptly even
  // though the committed URL never changes.
  await page.getByTestId('to-same').click();
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
});

test('hash-only link click: bar does not start', async ({ page }) => {
  await page.getByTestId('to-hash').click();
  await expect(page).toHaveURL(/#bottom$/);
  await expect(page.getByRole('progressbar')).toHaveCount(0);
});

test('redirect back to the same URL: bar completes without a URL change', async ({ page }) => {
  await page.getByTestId('to-redirect-self').click();
  await expect(page.getByRole('progressbar')).toBeVisible();
  // The committed URL equals the starting URL, so usePathname/useSearchParams
  // never change; the bar must still finish well before the stall timeout.
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});

test('next/form GET submission: bar appears and completes', async ({ page }) => {
  await page.getByTestId('form-to-slow').click();
  await expect(page.getByRole('progressbar')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Slow page' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
});

test('next/form GET submission to the same pathname: bar appears and completes', async ({ page }) => {
  await page.getByTestId('to-slow').click();
  await expect(page.getByRole('heading', { name: 'Slow page' })).toBeVisible();
  await page.getByTestId('form-same-path').click();
  // Only the search params change; the predicted destination differs from the
  // current URL, so the bar must start and then finish on the commit.
  await expect(page.getByRole('progressbar')).toBeVisible();
  await expect(page).toHaveURL(/\/slow\?q=test$/);
  await expect(page.getByRole('progressbar')).toHaveCount(0);
});

test('manually started bar survives an idle history commit', async ({ page }) => {
  await page.getByTestId('manual-start').click();
  const bar = page.getByRole('progressbar');
  await expect(bar).toBeVisible();
  await page.getByTestId('idle-commit').click();
  // vinext rewrites pendingPathname = null over null on idle commits; the bar
  // must keep trickling instead of being finished by the settlement watcher.
  // A wrongly finished bar reaches aria-valuenow=100 and unmounts within
  // 2 * speed = 400ms, so wait past that window before asserting.
  await page.waitForTimeout(800);
  await expect(bar).toBeVisible();
  expect(Number(await bar.getAttribute('aria-valuenow'))).toBeLessThan(100);
});

test('hung navigation: bar finishes via the in-flight timeout', async ({ page }) => {
  // Hold the slow page's RSC request open forever: vinext never settles the
  // navigation, so only the in-flight timeout can clear the bar.
  await page.route('**/slow*', () => {});
  await page.getByTestId('to-slow').click();
  await expect(page.getByRole('progressbar')).toBeVisible();
  // The fixture sets inFlightTimeoutMs=3000; the bar must clear despite the
  // navigation never settling (default toHaveCount timeout is 5s > 3s).
  await expect(page.getByRole('progressbar')).toHaveCount(0);
});

test('back/forward traversal that refetches: bar appears and completes', async ({ page }) => {
  await page.getByTestId('to-slow').click();
  await expect(page.getByRole('heading', { name: 'Slow page' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  // Reload to drop vinext's in-memory history snapshots, so the forward
  // traversal must refetch the slow page instead of restoring instantly.
  await page.reload();
  await expect(page.getByTestId('hydrated')).toBeAttached();
  await page.goForward();
  // Traversals have no click or router-call signal; only the settlement
  // watcher's start path can show the bar here.
  await expect(page.getByRole('progressbar')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Slow page' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
});

test('back/forward: no stuck bar', async ({ page }) => {
  await page.getByTestId('to-slow').click();
  await expect(page.getByRole('heading', { name: 'Slow page' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Slow page' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
});

test('modified click (meta key): bar does not start', async ({ page }) => {
  await page.getByTestId('to-slow').click({ modifiers: ['ControlOrMeta'] });
  await expect(page.getByRole('progressbar')).toHaveCount(0);
});
