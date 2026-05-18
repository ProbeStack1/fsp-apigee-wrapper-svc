import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { keyValueMapsEndpoints } from "../services/key-value-maps.service";

export function createKeyValueMapsRouter(): Router {
  const router = Router();
  const controller = new WrapperController();

  // Folder: 05. Environment Key Value Maps
  router.get("/organizations/:org/environments/:env/keyvaluemaps", controller.handle(keyValueMapsEndpoints.listKvms));
  router.get("/organizations/:org/environments/:env/keyvaluemaps/:kvm", controller.handle(keyValueMapsEndpoints.getKvm));
  router.post("/organizations/:org/environments/:env/keyvaluemaps", controller.handle(keyValueMapsEndpoints.createKvm));
  router.put("/organizations/:org/environments/:env/keyvaluemaps/:kvm", controller.handle(keyValueMapsEndpoints.updateKvm));
  router.delete("/organizations/:org/environments/:env/keyvaluemaps/:kvm", controller.handle(keyValueMapsEndpoints.deleteKvm));

  router.get("/organizations/:org/environments/:env/keyvaluemaps/:kvm/entries", controller.handle(keyValueMapsEndpoints.listEntries));
  router.get("/organizations/:org/environments/:env/keyvaluemaps/:kvm/entries/:entry", controller.handle(keyValueMapsEndpoints.getEntry));
  router.post("/organizations/:org/environments/:env/keyvaluemaps/:kvm/entries", controller.handle(keyValueMapsEndpoints.createEntry));
  router.put("/organizations/:org/environments/:env/keyvaluemaps/:kvm/entries/:entry", controller.handle(keyValueMapsEndpoints.updateEntry));
  router.delete("/organizations/:org/environments/:env/keyvaluemaps/:kvm/entries/:entry", controller.handle(keyValueMapsEndpoints.deleteEntry));

  return router;
}
