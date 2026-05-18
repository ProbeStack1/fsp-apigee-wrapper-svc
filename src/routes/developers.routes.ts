import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { developersEndpoints } from "../services/developers.service";

export function createDevelopersRouter(): Router {
  const router = Router();
  const controller = new WrapperController();

  // Folder: 03. Developers
  router.get("/organizations/:org/developers", controller.handle(developersEndpoints.listDevelopers));

  return router;
}
