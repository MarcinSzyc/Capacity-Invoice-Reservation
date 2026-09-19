import {apiBaseUrl} from './api';

const LINKS = [
  {label: 'Liveness', path: '/health'},
  {label: 'Readiness', path: '/health/ready'},
  {label: 'Swagger UI', path: '/docs'},
  {label: 'Redoc', path: '/redoc'},
  {label: 'OpenAPI document', path: '/openapi.json'},
];

export const App = (): React.JSX.Element => {
  const baseUrl = apiBaseUrl();

  return (
    <main>
      <h1>Program Capacity &amp; Invoice Reservation</h1>
      <p>
        This page is the walking skeleton of the UI. It shows what the service exposes today and
        nothing else: the demo with the request generator, the ledger and the treasury panel arrives
        in slice S-07.
      </p>
      <h2>The api at {baseUrl}</h2>
      <ul>
        {LINKS.map(({label, path}) => (
          <li key={path}>
            <a href={`${baseUrl}${path}`}>{label}</a> <code>{path}</code>
          </li>
        ))}
      </ul>
    </main>
  );
};
