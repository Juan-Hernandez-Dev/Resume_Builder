import { NextResponse } from "next/server";

/**
 * Guards for the local-mode route handlers, which read and write files on
 * this machine (/api/variants) or launch a browser (/api/pdf). Each guard
 * returns the response to send when the request is refused, or `null` to let
 * it through.
 */

/** The 403 message of the variant routes, which hold the user's resume. */
export const LOCAL_ONLY =
  "Your resume files can only be reached when the app is opened on this machine.";

/**
 * Whether a request's `Host` header (port optional) names this machine.
 *
 * The local routes only answer requests addressed to a loopback name. That
 * turns away a page on another site that rebinds its own DNS name to
 * 127.0.0.1 in order to call this API as if it were same-origin, and a
 * request from another device when the server is bound to every interface.
 * Garbage that does not parse as a host is refused too.
 */
export function isLoopbackHost(hostHeader: string | null): boolean {
  if (!hostHeader) return false;

  let hostname: string;
  try {
    hostname = new URL(`http://${hostHeader}`).hostname;
  } catch {
    return false;
  }
  return (
    hostname === "localhost" ||
    hostname === "[::1]" ||
    /^127(\.\d{1,3}){3}$/.test(hostname)
  );
}

/**
 * 415 unless the body is sent as `application/json`. A cross-site page cannot
 * send that type without a CORS preflight, which these routes never answer,
 * so another tab cannot make the server act on a body of its choosing.
 */
export function requireJsonBody(request: Request): NextResponse | null {
  const type = request.headers.get("content-type") ?? "";
  if (type.toLowerCase().startsWith("application/json")) return null;
  return NextResponse.json(
    { error: "Request body must be sent as application/json." },
    { status: 415 },
  );
}

/** 403 with `error` unless the `Host` header names this machine. */
export function requireLoopbackHost(
  request: Request,
  error: string,
): NextResponse | null {
  if (isLoopbackHost(request.headers.get("host"))) return null;
  return NextResponse.json({ error }, { status: 403 });
}
