import { NextResponse } from "next/server";

import { describeFsError, fsErrorStatus } from "@/lib/fs-errors";
import {
  LOCAL_ONLY,
  requireJsonBody,
  requireLoopbackHost,
} from "@/lib/request-guards";
import { resumeSchema } from "@/lib/schema";
import {
  InvalidVariantDataError,
  InvalidVariantNameError,
  VariantNotFoundError,
  readVariant,
  variantExists,
  writeVariant,
} from "@/lib/variants";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ name: string }> };

/**
 * GET /api/variants/:name -> the variant, validated against the schema. Only
 * for a request addressed to this machine (see lib/request-guards.ts).
 */
export async function GET(
  request: Request,
  { params }: RouteParams,
): Promise<NextResponse> {
  const refused = requireLoopbackHost(request, LOCAL_ONLY);
  if (refused) return refused;

  const { name } = await params;
  try {
    return NextResponse.json({ name, resume: await readVariant(name) });
  } catch (error) {
    return errorResponse(error, `Could not read "${name}"`);
  }
}

/**
 * PUT /api/variants/:name -> validates the body, then writes the file. The
 * body must be sent as JSON, to a loopback Host.
 */
export async function PUT(
  request: Request,
  { params }: RouteParams,
): Promise<NextResponse> {
  const refused =
    requireJsonBody(request) ?? requireLoopbackHost(request, LOCAL_ONLY);
  if (refused) return refused;

  const { name } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const parsed = resumeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid resume.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    if (!(await variantExists(name))) {
      return NextResponse.json(
        { error: new VariantNotFoundError(name).message },
        { status: 404 },
      );
    }
    const resume = await writeVariant(name, parsed.data);
    return NextResponse.json({ name, resume });
  } catch (error) {
    return errorResponse(error, `Could not save "${name}"`);
  }
}

/**
 * Maps a failure to a response. `description` names the operation, so a disk
 * that filled up reads as such instead of as an opaque 500; anything that is
 * neither a domain error nor a known filesystem failure is rethrown, because
 * that is a bug and should look like one.
 */
function errorResponse(error: unknown, description: string): NextResponse {
  if (error instanceof InvalidVariantNameError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof VariantNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof InvalidVariantDataError) {
    return NextResponse.json(
      { error: error.message, issues: error.issues },
      { status: 422 },
    );
  }

  const message = describeFsError(error, description);
  if (message !== null) {
    return NextResponse.json({ error: message }, { status: fsErrorStatus(error) });
  }
  throw error;
}
