export type ActionErrorCode =
  | "validation"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "duplicate"
  | "offline"
  | "unknown";

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | {
      ok: false;
      code: ActionErrorCode;
      error: string;
      fieldErrors?: Record<string, string[] | undefined>;
      /** Extra context, e.g. the existing product on a duplicate warning. */
      meta?: Record<string, string>;
    };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(
  code: ActionErrorCode,
  error: string,
  extra?: { fieldErrors?: Record<string, string[] | undefined>; meta?: Record<string, string> },
): ActionResult<never> {
  return { ok: false, code, error, ...extra };
}
