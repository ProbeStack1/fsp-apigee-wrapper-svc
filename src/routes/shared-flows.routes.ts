import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { sharedFlowsEndpoints } from "../services/shared-flows.service";

export function createSharedFlowsRouter(): Router {
  const router = Router();
  const controller = new WrapperController();

  router.get("/organizations/:org/sharedflows", controller.handle(sharedFlowsEndpoints.listSharedFlows));
  router.get("/organizations/:org/sharedflows/details", controller.handle(sharedFlowsEndpoints.listSharedFlowsDetailed));
  router.get("/organizations/:org/sharedflows/:sharedFlow/details", controller.handle(sharedFlowsEndpoints.getSharedFlowDetails));
  router.get("/organizations/:org/sharedflows/:sharedFlow", controller.handle(sharedFlowsEndpoints.getSharedFlow));

  return router;
}
