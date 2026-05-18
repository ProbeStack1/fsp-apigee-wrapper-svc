import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { tlsKeystoresEndpoints } from "../services/tls-keystores.service";

export function createTlsKeystoresRouter(): Router {
  const router = Router();
  const controller = new WrapperController();

  // Folder: 01. TLS Keystores
  router.get(
    "/organizations/:org/environments/:env/keystores",
    controller.handle(tlsKeystoresEndpoints.listKeystores),
  );
  router.post(
    "/organizations/:org/environments/:env/keystores",
    controller.handle(tlsKeystoresEndpoints.createKeystore),
  );
  router.get(
    "/organizations/:org/environments/:env/keystores/:keystore",
    controller.handle(tlsKeystoresEndpoints.getKeystore),
  );
  router.delete(
    "/organizations/:org/environments/:env/keystores/:keystore",
    controller.handle(tlsKeystoresEndpoints.deleteKeystore),
  );
  router.get(
    "/organizations/:org/environments/:env/keystores/:keystore/aliases",
    controller.handle(tlsKeystoresEndpoints.listAliases),
  );
  router.post(
    "/organizations/:org/environments/:env/keystores/:keystore/aliases",
    controller.handle(tlsKeystoresEndpoints.createAlias),
  );
  router.get(
    "/organizations/:org/environments/:env/keystores/:keystore/aliases/:alias",
    controller.handle(tlsKeystoresEndpoints.getAlias),
  );
  router.delete(
    "/organizations/:org/environments/:env/keystores/:keystore/aliases/:alias",
    controller.handle(tlsKeystoresEndpoints.deleteAlias),
  );

  return router;
}
