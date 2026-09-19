const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const WEB_BASE_URL = process.env.WEB_BASE_URL ?? 'http://localhost:8080';

const get = (baseUrl: string, path: string): Promise<Response> => fetch(`${baseUrl}${path}`);

interface OpenApiDocument {
  readonly openapi?: string;
  readonly paths?: Record<string, unknown>;
  readonly info?: {title?: string};
}

describe('Cold start', () => {
  it('[AC-00] should start with docker compose up, turn ready and answer GET /health and both documentation views without a token', async () => {
    const liveness = await get(API_BASE_URL, '/health');
    expect(liveness.status).toBe(200);
    expect(await liveness.json()).toEqual({status: 'ok'});

    const readiness = await get(API_BASE_URL, '/health/ready');
    expect(readiness.status).toBe(200);
    expect(await readiness.json()).toEqual({
      status: 'ok',
      checks: {database: 'up', broker: 'up'},
    });

    const openapi = await get(API_BASE_URL, '/openapi.json');
    expect(openapi.status).toBe(200);
    const document = (await openapi.json()) as OpenApiDocument;
    expect(document.openapi).toMatch(/^3\./);
    expect(Object.keys(document.paths ?? {})).toContain('/health');

    const swaggerUi = await get(API_BASE_URL, '/docs');
    expect(swaggerUi.status).toBe(200);
    expect(swaggerUi.headers.get('content-type')).toContain('text/html');

    const redoc = await get(API_BASE_URL, '/redoc');
    expect(redoc.status).toBe(200);
    expect(redoc.headers.get('content-type')).toContain('text/html');
    expect(await redoc.text()).toContain('/openapi.json');

    const page = await get(WEB_BASE_URL, '/');
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
  });

  it('[AC-00] should answer every documentation view without a token', async () => {
    for (const path of ['/health', '/health/ready', '/openapi.json', '/docs', '/redoc']) {
      const response = await get(API_BASE_URL, path);

      expect(response.status).not.toBe(401);
    }
  });
});
