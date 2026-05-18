import axios from "axios";
import type { RequestHandler } from "express";

import type { EndpointHandler } from "../services/endpoint.types";

export class WrapperController {
  public handle(endpointHandler: EndpointHandler): RequestHandler {
    return async (request, response, next) => {
      try {
        const result = await endpointHandler(request);
        response.json(result ?? { success: true });
      } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
          response.status(error.response.status).json(error.response.data ?? {
            error: {
              statusCode: error.response.status,
              message: error.message,
            },
          });
          return;
        }

        next(error);
      }
    };
  }
}
