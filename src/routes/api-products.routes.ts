import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { apiProductsEndpoints } from "../services/api-products.service";

export function createApiProductsRouter(): Router {
  const router = Router();
  const controller = new WrapperController();

  // Folder: 06. API Products
  router.get("/organizations/:org/apiproducts", controller.handle(apiProductsEndpoints.listProducts));
  router.get("/organizations/:org/apiproducts/:name", controller.handle(apiProductsEndpoints.getProduct));
  router.post("/organizations/:org/apiproducts", controller.handle(apiProductsEndpoints.createProduct));
  router.put("/organizations/:org/apiproducts/:name", controller.handle(apiProductsEndpoints.updateProduct));
  router.delete("/organizations/:org/apiproducts/:name", controller.handle(apiProductsEndpoints.deleteProduct));

  return router;
}
