#!/usr/bin/env node
// Security checks for the static site. No dependencies.
//
//   node tests/security-check.mjs                      static checks only
//   node tests/security-check.mjs --url <base-url>     also probe a running server
//
// Exits with code 1 if any check fails.

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const ALLOWED_SCRIPT_HOSTS = ['cdnjs.cloudflare.com', 'unpkg.com'];
const ALLOWED_LINK_HOSTS = ['wa.me'];
const REQUIRED_HEADERS = [
  'content-security-policy',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'permissions-policy'
];

const results = [];
const check = (name, problems) => results.push({ name, problems: [].concat(problems).filter(Boolean) });

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const publicFiles = walk(PUBLIC);
const rel = (path) => relative(ROOT, path);
const read = (path) => readFileSync(path, 'utf8');

// ---------------------------------------------------------------- secrets

const SECRET_PATTERNS = [
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Stripe/OpenAI-style secret', /\bsk-(live_|proj-)?[A-Za-z0-9]{20,}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['credential assignment', /\b(api[_-]?key|secret|passw(or)?d|token)\s*[:=]\s*['"][^'"]{8,}['"]/i]
];

const trackedFiles = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((file) => !/\.(webp|png|jpe?g|gif|ico|woff2?)$/i.test(file));

check(
  'No secrets in tracked files',
  trackedFiles.flatMap((file) => {
    const text = read(join(ROOT, file));
    return SECRET_PATTERNS.filter(([, re]) => re.test(text)).map(([label]) => `${file}: ${label}`);
  })
);

const history = execFileSync('git', ['log', '-p', '--all', '--no-color'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024
});
check(
  'No secrets anywhere in git history',
  SECRET_PATTERNS.filter(([, re]) => re.test(history)).map(([label]) => `history: ${label}`)
);

check(
  'No environment or key files tracked',
  trackedFiles.filter((file) => /(^|\/)(\.env(\..*)?|.*\.(pem|key|p12|pfx)|id_rsa.*)$/i.test(file))
);

// ---------------------------------------------------------- published files

check(
  'public/ holds only site assets',
  publicFiles
    .filter((file) => {
      const name = basename(file);
      return (
        (name.startsWith('.') && name !== '.well-known') ||
        /\.(map|bak|old|orig|swp|zip|tar|gz|sql|log|py|sh|md|json)$/i.test(name)
      );
    })
    .map(rel)
);

// ------------------------------------------------------------------- HTML

const htmlFiles = publicFiles.filter((file) => extname(file) === '.html');

for (const file of htmlFiles) {
  const html = read(file);
  const name = rel(file);

  const csp = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)?.[1] ?? '';
  check(`${name}: strict Content-Security-Policy`, [
    !csp && 'missing CSP meta tag',
    csp && !/default-src 'none'/.test(csp) && "default-src is not 'none'",
    /'unsafe-inline'|'unsafe-eval'|\*/.test(csp) && 'CSP allows unsafe-inline, unsafe-eval or wildcards',
    csp && !/object-src 'none'/.test(csp) && "object-src is not 'none'",
    csp && !/base-uri 'none'/.test(csp) && "base-uri is not 'none'",
    csp && !/form-action 'none'/.test(csp) && "form-action is not 'none'"
  ]);

  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  check(
    `${name}: no inline JavaScript`,
    scripts
      .filter(([, attrs, body]) => !/\bsrc=/.test(attrs) && !/type="application\/ld\+json"/.test(attrs) && body.trim())
      .map(() => 'inline <script> found')
  );

  check(
    `${name}: third-party scripts are pinned with SRI`,
    scripts
      .map(([, attrs]) => attrs)
      .filter((attrs) => /\bsrc="https?:\/\//.test(attrs))
      .flatMap((attrs) => {
        const src = attrs.match(/src="([^"]+)"/)[1];
        const host = new URL(src).hostname;
        return [
          !ALLOWED_SCRIPT_HOSTS.includes(host) && `${src}: host not allowed`,
          !/integrity="sha(256|384|512)-/.test(attrs) && `${src}: missing integrity`,
          !/crossorigin="anonymous"/.test(attrs) && `${src}: missing crossorigin`,
          !/@?\d+\.\d+\.\d+/.test(src) && `${src}: version is not pinned`
        ];
      })
  );

  check(
    `${name}: no inline event handlers or style attributes`,
    [...html.matchAll(/<[^>]+\s(on[a-z]+|style)=["']/gi)].map((m) => `attribute ${m[1]}`)
  );

  check(
    `${name}: no forms, inputs or embedded frames`,
    [...html.matchAll(/<(form|input|textarea|select|iframe|object|embed)\b/gi)].map((m) => `<${m[1]}>`)
  );

  check(
    `${name}: new-tab links cannot reach window.opener`,
    [...html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/gi)]
      .filter(([tag]) => !/rel="[^"]*noopener[^"]*noreferrer|rel="[^"]*noreferrer[^"]*noopener/.test(tag))
      .map(([tag]) => tag.slice(0, 80))
  );

  check(
    `${name}: external links go only to allowed hosts`,
    [...html.matchAll(/href="(https?:\/\/[^"]+)"/gi)]
      .map(([, href]) => href)
      .filter((href) => !href.startsWith('https://fonts.'))
      .filter((href) => !ALLOWED_LINK_HOSTS.includes(new URL(href).hostname))
  );

  check(
    `${name}: no plain-http resources`,
    [...html.matchAll(/(?:src|href|srcset)="(http:\/\/[^"]+)"/gi)].map(([, url]) => url)
  );
}

// --------------------------------------------------------------------- JS

const DANGEROUS_JS = [
  ['eval()', /\beval\s*\(/],
  ['new Function()', /\bnew\s+Function\s*\(/],
  ['innerHTML/outerHTML assignment', /\.(inner|outer)HTML\s*=/],
  ['insertAdjacentHTML()', /\.insertAdjacentHTML\s*\(/],
  ['document.write()', /document\.write(ln)?\s*\(/],
  ['string passed to setTimeout/setInterval', /set(Timeout|Interval)\s*\(\s*['"`]/],
  ['location assignment from input', /location(\.href)?\s*=\s*[^;]*(search|hash|params)/i]
];

check(
  'JavaScript avoids DOM-injection sinks',
  publicFiles
    .filter((file) => extname(file) === '.js')
    .flatMap((file) => {
      const js = read(file);
      return DANGEROUS_JS.filter(([, re]) => re.test(js)).map(([label]) => `${rel(file)}: ${label}`);
    })
);

// ---------------------------------------------------------------- headers

const headersFile = join(PUBLIC, '_headers');
const headersText = read(headersFile).toLowerCase();
check(
  'public/_headers declares the security headers',
  [...REQUIRED_HEADERS, 'strict-transport-security']
    .filter((header) => !headersText.includes(`${header}:`))
    .map((header) => `missing ${header}`)
    .concat(headersText.includes("frame-ancestors 'none'") ? [] : ["CSP lacks frame-ancestors 'none'"])
);

// ------------------------------------------------------- live server probe

const urlFlag = process.argv.indexOf('--url');
if (urlFlag !== -1) {
  const base = process.argv[urlFlag + 1].replace(/\/$/, '');
  const get = (path, init) => fetch(base + path, { redirect: 'manual', ...init });

  const home = await get('/');
  check(
    'Server sends security headers',
    REQUIRED_HEADERS.filter((header) => !home.headers.get(header)).map((header) => `missing ${header}`)
  );

  const probes = [
    '/.git/config',
    '/.git/HEAD',
    '/.env',
    '/.DS_Store',
    '/../tools/serve.py',
    '/%2e%2e/tools/serve.py',
    '/..%2f..%2fREADME.md',
    '/assets/',
    '/assets/js/',
    '/tests/security-check.mjs',
    '/tools/serve.py',
    '/README.md'
  ];
  const exposed = [];
  for (const path of probes) {
    const response = await get(path);
    if (response.status < 400) exposed.push(`${path} -> ${response.status}`);
  }
  check('No sensitive paths, traversal or directory listings', exposed);

  const writes = [];
  for (const method of ['PUT', 'DELETE', 'POST', 'PATCH']) {
    const response = await get('/index.html', { method, body: method === 'DELETE' ? undefined : 'x' });
    if (response.status < 400) writes.push(`${method} -> ${response.status}`);
  }
  check('Server rejects write methods', writes);
}

// ----------------------------------------------------------------- report

let failed = 0;
for (const { name, problems } of results) {
  if (problems.length) {
    failed++;
    console.log(`✗ ${name}`);
    problems.forEach((problem) => console.log(`    ${problem}`));
  } else {
    console.log(`✓ ${name}`);
  }
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
