import { Router } from "express";
import { getCmdaMap, openCmdaMap } from "../controllers/cmdaController";

export const router = Router();

router.get("/cmda/map", getCmdaMap);
router.get("/cmda/map/open", openCmdaMap);
router.post("/cmda/map", getCmdaMap);
