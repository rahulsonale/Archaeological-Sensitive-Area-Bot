import { Request, Response } from "express";
import { findCmdaMap } from "../routes/automation/sources/cmda/cmda.source";

function getSearchTerm(req: Request): string {
  return [
    req.query.location,
    req.query.place,
    req.query.village,
    req.body?.location,
    req.body?.place,
    req.body?.village,
  ].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  )?.trim() ?? "";
}

async function lookupCmdaMap(req: Request, res: Response) {
  const searchTerm = getSearchTerm(req);

  if (!searchTerm) {
    res.status(400).json({
      source: "cmda",
      status: "error",
      message: "Provide a place or village in the location, place, or village field.",
    });
    return null;
  }

  try {
    const result = await findCmdaMap(searchTerm);
    return result;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "The CMDA map lookup failed.";
    const statusCode = message.includes("is not listed")
      ? 404
      : message.includes("matches more than one")
        ? 400
        : 502;

    res.status(statusCode).json({
      source: "cmda",
      status: "error",
      message,
    });
    return null;
  }
}

export async function getCmdaMap(req: Request, res: Response): Promise<void> {
  const result = await lookupCmdaMap(req, res);
  if (!result) return;

  res.status(200).json({
    source: "cmda",
    status: "success",
    ...result,
  });
}

export async function openCmdaMap(req: Request, res: Response): Promise<void> {
  const result = await lookupCmdaMap(req, res);
  if (!result) return;

  res.redirect(302, result.mapUrl);
}
