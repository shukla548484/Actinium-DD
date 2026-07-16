type PrismaErrorLike = {
  name?: string;
  message?: string;
  code?: string;
  meta?: unknown;
  clientVersion?: string;
  stack?: string;
};

export function serializePrismaError(error: unknown): {
  name: string;
  message: string;
  code?: string;
  clientVersion?: string;
  meta?: unknown;
  hint?: string;
} {
  const e = error as PrismaErrorLike;
  const message = String(e?.message || "Unknown error");
  const lower = message.toLowerCase();

  let hint: string | undefined;
  if (lower.includes("accelerate experienced an error communicating with your query engine")) {
    hint =
      "Prisma Accelerate could not reach the Query Engine (transient infra/network issue). " +
      "Try direct DB fallback or check Accelerate/DB connectivity.";
  } else if (e?.code === "P2022") {
    hint = "Schema drift: Prisma queried a column that does not exist in the DB. Run missing migrations.";
  } else if (e?.code === "P2002") {
    hint = "Unique constraint violation (duplicate value).";
  } else if (e?.code === "P2007") {
    hint = "Schema drift: invalid enum value for a Postgres enum. Run pending DB migrations.";
  } else if (lower.includes("timeout") || lower.includes("timed out")) {
    hint = "Database timeout (connection saturation or slow query).";
  }

  return {
    name: String(e?.name || "Error"),
    message,
    code: typeof e?.code === "string" ? e.code : undefined,
    clientVersion: typeof e?.clientVersion === "string" ? e.clientVersion : undefined,
    meta: e?.meta,
    hint,
  };
}

/** Prisma P2007 / driver adapter: Postgres enum does not include the requested label. */
export function isPrismaInvalidEnumValue(error: unknown, enumLabel?: string): boolean {
  const parts: string[] = [];
  const collect = (err: unknown) => {
    if (!err || typeof err !== "object") return;
    const e = err as PrismaErrorLike & { cause?: unknown };
    if (e.message) parts.push(String(e.message));
    if (e.code === "P2007") parts.push("P2007");
    const meta = e.meta as { driverAdapterError?: PrismaErrorLike } | undefined;
    if (meta?.driverAdapterError) collect(meta.driverAdapterError);
    if (e.cause) collect(e.cause);
  };
  collect(error);
  const blob = parts.join(" ");
  if (!blob.includes("P2007") && !blob.includes("invalid input value for enum")) {
    return false;
  }
  if (!enumLabel) return true;
  return blob.includes(enumLabel);
}

