// An error with an HTTP status. `code` tells clients why a 409 happened:
// STALE (someone saved first), WRONG_STATE, RESTORATION_BLOCKED.
export class HttpError extends Error {
  constructor(status, message, { code, errors } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

export const badRequest = (message, errors) => new HttpError(400, message, { errors });
export const notFound = (message) => new HttpError(404, message);
export const conflict = (message, code) => new HttpError(409, message, { code });

// Field errors on a form: { "pit.refs.0.tapeDistanceM": "Enter the tape distance in metres" }
export const failIfErrors = (errors, message) => {
  const count = Object.keys(errors).length;
  if (!count) return;
  throw badRequest(message || `${count} ${count === 1 ? "thing needs" : "things need"} attention`, errors);
};

export const sendError = (res, error) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message, code: error.code, errors: error.errors });
  }
  if (error.name === "VersionError") {
    return res.status(409).json({ message: "This was updated on another device", code: "STALE" });
  }
  if (error.name === "ValidationError") {
    const errors = Object.fromEntries(Object.entries(error.errors).map(([path, err]) => [path, err.message]));
    return res.status(400).json({ message: Object.values(errors).join("; "), errors });
  }
  if (error.name === "CastError") {
    return res.status(400).json({ message: `Invalid ${error.path}: ${error.value}` });
  }
  if (error.code === 11000) {
    return res.status(409).json({ message: "This already exists", code: "DUPLICATE" });
  }
  console.error("[execution]", error);
  return res.status(500).json({ message: error.message });
};
