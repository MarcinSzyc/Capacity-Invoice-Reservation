import {INestApplication, RequestMethod} from '@nestjs/common';
import {MetadataScanner, ModulesContainer, Reflector} from '@nestjs/core';
import {METHOD_METADATA, PATH_METADATA} from '@nestjs/common/constants';
import request from 'supertest';
import {IS_PUBLIC} from '../src/common/auth/public.decorator';
import {
  OPENAPI_JSON_PATH,
  OPENAPI_YAML_PATH,
  REDOC_PATH,
  SWAGGER_UI_PATH,
} from '../src/common/docs/setup-docs';
import {createTestApp, httpServer} from './support/test-app';

interface Route {
  readonly method: string;
  readonly path: string;
}

interface ExpressLayer {
  readonly route?: {readonly path: string; readonly methods: Record<string, boolean>};
}

// A-16: what may answer without a token. The documentation views are Express routes rather than
// controllers, so they are named here; every controller route must carry @Public() to be exempt.
const DOCUMENTATION_PREFIXES = [
  `/${OPENAPI_JSON_PATH}`,
  `/${OPENAPI_YAML_PATH}`,
  `/${SWAGGER_UI_PATH}`,
  `/${REDOC_PATH}`,
];

const joinPath = (...parts: string[]): string =>
  `/${parts
    .flatMap((part) => part.split('/'))
    .filter((segment) => segment !== '')
    .join('/')}`;

/** Every route Express knows about, controller or not, so a route added anywhere is swept. */
const expressRoutes = (app: INestApplication): Route[] => {
  const instance: unknown = app.getHttpAdapter().getInstance();
  const router = (instance as {router: {stack: ExpressLayer[]}}).router;
  return router.stack
    .flatMap((layer) => (layer.route === undefined ? [] : [layer.route]))
    .flatMap((route) =>
      Object.keys(route.methods)
        .filter((method) => route.methods[method])
        .map((method) => ({method, path: route.path})),
    );
};

/** Controller routes marked @Public() on the handler or the class. */
const publicControllerRoutes = (app: INestApplication): Route[] => {
  const modules = app.get(ModulesContainer);
  const scanner = new MetadataScanner();
  const reflector = app.get(Reflector);
  const controllers = [...modules.values()].flatMap((module) => [...module.controllers.values()]);
  return controllers.flatMap((wrapper) => {
    const controller = wrapper.metatype as (new (...args: never[]) => object) | undefined;
    const instance: unknown = wrapper.instance;
    if (controller === undefined || typeof instance !== 'object' || instance === null) return [];

    const controllerPath = reflector.get<string | string[]>(PATH_METADATA, controller) ?? '';
    const prototype = Object.getPrototypeOf(instance) as object;
    return scanner.getAllMethodNames(prototype).flatMap((name) => {
      const handler = (prototype as Record<string, unknown>)[name];
      if (typeof handler !== 'function') return [];
      const methodPath = reflector.get<string | string[]>(PATH_METADATA, handler) ?? '';
      const method = reflector.get<RequestMethod>(METHOD_METADATA, handler);
      const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC, [handler, controller]);
      if (method === undefined || isPublic !== true) return [];
      return [
        {
          method: RequestMethod[method].toLowerCase(),
          path: joinPath(String(controllerPath), String(methodPath)),
        },
      ];
    });
  });
};

const isDocumentation = ({path}: Route): boolean =>
  DOCUMENTATION_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

describe('Business routes are guarded', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('[INV-10] should answer 401 on every business route without a token', async () => {
    const routes = expressRoutes(app);
    const exempt = publicControllerRoutes(app);
    const business = routes.filter(
      (route) =>
        !isDocumentation(route) &&
        !exempt.some((open) => open.method === route.method && open.path === route.path),
    );

    // The sweep is only meaningful if it sees both kinds of route.
    expect(exempt).toEqual(
      expect.arrayContaining([
        {method: 'get', path: '/health'},
        {method: 'get', path: '/health/ready'},
      ]) as Route[],
    );
    expect(business.length).toBeGreaterThan(0);

    for (const route of business) {
      const path = route.path.replace(/:[A-Za-z_]+/g, 'x');
      const response = await request(httpServer(app))[route.method as 'get'](path);
      expect(`${route.method.toUpperCase()} ${route.path} -> ${response.status}`).toBe(
        `${route.method.toUpperCase()} ${route.path} -> 401`,
      );
    }
  });
});
