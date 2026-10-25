"use client";

import { useActionState } from "react";
import { authenticateAdministrator } from "./actions";

export function AdministratorLoginForm() {
  const [state, action, pending] = useActionState(authenticateAdministrator, {});

  return (
    <form action={action} className="mt-8 space-y-5">
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium">
          Administrator email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
          className="w-full border border-brown/25 bg-white px-3 py-3 focus-visible:outline-2 focus-visible:outline-saffron"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={1024}
          className="w-full border border-brown/25 bg-white px-3 py-3 focus-visible:outline-2 focus-visible:outline-saffron"
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-maroon">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-maroon px-5 py-3 font-semibold text-ivory transition-colors hover:bg-brown disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Verifying…" : "Sign in securely"}
      </button>
    </form>
  );
}
