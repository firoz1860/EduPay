/**
 * @deprecated EduPay no longer talks to Supabase directly from the browser.
 * All data access now goes through the backend REST API via `lib/api.ts`.
 * This stub remains only to fail loudly if any legacy import is left behind.
 */
export const supabase = new Proxy(
  {},
  {
    get() {
      throw new Error(
        'Direct Supabase access has been removed. Use the API client in "@/lib/api" instead.',
      );
    },
  },
) as never;
