import { Request, Response } from "express";
import { findCmdaMap } from "../routes/automation/sources/cmda/cmda.source";

export async function getCmdaMap(req: Request, res: Response): Promise<void> {
  const village =
    typeof req.body?.village === "string" ? req.body.village.trim() : "";

  if (!village) {
    res.status(400).json({
      source: "cmda",
      status: "error",
      message: "Please provide a village name.",
    });
    return;
  }

  try {
    const result = await findCmdaMap(village);

    res.status(200).json({
      source: "cmda",
      status: "success",
      ...result,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "The CMDA map lookup failed.";
    const statusCode = message.includes("is not listed") ? 404 : 502;

    res.status(statusCode).json({
      source: "cmda",
      status: "error",
      message,
    });
  }
}
