import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Sparkles } from "lucide-react";
import "./early-access.css";

const API_URL = "https://clickok-early-access-gate.onrender.com/api";
const STORAGE_KEY = "clickok_early_access_session_v1";

type Props = { children: ReactNode };

export default function EarlyAccessGate({ children }: Props) {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const token = window.localStorage.getItem(STORAGE_KEY);
    if (!token) {
      setChecking(false);
      return () => { active = false; };
    }
    fetch(`${API_URL}/access/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async response => response.ok ? response.json() : null)
      .then(result => {
        if (!active) return;
        if (result?.valid) setAuthorized(true);
        else window.localStorage.removeItem(STORAGE_KEY);
      })
      .catch(() => {
        if (active) setError("No pudimos conectar con el acceso. Intenta nuevamente.");
      })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  const unlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/access/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.token) throw new Error(result.error || "No fue posible validar el código.");
      window.localStorage.setItem(STORAGE_KEY, result.token);
      setAuthorized(true);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible validar el código.");
    } finally {
      setSubmitting(false);
    }
  };

  if (authorized) return <>{children}</>;

  return (
    <main className="early-access-screen">
      <div className="early-access-grid" aria-hidden="true" />
      <div className="early-access-orb early-access-orb-one" aria-hidden="true" />
      <div className="early-access-orb early-access-orb-two" aria-hidden="true" />
      <section className="early-access-content">
        <a className="early-access-brand" href="/" aria-label="CLICKOK">
          <img src="/brand-clickok-white.svg" alt="CLICKOK" />
        </a>
        <div className="early-access-card">
          <div className="early-access-symbol"><span /><LockKeyhole size={23} strokeWidth={1.7} /></div>
          <div className="early-access-kicker"><Sparkles size={13} /> ACCESO ANTICIPADO · INVITACIÓN EXCLUSIVA</div>
          <h1>Hay algo nuevo<br /><span>esperándote.</span></h1>
          <p className="early-access-description">Estamos preparando una nueva forma de hacer crecer tu negocio. Y tú estás a punto de descubrirla.</p>
          {checking ? (
            <div className="early-access-checking"><span className="early-access-spinner" /> Preparando tu acceso…</div>
          ) : (
            <form className="early-access-form" onSubmit={unlock}>
              <label htmlFor="early-access-password">Tu código de acceso</label>
              <div className="early-access-input-wrap">
                <LockKeyhole size={17} />
                <input
                  id="early-access-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  placeholder="Introduce tu contraseña"
                  autoComplete="current-password"
                  autoFocus
                  required
                />
                <button type="button" className="early-access-visibility" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {error && <p className="early-access-error" role="alert">{error}</p>}
              <button className="early-access-submit" type="submit" disabled={submitting || !password.trim()}>
                <span>{submitting ? "Verificando…" : "Desbloquear acceso"}</span>
                {!submitting && <ArrowRight size={18} />}
                {submitting && <span className="early-access-button-spinner" />}
              </button>
            </form>
          )}
          <div className="early-access-card-foot"><span className="early-access-status-dot" /> Plataforma en fase de pruebas</div>
        </div>
        <p className="early-access-footer">Una experiencia privada de <strong>AtomLabs</strong></p>
      </section>
    </main>
  );
}
