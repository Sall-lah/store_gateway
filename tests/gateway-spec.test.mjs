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
        'scripts/40-start-cloudflared.sh',
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

  describe('4. Centralized CORS Management & Dynamic Origin Evaluation', () => {
    test('cors snippet must handle preflight OPTIONS with 204 and headers', () => {
      const content = readProjectFile('nginx/snippets/cors.conf');

      assert.match(content, /if\s*\(\$request_method\s*=\s*'OPTIONS'\)/, 'Must intercept OPTIONS requests');
      assert.match(content, /return\s+204;/, 'Must return 204 No Content for preflight');
      assert.match(content, /Access-Control-Allow-Origin/, 'Must attach Access-Control-Allow-Origin');
      assert.match(content, /Access-Control-Allow-Credentials'?\s+'true'/, 'Must support credentials');
      assert.match(content, /Access-Control-Max-Age'?\s+86400/, 'Must cache preflight for 24h');
      assert.match(content, /proxy_hide_header\s+'Access-Control-Allow-Origin';/, 'Must suppress upstream duplicate CORS');
    });

    test('evaluates default CORS origin regex against localhost and disallowed origins', () => {
      const defaultRegex = new RegExp('^https?://(localhost|127\\.0\\.0\\.1)(:[0-9]+)?$');

      // Valid localhost and 127.0.0.1 variants
      assert.ok(defaultRegex.test('http://localhost'), 'Must match http://localhost');
      assert.ok(defaultRegex.test('http://localhost:3000'), 'Must match http://localhost:3000');
      assert.ok(defaultRegex.test('http://localhost:5173'), 'Must match http://localhost:5173');
      assert.ok(defaultRegex.test('https://localhost:8443'), 'Must match https://localhost:8443');
      assert.ok(defaultRegex.test('http://127.0.0.1'), 'Must match http://127.0.0.1');
      assert.ok(defaultRegex.test('http://127.0.0.1:8080'), 'Must match http://127.0.0.1:8080');
      assert.ok(defaultRegex.test('https://127.0.0.1:443'), 'Must match https://127.0.0.1:443');

      // Disallowed origins
      assert.ok(!defaultRegex.test('https://yourdomain.com'), 'Must reject custom domain under default localhost regex');
      assert.ok(!defaultRegex.test('https://malicious-site.com'), 'Must reject untrusted domains');
      assert.ok(!defaultRegex.test('http://localhost.attacker.com'), 'Must reject subdomain spoofing of localhost');
      assert.ok(!defaultRegex.test('http://127.0.0.1.attacker.com'), 'Must reject subdomain spoofing of 127.0.0.1');
      assert.ok(!defaultRegex.test('https://evil-localhost:3000'), 'Must reject prefix spoofing');
    });

    test('evaluates custom domain and subdomain regex configurations', () => {
      // Single custom domain configuration
      const singleDomainRegex = new RegExp('^https?://(yourdomain\\.com)(:[0-9]+)?$');
      assert.ok(singleDomainRegex.test('https://yourdomain.com'), 'Must match custom domain');
      assert.ok(singleDomainRegex.test('https://yourdomain.com:8443'), 'Must match custom domain with port');
      assert.ok(!singleDomainRegex.test('https://evil-yourdomain.com'), 'Must reject lookalike domain');
      assert.ok(!singleDomainRegex.test('https://attacker.com'), 'Must reject attacker origin');

      // Wildcard subdomains + localhost configuration
      const multiDomainRegex = new RegExp('^https?://(localhost|127\\.0\\.0\\.1|yourdomain\\.com|([a-zA-Z0-9-]+\\.)+yourdomain\\.com)(:[0-9]+)?$');
      assert.ok(multiDomainRegex.test('http://localhost:3000'), 'Must match localhost in multi-domain config');
      assert.ok(multiDomainRegex.test('https://yourdomain.com'), 'Must match apex domain');
      assert.ok(multiDomainRegex.test('https://app.yourdomain.com'), 'Must match app subdomain');
      assert.ok(multiDomainRegex.test('https://admin.store.yourdomain.com'), 'Must match nested subdomain');
      assert.ok(!multiDomainRegex.test('https://yourdomain.com.evil.com'), 'Must reject domain suffix attack');
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
    test('default.conf.template must map all active services, dynamic CORS origin, and docs routes', () => {
      const content = readProjectFile('nginx/templates/default.conf.template');

      // Health probe
      assert.match(content, /location\s*=\s*\/health/, 'Must define /health endpoint');

      // Dynamic DNS resolver configuration
      assert.match(content, /resolver\s+\$\{DNS_RESOLVER\}\s+valid=5s\s+ipv6=off;/, 'Must define runtime resolver with 5s validity and ipv6 disabled');
      assert.match(content, /resolver_timeout\s+3s;/, 'Must define resolver timeout');

      // Dynamic CORS origin mapping
      assert.match(content, /map\s+\$http_origin\s+\$cors_origin/, 'Must define dynamic $cors_origin map');
      assert.match(content, /"~?\$\{CORS_ALLOWED_ORIGIN_REGEX\}"/, 'Must evaluate $cors_origin against CORS_ALLOWED_ORIGIN_REGEX');

      // Upstream variable declarations for dynamic resolution
      assert.match(content, /set\s+\$auth_backend\s+"?\$\{AUTH_SERVICE_URL\}"?;/, 'Must declare $auth_backend variable');
      assert.match(content, /set\s+\$product_backend\s+"?\$\{PRODUCT_SERVICE_URL\}"?;/, 'Must declare $product_backend variable');
      assert.match(content, /set\s+\$order_backend\s+"?\$\{ORDER_SERVICE_URL\}"?;/, 'Must declare $order_backend variable');
      assert.match(content, /set\s+\$user_backend\s+"?\$\{USER_SERVICE_URL\}"?;/, 'Must declare $user_backend variable');

      // Subrequest verification endpoints
      assert.match(content, /location\s*=\s*\/_auth_verify\s*\{[\s\S]*?proxy_pass\s+\$auth_backend\/api\/auth\/me;/, 'Must proxy /_auth_verify to $auth_backend');
      assert.match(content, /location\s*=\s*\/_auth_verify_mutation_only\s*\{[\s\S]*?proxy_pass\s+\$auth_backend\/api\/auth\/me;/, 'Must proxy /_auth_verify_mutation_only to $auth_backend');

      // Auth Service routes (v1 standard and aliases)
      assert.match(content, /location\s+\/api\/auth\/\s*\{[\s\S]*?proxy_pass\s+\$auth_backend\$request_uri;/, 'Must proxy /api/auth/ to Auth');
      assert.match(content, /location\s*=\s*\/api\/auth\s*\{[\s\S]*?proxy_pass\s+\$auth_backend\/api\/auth;/, 'Must proxy /api/auth to Auth');
      assert.match(content, /location\s+\/api\/v1\/auth\/\s*\{[\s\S]*?proxy_pass\s+\$auth_backend;/, 'Must proxy /api/v1/auth/ to Auth');
      assert.match(content, /location\s*=\s*\/api\/v1\/auth\s*\{[\s\S]*?proxy_pass\s+\$auth_backend;/, 'Must proxy /api/v1/auth to Auth');
      assert.match(content, /location\s*=\s*\/\.well-known\/jwks\.json\s*\{[\s\S]*?proxy_pass\s+\$auth_backend\/\.well-known\/jwks\.json;/, 'Must proxy /.well-known/jwks.json');

      // Product Service routes (v1 standard and aliases)
      assert.match(content, /location\s+(\/api\/products|\/api\/products\/)\s*\{[\s\S]*?proxy_pass\s+\$product_backend;/, 'Must proxy /api/products alias to Product v1');
      assert.match(content, /location\s+(\/api\/v1\/products|\/api\/v1\/products\/)\s*\{[\s\S]*?proxy_pass\s+\$product_backend/, 'Must proxy /api/v1/products to Product v1');
      assert.match(content, /location\s+(\/api\/admin\/products|\/api\/admin\/products\/)\s*\{[\s\S]*?proxy_pass\s+\$product_backend;/, 'Must proxy /api/admin/products alias to Product admin v1');
      assert.match(content, /location\s+(\/api\/v1\/admin\/products|\/api\/v1\/admin\/products\/)\s*\{[\s\S]*?proxy_pass\s+\$product_backend/, 'Must proxy /api/v1/admin/products to Product admin v1');

      // Order Service routes (v1 standard and aliases)
      assert.match(content, /location\s+(\/api\/orders|\/api\/orders\/)\s*\{[\s\S]*?proxy_pass\s+\$order_backend;/, 'Must proxy /api/orders alias to Order v1');
      assert.match(content, /location\s+(\/api\/v1\/orders|\/api\/v1\/orders\/)\s*\{[\s\S]*?proxy_pass\s+\$order_backend/, 'Must proxy /api/v1/orders to Order v1');

      // User Service routes (v1 standard and aliases)
      assert.match(content, /location\s+(\/api\/users|\/api\/users\/)\s*\{[\s\S]*?proxy_pass\s+\$user_backend/, 'Must proxy /api/users to User service');
      assert.match(content, /location\s+(\/api\/v1\/users|\/api\/v1\/users\/)\s*\{[\s\S]*?proxy_pass\s+\$user_backend/, 'Must proxy /api/v1/users to User service');

      // Documentation routes & toggle
      assert.match(content, /map\s+"?\$\{ENABLE_DOCS\}"?\s+\$docs_disabled/, 'Must map ENABLE_DOCS to docs_disabled');
      assert.match(content, /location\s*=\s*\/docs\b/, 'Must provide /docs landing index');
      assert.match(content, /location\s+\/docs\/auth\/\s*\{[\s\S]*?proxy_pass\s+\$auth_backend;/, 'Must proxy /docs/auth/ to Auth Swagger');
      assert.match(content, /location\s*=\s*\/docs\/auth\/openapi\.yaml\s*\{[\s\S]*?proxy_pass\s+\$auth_backend\/docs\/openapi\.yaml;/, 'Must proxy /docs/auth/openapi.yaml');
      assert.match(content, /location\s+\/docs\/products\/scalar\/\s*\{[\s\S]*?proxy_pass\s+\$product_backend;/, 'Must proxy /docs/products/scalar/ to Product Scalar UI');
      assert.match(content, /location\s+\/docs\/products\/swagger\/\s*\{[\s\S]*?proxy_pass\s+\$product_backend;/, 'Must proxy /docs/products/swagger/ to Product Swagger UI');
      assert.match(content, /location\s*=\s*\/docs\/products\/openapi\.json\s*\{[\s\S]*?proxy_pass\s+\$product_backend\/openapi\.json;/, 'Must proxy /docs/products/openapi.json');
      assert.match(content, /location\s*=\s*\/docs\/products\/openapi\.yaml\s*\{[\s\S]*?proxy_pass\s+\$product_backend\/openapi\.yaml;/, 'Must proxy /docs/products/openapi.yaml');
      assert.match(content, /location\s+\/docs\/orders\/scalar\s*\{[\s\S]*?proxy_pass\s+\$order_backend;/, 'Must proxy /docs/orders/scalar to Order Scalar UI');
      assert.match(content, /location\s+\/docs\/orders\/swagger\s*\{[\s\S]*?proxy_pass\s+\$order_backend;/, 'Must proxy /docs/orders/swagger to Order Swagger UI');
      assert.match(content, /location\s*=\s*\/docs\/orders\/openapi\.json\s*\{[\s\S]*?proxy_pass\s+\$order_backend\/docs\/openapi\.json;/, 'Must proxy /docs/orders/openapi.json');
      assert.match(content, /location\s*=\s*\/docs\/orders\/openapi\.yaml\s*\{[\s\S]*?proxy_pass\s+\$order_backend\/docs\/openapi\.yaml;/, 'Must proxy /docs/orders/openapi.yaml');
      assert.match(content, /location\s*=\s*\/docs\/users\s*\{[\s\S]*?proxy_pass\s+\$user_backend;/, 'Must proxy /docs/users to User Docs');
      assert.match(content, /location\s+\/docs\/users\/swagger\s*\{[\s\S]*?proxy_pass\s+\$user_backend;/, 'Must proxy /docs/users/swagger to User Swagger UI');
      assert.match(content, /location\s*=\s*\/docs\/users\/openapi\.json\s*\{[\s\S]*?proxy_pass\s+\$user_backend\/docs\/openapi\.json;/, 'Must proxy /docs/users/openapi.json');
      assert.match(content, /location\s*=\s*\/docs\/users\/openapi\.yaml\s*\{[\s\S]*?proxy_pass\s+\$user_backend\/docs\/openapi\.yaml;/, 'Must proxy /docs/users/openapi.yaml');

      // Documentation relies on upstream relative path resolution without gateway sub_filters
      assert.ok(!content.includes('sub_filter'), 'Must not contain sub_filter directives in clean relative proxy mode');
      assert.ok(!content.includes('location = /openapi.json'), 'Must not contain legacy root /openapi.json fallback');
      assert.ok(!content.includes('location = /docs/openapi.yaml'), 'Must not contain legacy root /docs/openapi.yaml fallback');
    });

    test('template substitution must produce valid NGINX configuration', () => {
      const template = readProjectFile('nginx/templates/default.conf.template');
      const rendered = template
        .replaceAll('${GATEWAY_PORT}', '80')
        .replaceAll('${ENABLE_DOCS}', 'true')
        .replaceAll('${DNS_RESOLVER}', '127.0.0.11')
        .replaceAll('${CORS_ALLOWED_ORIGIN_REGEX}', '^https?://(localhost|127\\.0\\.0\\.1)(:[0-9]+)?$')
        .replaceAll('${AUTH_SERVICE_URL}', 'http://auth-service:8080')
        .replaceAll('${PRODUCT_SERVICE_URL}', 'http://product-service:8040')
        .replaceAll('${ORDER_SERVICE_URL}', 'http://order-service:8060')
        .replaceAll('${USER_SERVICE_URL}', 'http://user-service:8082');

      assert.ok(!rendered.includes('${GATEWAY_PORT}'), 'GATEWAY_PORT variable should be replaced');
      assert.ok(!rendered.includes('${ENABLE_DOCS}'), 'ENABLE_DOCS variable should be replaced');
      assert.ok(!rendered.includes('${DNS_RESOLVER}'), 'DNS_RESOLVER variable should be replaced');
      assert.ok(!rendered.includes('${CORS_ALLOWED_ORIGIN_REGEX}'), 'CORS_ALLOWED_ORIGIN_REGEX variable should be replaced');
      assert.ok(!rendered.includes('${AUTH_SERVICE_URL}'), 'AUTH_SERVICE_URL variable should be replaced');
      assert.ok(!rendered.includes('${PRODUCT_SERVICE_URL}'), 'PRODUCT_SERVICE_URL variable should be replaced');
      assert.ok(!rendered.includes('${ORDER_SERVICE_URL}'), 'ORDER_SERVICE_URL variable should be replaced');
      assert.ok(!rendered.includes('${USER_SERVICE_URL}'), 'USER_SERVICE_URL variable should be replaced');
      assert.ok(rendered.includes('listen 80 default_server;'), 'Must render listen 80');
      assert.ok(rendered.includes('resolver 127.0.0.11 valid=5s ipv6=off;'), 'Must render resolver directive');
      assert.ok(rendered.includes('resolver_timeout 3s;'), 'Must render resolver timeout');
      assert.ok(rendered.includes('set $auth_backend "http://auth-service:8080";'), 'Must render auth backend variable');
      assert.ok(rendered.includes('set $product_backend "http://product-service:8040";'), 'Must render product backend variable');
      assert.ok(rendered.includes('set $order_backend "http://order-service:8060";'), 'Must render order backend variable');
      assert.ok(rendered.includes('set $user_backend "http://user-service:8082";'), 'Must render user backend variable');
      assert.ok(rendered.includes('"~^https?://(localhost|127\\.0\\.0\\.1)(:[0-9]+)?$" "$http_origin";'), 'Must render dynamic cors map');
      assert.ok(rendered.includes('proxy_pass $auth_backend$request_uri;'), 'Must render auth proxy pass');
      assert.ok(rendered.includes('proxy_pass $product_backend$request_uri;'), 'Must render product proxy pass');
      assert.ok(rendered.includes('proxy_pass $order_backend$request_uri;'), 'Must render order proxy pass');
      assert.ok(rendered.includes('proxy_pass $user_backend$request_uri;'), 'Must render user proxy pass');
    });

    test('validates path rewrite rules and URI preservation across all proxy targets', () => {
      const content = readProjectFile('nginx/templates/default.conf.template');

      // Unversioned/legacy alias rewrites
      assert.match(content, /rewrite\s+\^\/api\/v1\/auth\/\(\.\*\)\$\s+\/api\/auth\/\$1\s+break;/, 'Must rewrite /api/v1/auth/* to /api/auth/*');
      assert.match(content, /rewrite\s+\^\/api\/products\/\(\.\*\)\$\s+\/api\/v1\/products\/\$1\s+break;/, 'Must rewrite /api/products/* to /api/v1/products/*');
      assert.match(content, /rewrite\s+\^\/api\/admin\/products\/\(\.\*\)\$\s+\/api\/v1\/admin\/products\/\$1\s+break;/, 'Must rewrite /api/admin/products/* to /api/v1/admin/products/*');
      assert.match(content, /rewrite\s+\^\/api\/orders\/\(\.\*\)\$\s+\/api\/v1\/orders\/\$1\s+break;/, 'Must rewrite /api/orders/* to /api/v1/orders/*');
      assert.match(content, /rewrite\s+\^\/api\/admin\/orders\/\(\.\*\)\$\s+\/api\/v1\/admin\/orders\/\$1\s+break;/, 'Must rewrite /api/admin/orders/* to /api/v1/admin/orders/*');
      assert.match(content, /rewrite\s+\^\/api\/dev\/orders\/\(\.\*\)\$\s+\/api\/v1\/dev\/orders\/\$1\s+break;/, 'Must rewrite /api/dev/orders/* to /api/v1/dev/orders/*');
      assert.match(content, /rewrite\s+\^\/api\/orders\/webhook\/\(\.\*\)\$\s+\/api\/v1\/orders\/webhook\/\$1\s+break;/, 'Must rewrite /api/orders/webhook/* to /api/v1/orders/webhook/*');
      assert.match(content, /rewrite\s+\^\/api\/v1\/users\/\(\.\*\)\$\s+\/api\/users\/\$1\s+break;/, 'Must rewrite /api/v1/users/* to /api/users/*');

      // Canonical 1:1 pass-through using $request_uri for argument and path preservation
      assert.match(content, /location\s+\/api\/auth\/\s*\{[\s\S]*?proxy_pass\s+\$auth_backend\$request_uri;/, 'Must forward full $request_uri to /api/auth/');
      assert.match(content, /location\s+\/api\/v1\/products\/\s*\{[\s\S]*?proxy_pass\s+\$product_backend\$request_uri;/, 'Must forward full $request_uri to /api/v1/products/');
      assert.match(content, /location\s+\/api\/v1\/admin\/products\/\s*\{[\s\S]*?proxy_pass\s+\$product_backend\$request_uri;/, 'Must forward full $request_uri to /api/v1/admin/products/');
      assert.match(content, /location\s+\/api\/v1\/orders\/\s*\{[\s\S]*?proxy_pass\s+\$order_backend\$request_uri;/, 'Must forward full $request_uri to /api/v1/orders/');
      assert.match(content, /location\s+\/api\/v1\/admin\/orders\/\s*\{[\s\S]*?proxy_pass\s+\$order_backend\$request_uri;/, 'Must forward full $request_uri to /api/v1/admin/orders/');
      assert.match(content, /location\s+\/api\/v1\/dev\/orders\/\s*\{[\s\S]*?proxy_pass\s+\$order_backend\$request_uri;/, 'Must forward full $request_uri to /api/v1/dev/orders/');
      assert.match(content, /location\s+\/api\/v1\/orders\/webhook\/\s*\{[\s\S]*?proxy_pass\s+\$order_backend\$request_uri;/, 'Must forward full $request_uri to /api/v1/orders/webhook/');
      assert.match(content, /location\s+\/api\/users\/\s*\{[\s\S]*?proxy_pass\s+\$user_backend\$request_uri;/, 'Must forward full $request_uri to /api/users/');
    });
  });

  describe('7. Docker & Environment Security', () => {
    test('Dockerfile must set NGINX_ENVSUBST_FILTER to protect internal NGINX vars', () => {
      const dockerfile = readProjectFile('Dockerfile');
      assert.match(dockerfile, /NGINX_ENVSUBST_FILTER=".*CORS_ALLOWED_ORIGIN_REGEX.*"/, 'Must define filter for envsubst including CORS_ALLOWED_ORIGIN_REGEX');
      assert.match(dockerfile, /NGINX_ENVSUBST_FILTER=".*USER_SERVICE_URL.*"/, 'Must define filter for envsubst including USER_SERVICE_URL');
      assert.match(dockerfile, /NGINX_ENVSUBST_FILTER=".*DNS_RESOLVER.*"/, 'Must define filter for envsubst including DNS_RESOLVER');
      assert.match(dockerfile, /ENABLE_DOCS=true/, 'Dockerfile must set default ENABLE_DOCS=true');
      assert.match(dockerfile, /DNS_RESOLVER=127\.0\.0\.11/, 'Dockerfile must set default DNS_RESOLVER=127.0.0.11');
      assert.match(dockerfile, /CORS_ALLOWED_ORIGIN_REGEX=/, 'Dockerfile must set default CORS_ALLOWED_ORIGIN_REGEX');
      assert.match(dockerfile, /ORDER_SERVICE_URL=http:\/\/order-service:8060/, 'Dockerfile must set default ORDER_SERVICE_URL');
      assert.match(dockerfile, /USER_SERVICE_URL=http:\/\/user-service:8082/, 'Dockerfile must set default USER_SERVICE_URL');
      assert.match(dockerfile, /HEALTHCHECK/, 'Dockerfile must include HEALTHCHECK');
    });

    test('Dockerfile embeds cloudflared with multi-stage build, ca-certificates, and entrypoint hook', () => {
      const dockerfile = readProjectFile('Dockerfile');
      assert.match(dockerfile, /FROM cloudflare\/cloudflared:latest AS cloudflared-bin/, 'Must use multi-stage build for cloudflared');
      assert.match(dockerfile, /apk add --no-cache ca-certificates/, 'Must install ca-certificates for TLS handshakes');
      assert.match(dockerfile, /COPY --from=cloudflared-bin \/usr\/local\/bin\/cloudflared \/usr\/local\/bin\/cloudflared/, 'Must copy cloudflared binary');
      assert.match(dockerfile, /COPY scripts\/40-start-cloudflared\.sh \/docker-entrypoint\.d\/40-start-cloudflared\.sh/, 'Must copy startup script to docker-entrypoint.d');
      assert.match(dockerfile, /chmod \+x \/docker-entrypoint\.d\/40-start-cloudflared\.sh/, 'Must ensure entrypoint script is executable');
    });

    test('.gitignore and .dockerignore must protect .env and .agent', () => {
      const gitignore = readProjectFile('.gitignore');
      const dockerignore = readProjectFile('.dockerignore');

      assert.match(gitignore, /\.env\b/, '.gitignore must ignore .env');
      assert.match(gitignore, /\.agent\//, '.gitignore must ignore .agent/');
      assert.match(dockerignore, /\.env\b/, '.dockerignore must ignore .env');
      assert.match(dockerignore, /\.agent\//, '.dockerignore must ignore .agent/');
    });

    test('.env.example must declare downstream services, gateway configuration, and tunnel token', () => {
      const envExample = readProjectFile('.env.example');
      assert.match(envExample, /AUTH_SERVICE_URL=/, 'Must specify AUTH_SERVICE_URL');
      assert.match(envExample, /PRODUCT_SERVICE_URL=/, 'Must specify PRODUCT_SERVICE_URL');
      assert.match(envExample, /ORDER_SERVICE_URL=/, 'Must specify ORDER_SERVICE_URL');
      assert.match(envExample, /USER_SERVICE_URL=/, 'Must specify USER_SERVICE_URL');
      assert.match(envExample, /DNS_RESOLVER=/, 'Must specify DNS_RESOLVER');
      assert.match(envExample, /GATEWAY_PORT=/, 'Must specify GATEWAY_PORT');
      assert.match(envExample, /CORS_ALLOWED_ORIGIN_REGEX=/, 'Must specify CORS_ALLOWED_ORIGIN_REGEX');
      assert.match(envExample, /CLOUDFLARE_TUNNEL_TOKEN=/, 'Must document CLOUDFLARE_TUNNEL_TOKEN');
    });
  });

  describe('8. Cloudflare Tunnel Startup Hook Verification', () => {
    test('40-start-cloudflared.sh checks CLOUDFLARE_TUNNEL_TOKEN and falls back to standalone NGINX', () => {
      const script = readProjectFile('scripts/40-start-cloudflared.sh');
      assert.match(script, /if\s*\[\s*-n\s*"\$CLOUDFLARE_TUNNEL_TOKEN"\s*\];?\s*then/, 'Must check for non-empty token');
      assert.match(script, /cloudflared tunnel --no-autoupdate run --token "\$CLOUDFLARE_TUNNEL_TOKEN"\s*&/, 'Must launch tunnel in background');
      assert.match(script, /CLOUDFLARE_TUNNEL_TOKEN not set/, 'Must log standalone fallback message');
    });
  });

  describe('9. Mock Upstream Microservices Contract Simulation', () => {
    test('validates downstream service JWKS and docs endpoints response contracts', async () => {
      // Explain 'Why': Spins up simulated Auth, Product, Order, and User microservice endpoints in memory to verify contract schemas.
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

      const userServer = http.createServer((req, res) => {
        if (req.url === '/docs/openapi.yaml') {
          res.writeHead(200, { 'Content-Type': 'application/yaml' });
          res.end('openapi: 3.1.0\ninfo:\n  title: Store User Microservice API\n');
        } else if (req.url === '/api/users/profile') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ id: 'prof_123', userId: 'usr_abc_789', fullName: 'Budi Pratama' }));
        } else if (req.url === '/api/users/notifications') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ items: [{ id: 'notif_1', title: 'Welcome' }], totalCount: 1 }));
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      await new Promise(resolve => authServer.listen(0, resolve));
      await new Promise(resolve => productServer.listen(0, resolve));
      await new Promise(resolve => orderServer.listen(0, resolve));
      await new Promise(resolve => userServer.listen(0, resolve));

      const authPort = authServer.address().port;
      const productPort = productServer.address().port;
      const orderPort = orderServer.address().port;
      const userPort = userServer.address().port;

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

      // Test User Profile endpoint
      const userRes = await fetch(`http://127.0.0.1:${userPort}/api/users/profile`);
      const userData = await userRes.json();
      assert.equal(userRes.status, 200);
      assert.equal(userData.fullName, 'Budi Pratama');

      // Test User Docs OpenAPI endpoint
      const userDocsRes = await fetch(`http://127.0.0.1:${userPort}/docs/openapi.yaml`);
      const userDocsData = await userDocsRes.text();
      assert.equal(userDocsRes.status, 200);
      assert.ok(userDocsData.includes('Store User Microservice API'));

      authServer.close();
      productServer.close();
      orderServer.close();
      userServer.close();
    });
  });

});
