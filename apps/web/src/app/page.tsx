import { redirect } from 'next/navigation';

/**
 * Root page — routes to /login (if signed out) or /home (if signed in).
 * Client-side hydration handles the actual check via /login useEffect.
 */
export default function Root() {
  redirect('/login');
}
