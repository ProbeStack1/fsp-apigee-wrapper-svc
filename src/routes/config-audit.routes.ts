import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { configAuditEndpoints } from "../services/config-audit.service";

export function createConfigAuditRouter(): Router {
  const router = Router();
  const controller = new WrapperController();
  router.get(
    "/organizations/:org/config-audit/:configType/:name",
    controller.handle(configAuditEndpoints.getAudit),
  );
  return router;
}
