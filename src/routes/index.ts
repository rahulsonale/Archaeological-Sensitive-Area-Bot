import { Router } from "express";
import { getCmdaMap } from "../controllers/cmdaController";

export const router = Router();

router.post("/cmda/map", getCmdaMap);
