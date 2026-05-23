import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { apisEndpoints } from "../services/apis.service";

export function createApisRouter(): Router {
  const router = Router();
  const controller = new WrapperController();

  // Folder: 02. APIs
  router.get("/organizations/:org/apis", controller.handle(apisEndpoints.listApis));
  router.get("/organizations/:org/apis/details", controller.handle(apisEndpoints.listApisDetailed));
  router.get("/organizations/:org/apis/:api/details", controller.handle(apisEndpoints.getApiDetails));
  router.get("/organizations/:org/apis/:api", controller.handle(apisEndpoints.getApi));
  router.post("/organizations/:org/apis", controller.handle(apisEndpoints.importApi));

  return router;
}
