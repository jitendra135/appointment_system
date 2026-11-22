import { useState } from "react";
import type { FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ArrowRight, HeartPulse } from "lucide-react";

type AuthMode = "login" | "signup";

export default function AuthPage({
  client,
  configurationError,
  initialError,
}: {
  client: SupabaseClient | null;
  configurationError: string;
  initialError: string;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError("");
    setMessage("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!client) return;

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      if (mode === "signup") {
        const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
        const { data, error: signUpError } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: redirectTo,
          },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          setMessage("Your account is ready. You're signed in.");
        } else {
          setMessage("Check your email for a confirmation link to finish creating your account.");
        }
      } else {
        const { error: signInError } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication could not be completed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <a className="login-brand" href={import.meta.env.BASE_URL} aria-label="Wellnest home">
          <span className="brand-mark"><HeartPulse size={20} strokeWidth={2.2} /></span>
          <span>wellnest<span className="brand-period">.</span><small>CARE OPERATIONS</small></span>
        </a>
        <div className="login-intro">
          <span className="eyebrow">{mode === "signup" ? "CREATE YOUR ACCOUNT" : "WELCOME BACK"}</span>
          <h1>{mode === "signup" ? "Join your care portal" : "Sign in to your clinic"}</h1>
          <p>{mode === "signup" ? "Create an account with your email address." : "Manage appointments and keep care moving."}</p>
        </div>
        {initialError && <p className="login-error" role="alert">{initialError}</p>}
        {client ? (
          <>
            <form className="login-form" onSubmit={(event) => void submit(event)}>
              {mode === "signup" && (
                <label className="login-field">
                  <span>Full name</span>
                  <input required autoComplete="name" value={fullName} onChange={(event) => { setFullName(event.target.value); setError(""); }} placeholder="Your name" />
                </label>
              )}
              <label className="login-field">
                <span>Email address</span>
                <input required type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="you@example.com" />
              </label>
              <label className="login-field">
                <span>Password</span>
                <input required minLength={8} type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"} />
              </label>
              {error && <p className="login-error" role="alert">{error}</p>}
              {message && <p className="login-message" role="status">{message}</p>}
              <button className="primary-button login-submit" type="submit" disabled={submitting}>
                {submitting ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
                {!submitting && <ArrowRight size={16} />}
              </button>
            </form>
            <p className="login-switch">
              {mode === "signup" ? "Already have an account?" : "New to Wellnest?"}
              <button type="button" onClick={() => changeMode(mode === "signup" ? "login" : "signup")}>
                {mode === "signup" ? "Sign in" : "Create account"}
              </button>
            </p>
          </>
        ) : (
          <p className="login-message" role="status">{configurationError}</p>
        )}
        <p className="login-demo-hint">Use a valid email address. New accounts may need email confirmation.</p>
        <p className="login-demo-hint">Appointment requests are shared with authorized clinic staff. Use a private password and do not enter real patient information until your clinic has approved this system for it.</p>
      </section>
      <p className="login-footer">WELLNEST <i>·</i> CARE, IN GOOD ORDER</p>
    </main>
  );
}
