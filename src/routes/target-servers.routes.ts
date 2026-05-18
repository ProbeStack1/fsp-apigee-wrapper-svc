import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { targetServersEndpoints } from "../services/target-servers.service";

export function createTargetServersRouter(): Router {
  const router = Router();
  const controller = new WrapperController();

  // Folder: 04. Target Servers
  router.get("/organizations/:org/environments/:env/targetservers", controller.handle(targetServersEndpoints.listTargetServers));
  router.get("/organizations/:org/environments/:env/targetservers/:name", controller.handle(targetServersEndpoints.getTargetServer));
  router.post("/organizations/:org/environments/:env/targetservers", controller.handle(targetServersEndpoints.createTargetServer));
  router.put("/organizations/:org/environments/:env/targetservers/:name", controller.handle(targetServersEndpoints.updateTargetServer));
  router.delete("/organizations/:org/environments/:env/targetservers/:name", controller.handle(targetServersEndpoints.deleteTargetServer));

  return router;
}
