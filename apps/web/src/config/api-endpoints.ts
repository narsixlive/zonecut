/**
 * Centralized API endpoint configuration.
 *
 * All external service URLs should be defined here so they can be
 * swapped for different environments or self-hosted instances.
 */

const isDev = import.meta.env.DEV;

/** OpenReel cloud services */
// ZoneScene studio: no OpenReel cloud (no media or template leaves the machine). Empty = disabled.
export const OPENREEL_CLOUD_URL = isDev
  ? "http://localhost:8787"
  : (import.meta.env.VITE_OPENREEL_CLOUD_URL ?? "");

/**
 * Third-party API base URLs.
 * These are used by the api-proxy service in dev mode (direct calls)
 * and by the Cloudflare Pages Function proxy in production.
 * Application code should use apiFetch() from services/api-proxy.ts
 * instead of importing these directly.
 */
