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
  router.post(
    "/organizations/:org/config-audit/:configType/:name/record",
    controller.handle(configAuditEndpoints.record),
  );
  return router;
}
