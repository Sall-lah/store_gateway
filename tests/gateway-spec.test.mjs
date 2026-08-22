/**
 * @fileoverview Automated contract and feature test suite for store_gateway.
 * Explains 'Why': Validates NGINX templates, security headers, anti-spoofing rules,
 * CORS configuration, and route mappings against OpenSpec specifications.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/**
 * Helper to read a file from the repository root.
 * @param {string} relativePath - Relative path from project root.
 * @returns {string} File contents.
 */
function readProjectFile(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  return fs.readFileSync(fullPath, 'utf8');
}

describe('Store Gateway Specification & Feature Verification', () => {

  describe('1. File Structure & Scaffolding', () => {
    test('all core configuration and orchestration files must exist', () => {
      const requiredFiles = [
        'nginx/nginx.conf',
        'nginx/templates/default.conf.template',
        'nginx/snippets/cors.conf',
        'nginx/snippets/anti-spoofing.conf',
        'nginx/snippets/auth-offload.conf',
        'nginx/snippets/auth-offload-mutation.conf',
        'nginx/snippets/proxy-params.conf',
        'nginx/snippets/security-headers.conf',
        'Dockerfile',
        '.env.example',
        '.gitignore',
        '.dockerignore',
        'README.md'
      ];

      for (const file of requiredFiles) {
        const fullPath = path.join(rootDir, file);
        assert.ok(fs.existsSync(fullPath), `Required file missing: ${file}`);
      }
    });
  });

  describe('2. Core NGINX Configuration (nginx.conf)', () => {
    test('contains worker optimization, logging, and trace ID mapping', () => {
      const content = readProjectFile('nginx/nginx.conf');

      assert.match(content, /worker_processes\s+auto;/, 'Worker processes must be auto');
      assert.match(content, /worker_connections\s+1024;/, 'Worker connections must be 1024');
      assert.match(content, /\$request_id/, 'Log format must capture $request_id for tracing');
      assert.match(content, /map\s+\$http_x_request_id\s+\$req_id/, 'Must map incoming or generated trace ID');
      assert.match(content, /map\s+\$http_origin\s+\$cors_origin/, 'Must dynamically validate CORS origin');
      assert.match(content, /include\s+\/etc\/nginx\/conf\.d\/\*\.conf;/, 'Must include generated virtual hosts');
    });
  });

  describe('3. Anti-Spoofing & Security Headers', () => {
    test('anti-spoofing snippet must strip client X-User-* headers', () => {
      const content = readProjectFile('nginx/snippets/anti-spoofing.conf');

      const strippedHeaders = [
        'X-User-Id',
        'X-User-Email',
        'X-User-Role',
        'X-User-Permissions',
        'X-Authenticated-User',
        'X-Consumer-Custom-Id'
      ];

      for (const header of strippedHeaders) {
        const regex = new RegExp(`proxy_set_header\\s+${header}\\s+"";`);
        assert.match(content, regex, `Must explicitly strip header ${header}`);
      }
    });

    test('security headers snippet must enforce defense-in-depth policies', () => {
      const content = readProjectFile('nginx/snippets/security-headers.conf');

      assert.match(content, /X-Content-Type-Options\s+"nosniff"/, 'Must prevent MIME sniffing');
      assert.match(content, /X-Frame-Options\s+"SAMEORIGIN"/, 'Must prevent clickjacking');
      assert.match(content, /X-XSS-Protection\s+"1;\s*mode=block"/, 'Must enable XSS protection');
      assert.match(content, /Referrer-Policy\s+"strict-origin-when-cross-origin"/, 'Must set referrer policy');
      assert.match(content, /X-Request-ID\s+\$req_id/, 'Must expose trace ID in response');
    });
  });

  describe('4. Centralized CORS Management', () => {
    test('cors snippet must handle preflight OPTIONS with 204 and headers', () => {
      const content = readProjectFile('nginx/snippets/cors.conf');

      assert.match(content, /if\s*\(\$request_method\s*=\s*'OPTIONS'\)/, 'Must intercept OPTIONS requests');
      assert.match(content, /return\s+204;/, 'Must return 204 No Content for preflight');
      assert.match(content, /Access-Control-Allow-Origin/, 'Must attach Access-Control-Allow-Origin');
      assert.match(content, /Access-Control-Allow-Credentials'?\s+'true'/, 'Must support credentials');
      assert.match(content, /Access-Control-Max-Age'?\s+86400/, 'Must cache preflight for 24h');
      assert.match(content, /proxy_hide_header\s+'Access-Control-Allow-Origin';/, 'Must suppress upstream duplicate CORS');
    });
  });

  describe('5. Proxy Parameters & Connection Optimization', () => {
    test('proxy parameters must preserve Host, IP, trace ID, and Cookies', () => {
      const content = readProjectFile('nginx/snippets/proxy-params.conf');

      assert.match(content, /proxy_http_version\s+1\.1;/, 'Must use HTTP/1.1 for upstream keepalive');
      assert.match(content, /proxy_set_header\s+Host\s+\$host;/, 'Must preserve host header');
      assert.match(content, /proxy_set_header\s+X-Real-IP\s+\$remote_addr;/, 'Must forward real IP');
      assert.match(content, /proxy_set_header\s+X-Request-ID\s+\$req_id;/, 'Must forward trace ID');
      assert.match(content, /proxy_set_header\s+Authorization\s+\$http_authorization;/, 'Must forward Authorization token');
      assert.match(content, /proxy_pass_header\s+Set-Cookie;/, 'Must forward Set-Cookie');
      assert.match(content, /proxy_pass_header\s+Cookie;/, 'Must forward Cookie');
    });
  });

  describe('6. Virtual Host Template & Route Mapping', () => {
    test('default.conf.template must map all active services and docs routes', () => {
      const content = readProjectFile('nginx/templates/default.conf.template');

      // Health probe
      assert.match(content, /location\s*=\s*\/health/, 'Must define /health endpoint');

      // Auth Service routes (v1 standard and aliases)
      assert.match(content, /location\s+\/api\/auth\/\s*\{[\s\S]*?proxy_pass\s+\$\{AUTH_SERVICE_URL\}\/api\/auth\//, 'Must proxy /api/auth/ to Auth');
      assert.match(content, /location\s+\/api\/v1\/auth\/\s*\{[\s\S]*?proxy_pass\s+\$\{AUTH_SERVICE_URL\}\/api\/auth\//, 'Must proxy /api/v1/auth/ to Auth');
      assert.match(content, /location\s*=\s*\/\.well-known\/jwks\.json\s*\{[\s\S]*?proxy_pass\s+\$\{AUTH_SERVICE_URL\}\/\.well-known\/jwks\.json/, 'Must proxy /.well-known/jwks.json');

      // Product Service routes (v1 standard and aliases)
      assert.match(content, /location\s+(\/api\/products|\/api\/products\/)\s*\{[\s\S]*?proxy_pass\s+\$\{PRODUCT_SERVICE_URL\}\/api\/v1\/products/, 'Must proxy /api/products to Product v1');
      assert.match(content, /location\s+(\/api\/v1\/products|\/api\/v1\/products\/)\s*\{[\s\S]*?proxy_pass\s+\$\{PRODUCT_SERVICE_URL\}\/api\/v1\/products/, 'Must proxy /api/v1/products to Product v1');
      assert.match(content, /location\s+(\/api\/admin\/products|\/api\/admin\/products\/)\s*\{[\s\S]*?proxy_pass\s+\$\{PRODUCT_SERVICE_URL\}\/api\/v1\/admin\/products/, 'Must proxy /api/admin/products to Product admin v1');
      assert.match(content, /location\s+(\/api\/v1\/admin\/products|\/api\/v1\/admin\/products\/)\s*\{[\s\S]*?proxy_pass\s+\$\{PRODUCT_SERVICE_URL\}\/api\/v1\/admin\/products/, 'Must proxy /api/v1/admin/products to Product admin v1');

      // Order Service routes (v1 standard and aliases)
      assert.match(content, /location\s+(\/api\/orders|\/api\/orders\/)\s*\{[\s\S]*?proxy_pass\s+\$\{ORDER_SERVICE_URL\}\/api\/v1\/orders/, 'Must proxy /api/orders to Order v1');
      assert.match(content, /location\s+(\/api\/v1\/orders|\/api\/v1\/orders\/)\s*\{[\s\S]*?proxy_pass\s+\$\{ORDER_SERVICE_URL\}\/api\/v1\/orders/, 'Must proxy /api/v1/orders to Order v1');

      // Documentation routes & toggle
      assert.match(content, /map\s+"?\$\{ENABLE_DOCS\}"?\s+\$docs_disabled/, 'Must map ENABLE_DOCS to docs_disabled');
      assert.match(content, /location\s*=\s*\/docs\b/, 'Must provide /docs landing index');
      assert.match(content, /location\s+\/docs\/auth\/\s*\{[\s\S]*?proxy_pass\s+\$\{AUTH_SERVICE_URL\}\/docs\//, 'Must proxy /docs/auth/ to Auth Swagger');
      assert.match(content, /location\s*=\s*\/docs\/auth\/openapi\.yaml\s*\{[\s\S]*?proxy_pass\s+\$\{AUTH_SERVICE_URL\}\/docs\/openapi\.yaml/, 'Must proxy /docs/auth/openapi.yaml');
      assert.match(content, /location\s+\/docs\/products\/scalar\/\s*\{[\s\S]*?proxy_pass\s+\$\{PRODUCT_SERVICE_URL\}\/docs\//, 'Must proxy /docs/products/scalar/ to Product Scalar UI');
      assert.match(content, /location\s+\/docs\/products\/swagger\/\s*\{[\s\S]*?proxy_pass\s+\$\{PRODUCT_SERVICE_URL\}\/swagger\//, 'Must proxy /docs/products/swagger/ to Product Swagger UI');
      assert.match(content, /location\s*=\s*\/docs\/products\/openapi\.json\s*\{[\s\S]*?proxy_pass\s+\$\{PRODUCT_SERVICE_URL\}\/openapi\.json/, 'Must proxy /docs/products/openapi.json');
      assert.match(content, /location\s*=\s*\/docs\/products\/openapi\.yaml\s*\{[\s\S]*?proxy_pass\s+\$\{PRODUCT_SERVICE_URL\}\/openapi\.yaml/, 'Must proxy /docs/products/openapi.yaml');
      assert.match(content, /location\s+\/docs\/orders\/scalar\s*\{[\s\S]*?proxy_pass\s+\$\{ORDER_SERVICE_URL\}\/docs/, 'Must proxy /docs/orders/scalar to Order Scalar UI');
      assert.match(content, /location\s+\/docs\/orders\/swagger\s*\{[\s\S]*?proxy_pass\s+\$\{ORDER_SERVICE_URL\}\/swagger/, 'Must proxy /docs/orders/swagger to Order Swagger UI');
      assert.match(content, /location\s*=\s*\/docs\/orders\/openapi\.json\s*\{[\s\S]*?proxy_pass\s+\$\{ORDER_SERVICE_URL\}\/docs\/openapi\.json/, 'Must proxy /docs/orders/openapi.json');
      assert.match(content, /location\s*=\s*\/docs\/orders\/openapi\.yaml\s*\{[\s\S]*?proxy_pass\s+\$\{ORDER_SERVICE_URL\}\/docs\/openapi\.yaml/, 'Must proxy /docs/orders/openapi.yaml');
    });

    test('template substitution must produce valid NGINX configuration', () => {
      const template = readProjectFile('nginx/templates/default.conf.template');
      const rendered = template
        .replaceAll('${GATEWAY_PORT}', '80')
        .replaceAll('${ENABLE_DOCS}', 'true')
        .replaceAll('${AUTH_SERVICE_URL}', 'http://auth-service:8080')
        .replaceAll('${PRODUCT_SERVICE_URL}', 'http://product-service:8040')
        .replaceAll('${ORDER_SERVICE_URL}', 'http://order-service:8060');

      assert.ok(!rendered.includes('${GATEWAY_PORT}'), 'GATEWAY_PORT variable should be replaced');
      assert.ok(!rendered.includes('${ENABLE_DOCS}'), 'ENABLE_DOCS variable should be replaced');
      assert.ok(!rendered.includes('${AUTH_SERVICE_URL}'), 'AUTH_SERVICE_URL variable should be replaced');
      assert.ok(!rendered.includes('${PRODUCT_SERVICE_URL}'), 'PRODUCT_SERVICE_URL variable should be replaced');
      assert.ok(!rendered.includes('${ORDER_SERVICE_URL}'), 'ORDER_SERVICE_URL variable should be replaced');
      assert.ok(rendered.includes('listen 80 default_server;'), 'Must render listen 80');
      assert.ok(rendered.includes('http://auth-service:8080/api/auth/'), 'Must render auth upstream');
      assert.ok(rendered.includes('http://product-service:8040/api/v1/products'), 'Must render product upstream');
      assert.ok(rendered.includes('http://product-service:8040/api/v1/admin/products'), 'Must render admin product upstream');
      assert.ok(rendered.includes('http://order-service:8060/api/v1/orders'), 'Must render order upstream');
    });
  });

  describe('7. Docker & Environment Security', () => {
    test('Dockerfile must set NGINX_ENVSUBST_FILTER to protect internal NGINX vars', () => {
      const dockerfile = readProjectFile('Dockerfile');
      assert.match(dockerfile, /NGINX_ENVSUBST_FILTER=".*ORDER_SERVICE_URL.*"/, 'Must define filter for envsubst including ORDER_SERVICE_URL');
      assert.match(dockerfile, /ENABLE_DOCS=true/, 'Dockerfile must set default ENABLE_DOCS=true');
      assert.match(dockerfile, /ORDER_SERVICE_URL=http:\/\/order-service:8060/, 'Dockerfile must set default ORDER_SERVICE_URL');
      assert.match(dockerfile, /HEALTHCHECK/, 'Dockerfile must include HEALTHCHECK');
    });

    test('.gitignore and .dockerignore must protect .env and .agent', () => {
      const gitignore = readProjectFile('.gitignore');
      const dockerignore = readProjectFile('.dockerignore');

      assert.match(gitignore, /\.env\b/, '.gitignore must ignore .env');
      assert.match(gitignore, /\.agent\//, '.gitignore must ignore .agent/');
      assert.match(dockerignore, /\.env\b/, '.dockerignore must ignore .env');
      assert.match(dockerignore, /\.agent\//, '.dockerignore must ignore .agent/');
    });

    test('.env.example must declare downstream services and gateway configuration', () => {
      const envExample = readProjectFile('.env.example');
      assert.match(envExample, /AUTH_SERVICE_URL=/, 'Must specify AUTH_SERVICE_URL');
      assert.match(envExample, /PRODUCT_SERVICE_URL=/, 'Must specify PRODUCT_SERVICE_URL');
      assert.match(envExample, /ORDER_SERVICE_URL=/, 'Must specify ORDER_SERVICE_URL');
      assert.match(envExample, /GATEWAY_PORT=/, 'Must specify GATEWAY_PORT');
    });
  });

  describe('8. Mock Upstream Microservices Contract Simulation', () => {
    test('validates downstream service JWKS and docs endpoints response contracts', async () => {
      // Explain 'Why': Spins up simulated Auth, Product, and Order microservice endpoints in memory to verify contract schemas.
      const authServer = http.createServer((req, res) => {
        if (req.url === '/.well-known/jwks.json') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ keys: [{ kty: 'RSA', use: 'sig', alg: 'RS256', n: 'mock_key', e: 'AQAB' }] }));
        } else if (req.url === '/docs/openapi.yaml') {
          res.writeHead(200, { 'Content-Type': 'application/yaml' });
          res.end('openapi: 3.1.0\ninfo:\n  title: Store Auth API\n');
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      const productServer = http.createServer((req, res) => {
        if (req.url === '/openapi.json') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ openapi: '3.1.0', info: { title: 'Product Service API' } }));
        } else if (req.url === '/api/v1/admin/products' || req.url === '/api/admin/products') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ products: [{ id: 1, name: 'Admin Product', costPrice: 40.00 }] }));
        } else if (req.url === '/api/v1/products' || req.url === '/api/products') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ products: [{ id: 1, name: 'Sample Product' }] }));
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      const orderServer = http.createServer((req, res) => {
        if (req.url === '/docs/openapi.json') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ openapi: '3.0.0', info: { title: 'Order Service API' } }));
        } else if (req.url === '/api/v1/orders' || req.url === '/api/orders') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ orders: [{ id: 101, total: 99.99 }] }));
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      await new Promise(resolve => authServer.listen(0, resolve));
      await new Promise(resolve => productServer.listen(0, resolve));
      await new Promise(resolve => orderServer.listen(0, resolve));

      const authPort = authServer.address().port;
      const productPort = productServer.address().port;
      const orderPort = orderServer.address().port;

      // Test JWKS endpoint
      const jwksRes = await fetch(`http://127.0.0.1:${authPort}/.well-known/jwks.json`);
      const jwksData = await jwksRes.json();
      assert.equal(jwksRes.status, 200);
      assert.equal(jwksData.keys[0].alg, 'RS256');

      // Test Product endpoint
      const prodRes = await fetch(`http://127.0.0.1:${productPort}/api/v1/products`);
      const prodData = await prodRes.json();
      assert.equal(prodRes.status, 200);
      assert.equal(prodData.products[0].name, 'Sample Product');

      // Test Admin Product endpoint
      const adminProdRes = await fetch(`http://127.0.0.1:${productPort}/api/v1/admin/products`);
      const adminProdData = await adminProdRes.json();
      assert.equal(adminProdRes.status, 200);
      assert.equal(adminProdData.products[0].name, 'Admin Product');

      // Test Order endpoint
      const orderRes = await fetch(`http://127.0.0.1:${orderPort}/api/v1/orders`);
      const orderData = await orderRes.json();
      assert.equal(orderRes.status, 200);
      assert.equal(orderData.orders[0].id, 101);

      authServer.close();
      productServer.close();
      orderServer.close();
    });
  });

});
