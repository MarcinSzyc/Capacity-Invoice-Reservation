import http from 'node:http';

/**
 * Node 19+ turned keep-alive on by default for the global `http.Agent`, while a Node
 * `http.Server`'s default `keepAliveTimeout` stays 5 000 ms. Under a burst of parallel requests
 * (INV-01's two-instance test fires 25 at once) the server can close an idle persistent socket
 * at the exact moment supertest's shared agent tries to reuse it, which surfaces as
 * `ECONNRESET`, not as a wrong status. Every e2e request goes through this one process-global
 * agent, so it is disabled once here rather than per call: each request opens its own socket
 * and closes it, which is what a test client should do anyway.
 */
http.globalAgent = new http.Agent({keepAlive: false});
