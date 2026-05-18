import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { apisEndpoints } from "../services/apis.service";

export function createApisRouter(): Router {
  const router = Router();
  const controller = new WrapperController();

  // Folder: 02. APIs
  router.get("/organizations/:org/apis", controller.handle(apisEndpoints.listApis));
  router.post("/organizations/:org/apis", controller.handle(apisEndpoints.importApi));

  return router;
}
