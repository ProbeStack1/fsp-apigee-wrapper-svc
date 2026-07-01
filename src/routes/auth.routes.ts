import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { authEndpoints } from "../services/auth.service";

export function createAuthRouter(): Router {
  const router = Router();
  const controller = new WrapperController();

  router.get("/auth/apigee/token", controller.handle(authEndpoints.getApigeeAccessToken));

  return router;
}
