import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { appsEndpoints } from "../services/apps.service";

export function createAppsRouter(): Router {
  const router = Router();
  const controller = new WrapperController();

  // Folder: 07. Developer Apps
  router.get("/organizations/:org/developers/:developer/apps", controller.handle(appsEndpoints.listApps));
  router.get("/organizations/:org/developers/:developer/apps/:app", controller.handle(appsEndpoints.getApp));
  router.post("/organizations/:org/developers/:developer/apps", controller.handle(appsEndpoints.createApp));
  router.put("/organizations/:org/developers/:developer/apps/:app", controller.handle(appsEndpoints.updateApp));
  router.delete("/organizations/:org/developers/:developer/apps/:app", controller.handle(appsEndpoints.deleteApp));

  return router;
}
