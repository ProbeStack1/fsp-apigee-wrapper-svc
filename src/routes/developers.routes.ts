import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { developersEndpoints } from "../services/developers.service";

export function createDevelopersRouter(): Router {
  const router = Router();
  const controller = new WrapperController();

  // Folder: 03. Developers
  router.get("/organizations/:org/developers", controller.handle(developersEndpoints.listDevelopers));
  router.get("/organizations/:org/developers/:developer", controller.handle(developersEndpoints.getDeveloper));
  router.post("/organizations/:org/developers", controller.handle(developersEndpoints.createDeveloper));
  router.put("/organizations/:org/developers/:developer", controller.handle(developersEndpoints.updateDeveloper));
  router.delete("/organizations/:org/developers/:developer", controller.handle(developersEndpoints.deleteDeveloper));

  return router;
}
