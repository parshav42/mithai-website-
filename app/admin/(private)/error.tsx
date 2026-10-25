"use client";

export default function AdminDataError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section role="alert" className="border border-maroon/25 bg-white p-6">
      <h1 className="font-display text-2xl text-maroon">Administrator data is unavailable</h1>
      <p className="mt-3 text-sm leading-6 text-brown/75">
        Check the PostgreSQL connection, apply the documented database migration, and try again.
        No sample sales or customer records are shown.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 border border-maroon px-4 py-2 text-sm font-semibold text-maroon hover:bg-maroon hover:text-ivory focus-visible:outline-2 focus-visible:outline-saffron"
      >
        Retry
      </button>
    </section>
  );
}
