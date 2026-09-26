import {useState} from 'react';

const COPIED_FOR_MS = 1_500;

/** The first line of every snippet: a dev token from api, kept in `$TOKEN` for the calls below. */
export const TOKEN_LINE = (baseUrl: string): string =>
  `TOKEN=$(curl -s '${baseUrl}/dev/token' | sed -E 's/.*"token":"([^"]+)".*/\\1/')`;

// Inside single quotes a shell takes everything literally except a single quote itself.
const quoted = (text: string): string => `'${text.replaceAll("'", `'\\''`)}'`;

/**
 * The curl for one call the page makes: the same method, path and body, with the bearer token for
 * a business route. A dev endpoint answers without one (A-16), so it gets none.
 */
export const curl = (baseUrl: string, method: string, path: string, body?: unknown): string => {
  const lines = [`curl -s -X ${method} ${quoted(`${baseUrl}${path}`)}`];
  if (!path.startsWith('/dev/')) lines.push(`  -H "Authorization: Bearer $TOKEN"`);
  if (body !== undefined) {
    lines.push(`  -H 'Content-Type: application/json'`, `  -d ${quoted(JSON.stringify(body))}`);
  }
  return lines.join(' \\\n');
};

interface CurlBoxProps {
  readonly baseUrl: string;
  readonly commands: readonly string[];
}

/** A folded box with the curl for what the panel would send now, and a button that copies it. */
export const CurlBox = ({baseUrl, commands}: CurlBoxProps): React.JSX.Element => {
  const [copied, setCopied] = useState(false);
  const text = [TOKEN_LINE(baseUrl), ...commands].join('\n\n');

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_FOR_MS);
  };

  return (
    <details className="box curl">
      <summary>curl</summary>
      <div role="group" aria-label="curl">
        <button type="button" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        <pre data-testid="curl-text">{text}</pre>
      </div>
    </details>
  );
};
