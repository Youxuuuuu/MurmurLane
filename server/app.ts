import express from "express";
import {
  registerRoutes,
  type ServerRouteDependencies,
} from "./routes.js";
import type { ServerConfig } from "./config.js";
import type { ServerAccess } from "./fileLoaders.js";
import { createLiveUpdateService } from "./liveUpdates.js";
import { createContentReadModel } from "./readModels/contentReadModel.js";
import { createConversationReadModel } from "./conversation/readModel.js";
import { createMemoryService } from "./memory/service.js";
import { createMediaService } from "./media/service.js";
import { createReminderService } from "./reminder/service.js";

export interface ServerAppDependencies {
  readonly config: ServerConfig;
  readonly liveUpdates: ReturnType<
    typeof createLiveUpdateService
  >;
  readonly access: ServerAccess;
}

export function createApp(dependencies: ServerAppDependencies) {
  const app = express();
  const routeDependencies: ServerRouteDependencies = {
    ...dependencies,
    contentReadModel: createContentReadModel(
      dependencies.access,
    ),
    conversationReadModel: createConversationReadModel(
      dependencies.access,
    ),
    memoryService: createMemoryService(dependencies.access),
    mediaService: createMediaService({
      access: dependencies.access,
      maxFileBytes: dependencies.config.apiFileMaxBytes,
      publicDirectory: dependencies.config.publicDirectory,
    }),
    reminderService: createReminderService(
      dependencies.access,
    ),
  };
  registerRoutes(app, routeDependencies);
  return app;
}
