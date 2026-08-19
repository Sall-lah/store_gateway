/**
 * @fileoverview End-to-end authentication offloading and token verification test suite for store_gateway.
 * Explains 'Why': Simulates the full Gateway Auth Offloading lifecycle:
 * 1. RS256 key generation & JWKS distribution from store_auth.
 * 2. User login and token issuance.
 * 3. Gateway perimeter auth verification via subrequest to store_auth /api/auth/me.
 * 4. Header sanitization (anti-spoofing) and verified claim injection (X-User-Id, X-User-Role).
 * 5. Downstream consumption of injected headers without duplicate crypto operations.
 * 6. Perimeter rejection of unauthenticated mutating requests (401 Unauthorized).
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';

/**
 * Base64URL encoding helper for JWT creation.
 * @param {Buffer|string} input - Input buffer or string.
 * @returns {string} Base64URL encoded string.
 */
function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Helper to convert RSA public key to JWK format.
 * @param {crypto.KeyObject} publicKey - RSA public key.
 * @returns {object} JWK representation.
 */
function rsaPublicKeyToJwk(publicKey) {
  const jwk = publicKey.export({ format: 'jwk' });
  return {
    kty: 'RSA',
    use: 'sig',
    alg: 'RS256',
    kid: 'store-auth-key-1',
    n: jwk.n,
    e: jwk.e
  };
}

/**
 * Helper to generate a signed RS256 JWT.
 * @param {object} payload - Token claims payload.
 * @param {crypto.KeyObject} privateKey - RSA private key.
 * @returns {string} Signed JWT token.
 */
function signJwt(payload, privateKey) {
  const header = { alg: 'RS256', typ: 'JWT', kid: 'store-auth-key-1' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(data);
  const signature = base64UrlEncode(signer.sign(privateKey));

  return `${data}.${signature}`;
}

/**
 * Helper to verify an RS256 JWT using a JWK public key.
 * @param {string} token - Signed JWT token.
 * @param {object} jwk - JWK public key.
 * @returns {object|null} Decoded payload if valid, null otherwise.
 */
function verifyJwtWithJwk(token, jwk) {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    const data = `${headerB64}.${payloadB64}`;
    const signature = Buffer.from(signatureB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

    const keyObject = crypto.createPublicKey({
      key: {
        kty: jwk.kty,
        n: jwk.n,
        e: jwk.e
      },
      format: 'jwk'
    });

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(data);
    const isValid = verifier.verify(keyObject, signature);

    if (!isValid) return null;
    return JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

describe('Gateway Authentication Offloading & Token Verification Suite', () => {
  let rsaKeyPair;
  let jwkPublicKey;
  let authServer;
  let productServer;
  let orderServer;
  let gatewaySimulator;
  let authPort;
  let productPort;
  let orderPort;
  let gatewayPort;

  before(async () => {
    // 1. Generate RS256 asymmetric key pair for store_auth
    rsaKeyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    const pubKeyObject = crypto.createPublicKey(rsaKeyPair.publicKey);
    jwkPublicKey = rsaPublicKeyToJwk(pubKeyObject);

    // 2. Mock Auth Service (port authPort)
    authServer = http.createServer((req, res) => {
      // Public JWKS endpoint
      if (req.url === '/.well-known/jwks.json' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ keys: [jwkPublicKey] }));
        return;
      }

      // User login endpoint (v1 and unversioned)
      if ((req.url === '/api/v1/auth/login' || req.url === '/api/auth/login') && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          const credentials = JSON.parse(body || '{}');
          if (credentials.email === 'admin@example.com' && credentials.password === 'AdminPass123!') {
            const token = signJwt({
              sub: 'usr_admin_999',
              email: 'admin@example.com',
              role: 'ADMIN',
              exp: Math.floor(Date.now() / 1000) + 3600
            }, crypto.createPrivateKey(rsaKeyPair.privateKey));

            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Set-Cookie': [
                `access_token=${token}; Path=/; HttpOnly; SameSite=Lax`,
                'refresh_token=mock_refresh_token_abc; Path=/api/v1/auth/refresh; HttpOnly; SameSite=Strict'
              ]
            });
            res.end(JSON.stringify({ access_token: token, token_type: 'Bearer' }));
          } else {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid credentials' }));
          }
        });
        return;
      }

      // Auth Verification / Profile endpoint used by Gateway subrequest
      if ((req.url === '/api/v1/auth/me' || req.url === '/api/auth/me') && req.method === 'GET') {
        let token = '';
        const authHeader = req.headers['authorization'] || '';
        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.slice(7);
        } else {
          const cookieHeader = req.headers['cookie'] || '';
          const match = cookieHeader.match(/access_token=([^;]+)/);
          if (match) token = match[1];
        }

        const claims = token ? verifyJwtWithJwk(token, jwkPublicKey) : null;
        if (!claims) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }

        // Return user claims in response headers for NGINX auth_request_set extraction
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'X-User-Id': claims.sub,
          'X-User-Role': claims.role,
          'X-User-Email': claims.email
        });
        res.end(JSON.stringify({
          id: claims.sub,
          email: claims.email,
          role: claims.role
        }));
        return;
      }

      // Token refresh endpoint
      if ((req.url === '/api/v1/auth/refresh' || req.url === '/api/auth/refresh') && req.method === 'POST') {
        const cookie = req.headers['cookie'] || '';
        if (cookie.includes('refresh_token=mock_refresh_token_abc')) {
          const newToken = signJwt({
            sub: 'usr_admin_999',
            email: 'admin@example.com',
            role: 'ADMIN',
            exp: Math.floor(Date.now() / 1000) + 3600
          }, crypto.createPrivateKey(rsaKeyPair.privateKey));

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ access_token: newToken, token_type: 'Bearer' }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized: missing refresh token' }));
        }
        return;
      }

      res.writeHead(404);
      res.end();
    });

    // 3. Mock Product Service (port productPort)
    productServer = http.createServer((req, res) => {
      // Public product list (no auth required)
      if (req.url === '/api/v1/products' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ products: [{ id: 101, name: 'Mechanical Keyboard', price: 99.99 }] }));
        return;
      }

      // Protected product creation (requires X-User-Role injected by Gateway)
      if (req.url === '/api/v1/products' && req.method === 'POST') {
        const role = req.headers['x-user-role'] || '';
        const userId = req.headers['x-user-id'] || '';

        if (!role || (role.toUpperCase() !== 'ADMIN' && role !== 'admin')) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'forbidden', message: 'Admin privileges are required' }));
          return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          const payload = JSON.parse(body || '{}');
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: 'prod_new_555',
            name: payload.name,
            userId: userId,
            userRole: role,
            requestId: req.headers['x-request-id'] || null
          }));
        });
        return;
      }

      res.writeHead(404);
      res.end();
    });

    // 4. Mock Order Service (port orderPort)
    orderServer = http.createServer((req, res) => {
      // Public / protected orders endpoint
      if (req.url === '/api/v1/orders' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ orders: [{ id: 'ord_123', total: 199.99 }] }));
        return;
      }

      // Protected order creation (requires X-User-Id injected by Gateway)
      if (req.url === '/api/v1/orders' && req.method === 'POST') {
        const userId = req.headers['x-user-id'] || '';
        const role = req.headers['x-user-role'] || '';

        if (!userId) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'unauthorized', message: 'User identity required' }));
          return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          const payload = JSON.parse(body || '{}');
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            orderId: 'ord_created_999',
            items: payload.items || [],
            userId: userId,
            userRole: role,
            requestId: req.headers['x-request-id'] || null
          }));
        });
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise(r => authServer.listen(0, r));
    await new Promise(r => productServer.listen(0, r));
    await new Promise(r => orderServer.listen(0, r));

    authPort = authServer.address().port;
    productPort = productServer.address().port;
    orderPort = orderServer.address().port;

    // 5. Gateway Simulator adhering strictly to store_gateway NGINX rules
    gatewaySimulator = http.createServer(async (req, res) => {
      // CORS Preflight
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': req.headers['origin'] || '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Request-ID',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400'
        });
        res.end();
        return;
      }

      const requestId = req.headers['x-request-id'] || `req-${crypto.randomUUID()}`;

      // Routing: Auth Service (v1 and alias)
      if (req.url.startsWith('/api/auth/') || req.url.startsWith('/api/v1/auth/') || req.url === '/.well-known/jwks.json') {
        const targetPath = req.url.replace(/^\/api\/auth\//, '/api/v1/auth/');
        const sanitizedHeaders = { ...req.headers };
        delete sanitizedHeaders['x-user-id'];
        delete sanitizedHeaders['x-user-role'];
        delete sanitizedHeaders['x-user-email'];
        sanitizedHeaders['x-request-id'] = requestId;

        const proxyReq = http.request({
          host: '127.0.0.1',
          port: authPort,
          path: targetPath,
          method: req.method,
          headers: sanitizedHeaders
        }, (proxyRes) => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res);
        });
        req.pipe(proxyReq);
        return;
      }

      // Routing: Product Service (v1 and alias)
      if (req.url.startsWith('/api/products') || req.url.startsWith('/api/v1/products')) {
        const targetPath = req.url.replace(/^\/api\/products/, '/api/v1/products');
        const isMutating = req.method !== 'GET' && req.method !== 'HEAD';

        let verifiedUserId = null;
        let verifiedUserRole = null;
        let verifiedUserEmail = null;

        if (isMutating) {
          const authSubRes = await new Promise((resolve) => {
            const subReq = http.request({
              host: '127.0.0.1',
              port: authPort,
              path: '/api/v1/auth/me',
              method: 'GET',
              headers: {
                'authorization': req.headers['authorization'] || '',
                'cookie': req.headers['cookie'] || '',
                'x-request-id': requestId
              }
            }, (authSub) => {
              resolve(authSub);
            });
            subReq.on('error', () => resolve(null));
            subReq.end();
          });

          if (!authSubRes || authSubRes.statusCode !== 200) {
            res.writeHead(401, {
              'Content-Type': 'application/json',
              'X-Request-ID': requestId
            });
            res.end(JSON.stringify({ error: 'unauthorized', message: 'Authentication required' }));
            return;
          }

          verifiedUserId = authSubRes.headers['x-user-id'] || null;
          verifiedUserRole = authSubRes.headers['x-user-role'] || null;
          verifiedUserEmail = authSubRes.headers['x-user-email'] || null;
        }

        const sanitizedHeaders = { ...req.headers };
        delete sanitizedHeaders['x-user-id'];
        delete sanitizedHeaders['x-user-role'];
        delete sanitizedHeaders['x-user-email'];

        if (verifiedUserId) sanitizedHeaders['x-user-id'] = verifiedUserId;
        if (verifiedUserRole) sanitizedHeaders['x-user-role'] = verifiedUserRole;
        if (verifiedUserEmail) sanitizedHeaders['x-user-email'] = verifiedUserEmail;
        sanitizedHeaders['x-request-id'] = requestId;

        const proxyReq = http.request({
          host: '127.0.0.1',
          port: productPort,
          path: targetPath,
          method: req.method,
          headers: sanitizedHeaders
        }, (proxyRes) => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res);
        });
        req.pipe(proxyReq);
        return;
      }

      // Routing: Order Service (v1 and alias)
      if (req.url.startsWith('/api/orders') || req.url.startsWith('/api/v1/orders')) {
        const targetPath = req.url.replace(/^\/api\/orders/, '/api/v1/orders');
        const isMutating = req.method !== 'GET' && req.method !== 'HEAD';

        let verifiedUserId = null;
        let verifiedUserRole = null;
        let verifiedUserEmail = null;

        if (isMutating) {
          const authSubRes = await new Promise((resolve) => {
            const subReq = http.request({
              host: '127.0.0.1',
              port: authPort,
              path: '/api/v1/auth/me',
              method: 'GET',
              headers: {
                'authorization': req.headers['authorization'] || '',
                'cookie': req.headers['cookie'] || '',
                'x-request-id': requestId
              }
            }, (authSub) => {
              resolve(authSub);
            });
            subReq.on('error', () => resolve(null));
            subReq.end();
          });

          if (!authSubRes || authSubRes.statusCode !== 200) {
            res.writeHead(401, {
              'Content-Type': 'application/json',
              'X-Request-ID': requestId
            });
            res.end(JSON.stringify({ error: 'unauthorized', message: 'Authentication required' }));
            return;
          }

          verifiedUserId = authSubRes.headers['x-user-id'] || null;
          verifiedUserRole = authSubRes.headers['x-user-role'] || null;
          verifiedUserEmail = authSubRes.headers['x-user-email'] || null;
        }

        const sanitizedHeaders = { ...req.headers };
        delete sanitizedHeaders['x-user-id'];
        delete sanitizedHeaders['x-user-role'];
        delete sanitizedHeaders['x-user-email'];

        if (verifiedUserId) sanitizedHeaders['x-user-id'] = verifiedUserId;
        if (verifiedUserRole) sanitizedHeaders['x-user-role'] = verifiedUserRole;
        if (verifiedUserEmail) sanitizedHeaders['x-user-email'] = verifiedUserEmail;
        sanitizedHeaders['x-request-id'] = requestId;

        const proxyReq = http.request({
          host: '127.0.0.1',
          port: orderPort,
          path: targetPath,
          method: req.method,
          headers: sanitizedHeaders
        }, (proxyRes) => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res);
        });
        req.pipe(proxyReq);
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise(r => gatewaySimulator.listen(0, r));
    gatewayPort = gatewaySimulator.address().port;
  });

  after(() => {
    authServer.close();
    productServer.close();
    orderServer.close();
    gatewaySimulator.close();
  });

  test('Step 1: Public JWKS keys are retrievable via Gateway', async () => {
    const res = await fetch(`http://127.0.0.1:${gatewayPort}/.well-known/jwks.json`);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data.keys));
    assert.equal(data.keys[0].alg, 'RS256');
  });

  test('Step 2: Admin logs in via Gateway and receives access token', async () => {
    const res = await fetch(`http://127.0.0.1:${gatewayPort}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'AdminPass123!' })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.access_token);
    assert.equal(data.token_type, 'Bearer');
  });

  test('Step 3: Public Product catalog is accessible anonymously without auth', async () => {
    const res = await fetch(`http://127.0.0.1:${gatewayPort}/api/products`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.products));
  });

  test('Step 4: Unauthenticated mutating request (POST /api/products) is rejected by Gateway with 401', async () => {
    const res = await fetch(`http://127.0.0.1:${gatewayPort}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Unauthenticated Product', price: 10 })
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.error, 'unauthorized');
  });

  test('Step 5: Authenticated Admin creates product; Gateway verifies token and injects verified X-User-Role downstream', async () => {
    const loginRes = await fetch(`http://127.0.0.1:${gatewayPort}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'AdminPass123!' })
    });
    const { access_token } = await loginRes.json();

    const res = await fetch(`http://127.0.0.1:${gatewayPort}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`
      },
      body: JSON.stringify({ name: 'Pro Gaming Keyboard', price: 129.99 })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.userId, 'usr_admin_999');
    assert.equal(data.userRole, 'ADMIN');
    assert.ok(data.requestId);
  });

  test('Step 6: Anti-Spoofing: Client cannot inject fake X-User-Role to gain admin access without valid token', async () => {
    const res = await fetch(`http://127.0.0.1:${gatewayPort}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': 'ADMIN',
        'X-User-Id': 'fake_admin'
      },
      body: JSON.stringify({ name: 'Spoofed Product', price: 0 })
    });

    assert.equal(res.status, 401);
  });

  test('Step 7: Order Service: Public GET orders is accessible without credentials', async () => {
    const res = await fetch(`http://127.0.0.1:${gatewayPort}/api/v1/orders`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.orders));
  });

  test('Step 8: Order Service: Unauthenticated POST /api/orders is rejected with 401 at Gateway perimeter', async () => {
    const res = await fetch(`http://127.0.0.1:${gatewayPort}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 101, qty: 1 }] })
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.error, 'unauthorized');
  });

  test('Step 9: Order Service: Authenticated order creation offloads auth and injects verified identity claims', async () => {
    const loginRes = await fetch(`http://127.0.0.1:${gatewayPort}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'AdminPass123!' })
    });
    const { access_token } = await loginRes.json();

    const res = await fetch(`http://127.0.0.1:${gatewayPort}/api/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`
      },
      body: JSON.stringify({ items: [{ productId: 101, qty: 2 }] })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.orderId, 'ord_created_999');
    assert.equal(data.userId, 'usr_admin_999');
    assert.equal(data.userRole, 'ADMIN');
    assert.ok(data.requestId);
  });
});
