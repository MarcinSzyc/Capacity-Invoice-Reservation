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
    const title = document.info?.title ?? '';
    expect(title).not.toBe('');

    const swaggerUi = await get(API_BASE_URL, '/docs');
    expect(swaggerUi.status).toBe(200);
    expect(swaggerUi.headers.get('content-type')).toContain('text/html');

    // AC-00: two views over the same document. Swagger UI carries it in its init script, so
    // that is where the two can be compared rather than trusting the page shell.
    const swaggerUiInit = await get(API_BASE_URL, '/docs/swagger-ui-init.js');
    expect(swaggerUiInit.status).toBe(200);
    const initScript = await swaggerUiInit.text();
    expect(initScript).toContain(title);
    expect(initScript).toContain('"/health"');

    const redoc = await get(API_BASE_URL, '/redoc');
    expect(redoc.status).toBe(200);
    expect(redoc.headers.get('content-type')).toContain('text/html');
    expect(await redoc.text()).toContain('/openapi.json');

    // The page is only as local as the script it pulls in (A-17: runnable offline).
    const redocBundle = await get(API_BASE_URL, '/redoc/redoc.standalone.js');
    expect(redocBundle.status).toBe(200);
    expect(redocBundle.headers.get('content-type')).toContain('javascript');

    const page = await get(WEB_BASE_URL, '/');
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
  });
});
