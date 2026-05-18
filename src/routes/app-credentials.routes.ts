import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { appCredentialsEndpoints } from "../services/app-credentials.service";

export function createAppCredentialsRouter(): Router {
  const router = Router();
  const controller = new WrapperController();

  // Folder: 00. App Credentials
  router.post(
    "/organizations/:org/developers/:developer/apps/:app/keys",
    controller.handle(appCredentialsEndpoints.createKey),
  );
  router.post(
    "/organizations/:org/developers/:developer/apps/:app/keys/:consumerKey",
    controller.handle(appCredentialsEndpoints.attachProducts),
  );
  router.put(
    "/organizations/:org/developers/:developer/apps/:app/keys/:consumerKey",
    controller.handle(appCredentialsEndpoints.replaceProducts),
  );
  router.patch(
    "/organizations/:org/developers/:developer/apps/:app/keys/:consumerKey",
    controller.handle(appCredentialsEndpoints.updateProducts),
  );
  router.post(
    "/organizations/:org/developers/:developer/apps/:app/keys/:consumerKey/rotate",
    controller.handle(appCredentialsEndpoints.rotateKey),
  );
  router.post(
    "/organizations/:org/developers/:developer/apps/:app/keys/:consumerKey/apiProducts/:productName",
    controller.handle(appCredentialsEndpoints.approveProduct),
  );
  router.delete(
    "/organizations/:org/developers/:developer/apps/:app/keys/:consumerKey/apiProducts/:productName",
    controller.handle(appCredentialsEndpoints.revokeProduct),
  );

  return router;
}
