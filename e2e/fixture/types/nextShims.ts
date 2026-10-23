// skipLibCheck hides an unresolvable specifier in next.d.ts, which silently leaves a next/* module untyped.
// Each assignment below is a type error only while its module is typed, so a broken specifier turns the
// directive into an "unused @ts-expect-error" error.
import type NextForm from 'next/form';
import type NextLink from 'next/link';
import type * as NextNavigation from 'next/navigation';

// @ts-expect-error -- next/form must be typed as vinext's Form component.
export const form: typeof NextForm = 0;
// @ts-expect-error -- next/link must be typed as vinext's Link component.
export const link: typeof NextLink = 0;
// @ts-expect-error -- next/navigation must be typed as vinext's navigation module.
export const navigation: typeof NextNavigation = 0;
