import {existsSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

const REPO_ROOT = resolve(__dirname, '..', '..');
const ASSUMPTIONS_REGISTER = 'wiki/spec/assumptions.md';
const DECISION_RECORDS = 'wiki/decisions/README.md';
const COMPOSE_FILE = 'docker-compose.yml';
const RUN_COMMAND = 'docker compose up';

const readme = (): string => readFileSync(join(REPO_ROOT, 'README.md'), 'utf8');

const linkTargets = (markdown: string): string[] =>
  [...markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1] ?? '');

describe('README', () => {
  it('[AC-41] should link the README to the assumptions register, the decision records and the run instructions', () => {
    const markdown = readme();
    const targets = linkTargets(markdown);

    for (const target of [ASSUMPTIONS_REGISTER, DECISION_RECORDS, COMPOSE_FILE]) {
      expect(targets).toContain(target);
      expect(existsSync(join(REPO_ROOT, target))).toBe(true);
    }
    expect(markdown).toContain(RUN_COMMAND);
  });

  it('should tell the reviewer where health and both documentation views are', () => {
    const markdown = readme();

    expect(markdown).toContain('/health');
    expect(markdown).toContain('/docs');
    expect(markdown).toContain('/redoc');
    expect(markdown).toContain('/openapi.json');
  });
});
