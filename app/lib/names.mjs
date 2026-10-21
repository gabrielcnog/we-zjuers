/* ---------- How a person is named ----------
   Students see each other formally: NOGUEIRA, Gabriel. The wider web does
   not — a signed-out visitor browsing the marketplace sees "Gabriel N.",
   the short display_name the account was created with.

   That split is deliberate. Attendance lists, seller cards and posts all
   carry real names now, and a full surname on a public page is indexable by
   search engines and readable by anyone who finds the URL. Signing in is the
   line: inside the community you are a named classmate, outside it you are a
   first name and an initial.

   Accounts created before names were split have no family/given parts and
   fall back to display_name everywhere, so nothing renders blank.           */

export function personName({ family, given, fallback }, signedIn) {
  if (signedIn && family && given) return `${family.toUpperCase()}, ${given}`;
  return fallback || '';
}

/* Initials are not identifying — one letter each — so they use the real
   parts whether or not anyone is signed in, and stay stable between the two
   name forms instead of flipping from "Ga" to "GN" at sign-in. */
export function personInitials({ family, given, fallback }) {
  if (family && given) return (given[0] + family[0]).toUpperCase();
  return (fallback || '?').slice(0, 2);
}
