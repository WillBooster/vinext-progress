// skipLibCheck hides an unresolvable specifier in next.d.ts, so import the same modules from a checked file.
import type Form from 'vinext/shims/form';
import type Link from 'vinext/shims/link';
import type * as Navigation from 'vinext/shims/navigation';

export type NextShims = [typeof Form, typeof Link, typeof Navigation];
