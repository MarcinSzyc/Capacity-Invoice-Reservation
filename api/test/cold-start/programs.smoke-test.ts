import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const SAMPLE_PROGRAM = 'PRG-1';
const SAMPLE_LIMIT_MINOR_UNITS = 1_000_000_000;
const SAMPLE_CURRENCY = 'USD';
const SEED_WAIT_MS = 45_000;

/** The documented command, exactly as the README shows it; the token is its last line. */
const mintDevToken = (): string => {
  const output = execFileSync('npm', ['run', 'dev:token', '--', '--sub', 'smoke-client'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const token = output.trim().split('\n').at(-1) ?? '';
  expect(token.split('.')).toHaveLength(3);
  return token;
};

const availability = (token: string): Promise<Response> =>
  fetch(`${API_BASE_URL}/programs/${SAMPLE_PROGRAM}/availability`, {
    headers: {Authorization: `Bearer ${token}`},
  });

/** The seed publishes once api is healthy; the consumer may need a moment to apply it. */
const availabilityOnceSeeded = async (token: string): Promise<Response> => {
  const deadline = Date.now() + SEED_WAIT_MS;
  let last = await availability(token);
  while (last.status === 404 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    last = await availability(token);
  }
  return last;
};

describe('Cold start with the sample program', () => {
  it('[AC-37] should mint a dev token that the availability request accepts', async () => {
    const token = mintDevToken();

    const response = await availabilityOnceSeeded(token);

    expect(response.status).toBe(200);
  });

  it('[AC-36] should start from a clean checkout and answer an authenticated availability request for the sample program', async () => {
    const withoutToken = await fetch(`${API_BASE_URL}/programs/${SAMPLE_PROGRAM}/availability`);
    expect(withoutToken.status).toBe(401);

    const response = await availabilityOnceSeeded(mintDevToken());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      programId: SAMPLE_PROGRAM,
      currency: SAMPLE_CURRENCY,
      limit: SAMPLE_LIMIT_MINOR_UNITS,
      reserved: 0,
      available: SAMPLE_LIMIT_MINOR_UNITS,
      overcommitted: false,
      asOf: null,
    });
  });
});
