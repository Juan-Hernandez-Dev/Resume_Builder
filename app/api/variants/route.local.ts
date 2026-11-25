import { NextResponse } from "next/server";
import { z } from "zod";

import { describeFsError, fsErrorStatus } from "@/lib/fs-errors";
import { resumeSchema } from "@/lib/schema";
import {
  InvalidVariantDataError,
  InvalidVariantNameError,
  VariantExistsError,
  VariantNotFoundError,
  createVariant,
  duplicateVariant,
  listVariants,
} from "@/lib/variants";

export const dynamic = "force-dynamic";

const duplicateRequestSchema = z.object({
  from: z.string(),
  to: z.string(),
});

/** Creating from a document rather than copying a variant: "Load example". */
const createRequestSchema = z.object({
  to: z.string(),
  resume: resumeSchema,
});

/** GET /api/variants -> the names of every variant file under /data. */
export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({ variants: await listVariants() });
  } catch (error) {
    const message = describeFsError(error, "Could not list the variants");
    if (message === null) throw error;
    return NextResponse.json(
      { error: message },
      { status: fsErrorStatus(error) },
    );
  }
}

/**
 * POST /api/variants -> a new variant called `to`: a copy of `from` with
 * `{ from, to }`, or the document itself with `{ to, resume }`. Either way an
 * existing variant is never replaced.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const isCreate =
    typeof body === "object" && body !== null && "resume" in body;
  const parsed = isCreate
    ? createRequestSchema.safeParse(body)
    : duplicateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: isCreate
          ? "Expected a body of { to, resume } with a valid resume."
          : "Expected a body of { from, to }.",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const { to } = payload;
  try {
    const resume =
      "resume" in payload
        ? await createVariant(to, payload.resume)
        : await duplicateVariant(payload.from, to);
    return NextResponse.json({ name: to, resume }, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidVariantNameError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof VariantNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof VariantExistsError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof InvalidVariantDataError) {
      return NextResponse.json(
        { error: error.message, issues: error.issues },
        { status: 422 },
      );
    }

    const message = describeFsError(error, `Could not create "${to}"`);
    if (message === null) throw error;
    return NextResponse.json(
      { error: message },
      { status: fsErrorStatus(error) },
    );
  }
}
