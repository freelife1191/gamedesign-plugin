import { validateWritingRevision } from "./validate-writing-revision.mjs";

function failure(code, stage, cause, errors) {
  const error = new Error(`${stage} stage failed`);
  error.code = code;
  error.stage = stage;
  if (cause) error.cause = cause;
  if (errors) error.errors = errors;
  return error;
}

/**
 * Execute the explicit two-stage writing pass. A caller supplies the bundled
 * humanizer adapter because a Markdown skill is executed by the host, not Node.
 */
export async function runGameDesignWritingPolish({ source, protectedManifest, humanize, validate = validateWritingRevision }) {
  if (protectedManifest === undefined) throw failure("WRITING_POLISH_PROTECTED_MANIFEST_REQUIRED", "manifest");
  let revised;
  try {
    revised = await humanize(source);
  } catch (error) {
    throw failure("WRITING_POLISH_HUMANIZE_FAILED", "humanize", error);
  }
  if (typeof revised !== "string") throw failure("WRITING_POLISH_HUMANIZE_FAILED", "humanize");

  let validation;
  try {
    validation = await validate({ original: source, revised, protectedManifest });
  } catch (error) {
    throw failure("WRITING_POLISH_VALIDATION_FAILED", "validate", error);
  }
  if (!validation?.valid) throw failure("WRITING_POLISH_VALIDATION_FAILED", "validate", undefined, validation?.errors ?? []);
  return { revised, receipt: validation.receipt };
}
