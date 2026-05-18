import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { organizationsEndpoints } from "../services/organizations.service";

export function createOrganizationsRouter(): Router {
  const router = Router();
  const controller = new WrapperController();

  // Folder: 01. Organizations and Environments
  router.get("/organizations", controller.handle(organizationsEndpoints.listOrganizations));
  router.get("/organizations/:org/environments", controller.handle(organizationsEndpoints.listEnvironments));

  return router;
}
