import type {CallRecord} from './api';

export const REQUEST_LOG_SIZE = 50;

export const RequestLog = ({calls}: {calls: readonly CallRecord[]}): React.JSX.Element => (
  <section id="request-log" aria-labelledby="request-log-title">
    <h2 id="request-log-title">Request log</h2>
    <p>The last {REQUEST_LOG_SIZE} calls the page made, newest first, as api answered them.</p>
    <table>
      <thead>
        <tr>
          <th>At</th>
          <th>Method</th>
          <th>Path</th>
          <th>Status</th>
          <th>Code</th>
        </tr>
      </thead>
      <tbody>
        {calls.map((call) => (
          <tr key={call.id}>
            <td>{call.at.slice(11, 19)}</td>
            <td>{call.method}</td>
            <td>{call.path}</td>
            <td>{call.status}</td>
            <td>{call.code}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
);
