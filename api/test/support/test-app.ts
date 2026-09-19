import type {Server} from 'node:http';
import {INestApplication} from '@nestjs/common';
import {Test} from '@nestjs/testing';
import {AppModule} from '../../src/app.module';
import {configureApp} from '../../src/app-setup';
import {APP_CONFIG, AppConfig} from '../../src/config/config.module';

export const createTestApp = async (): Promise<INestApplication> => {
  const moduleRef = await Test.createTestingModule({imports: [AppModule]}).compile();
  const app = moduleRef.createNestApplication({logger: false});
  configureApp(app, app.get<AppConfig>(APP_CONFIG));
  await app.init();
  return app;
};

// Nest types getHttpServer() as any, so supertest gets the shape spelled out once, here.
export const httpServer = (app: INestApplication): Server => {
  const server: unknown = app.getHttpServer();
  return server as Server;
};
