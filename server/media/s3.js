/* Mediastore (deelmodule): de S3-laag. De dependency-vrije AWS Signature
   V4-ondertekening (los testbaar tegen de officiele voorbeeldvector), de
   configuratie uit de omgeving en de S3-backend (put/get/del/has via
   ondertekende verzoeken; MinIO/R2 via endpoint, anders AWS). */
const crypto = require('crypto');
const https = require('https');
const http = require('http');

// De grootste toegestane bronfoto is 2 MiB. Geef de AEAD-envelop 64 bytes
// ruimte, maar laat een kapotte objectserver nooit onbegrensd bufferen.
const MAX_OBJECT_BYTES = 2 * 1024 * 1024 + 64;

/* ---------- AWS Signature V4 (dependency-vrij) ---------------------------------
   De ondertekening staat los zodat ze te testen is tegen de officiele
   AWS-voorbeeldvector. sigV4 tekent een stringToSign met de afgeleide sleutel. */
function hmac(key, data) { return crypto.createHmac('sha256', key).update(data).digest(); }
function sha256hex(data) { return crypto.createHash('sha256').update(data).digest('hex'); }
function afgeleideSleutel(secret, dateStamp, region, service) {
  let k = hmac('AWS4' + secret, dateStamp);
  k = hmac(k, region); k = hmac(k, service); k = hmac(k, 'aws4_request');
  return k;
}
// Volledige SigV4-handtekening voor een canonical request (los testbaar).
function sigV4({ secret, region, service, amzDate, canonicalRequest }) {
  const dateStamp = amzDate.slice(0, 8);
  const scope = dateStamp + '/' + region + '/' + service + '/aws4_request';
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequest)].join('\n');
  return crypto.createHmac('sha256', afgeleideSleutel(secret, dateStamp, region, service)).update(stringToSign).digest('hex');
}
function amzNu() { return new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''); } // YYYYMMDDTHHMMSSZ

function s3ConfigVanEnv(env) {
  env = env || {};
  const backend = String(env.RTG_MEDIA_BACKEND || '').trim().toLowerCase();
  if (backend && backend !== 'disk' && backend !== 's3')
    throw new Error('RTG_MEDIA_BACKEND moet exact "disk" of "s3" zijn.');
  const wil = backend === 's3';
  const bucket = String(env.RTG_MEDIA_S3_BUCKET || '').trim();
  if (!wil && !bucket) return null; // geen S3 gevraagd -> disk
  const key = String(env.RTG_MEDIA_S3_KEY || env.AWS_ACCESS_KEY_ID || '').trim();
  const secret = String(env.RTG_MEDIA_S3_SECRET || env.AWS_SECRET_ACCESS_KEY || '').trim();
  if (!bucket || !key || !secret) {
    throw new Error('RTG_MEDIA_BACKEND=s3 vraagt om RTG_MEDIA_S3_BUCKET, RTG_MEDIA_S3_KEY en RTG_MEDIA_S3_SECRET.');
  }
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) ||
      bucket.includes('..') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(bucket))
    throw new Error('RTG_MEDIA_S3_BUCKET bevat een ongeldige bucketnaam.');
  const region = String(env.RTG_MEDIA_S3_REGION || 'us-east-1').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/.test(region))
    throw new Error('RTG_MEDIA_S3_REGION heeft een ongeldige vorm.');
  let prefix = env.RTG_MEDIA_S3_PREFIX != null ? env.RTG_MEDIA_S3_PREFIX : 'media/';
  prefix = String(prefix);
  const prefixDelen = prefix.replace(/\/$/, '').split('/');
  if (prefix.length > 512 || prefix.startsWith('/') || prefix.includes('\\') ||
      (prefix && prefixDelen.some(deel => !deel || deel === '.' || deel === '..' || !/^[A-Za-z0-9._-]+$/.test(deel))) ||
      /[\0\r\n]/.test(prefix))
    throw new Error('RTG_MEDIA_S3_PREFIX mag geen absoluut pad, terugpad of stuurteken bevatten.');
  if (prefix && !prefix.endsWith('/')) prefix += '/';
  const endpoint = String(env.RTG_MEDIA_S3_ENDPOINT || '').trim();
  if (endpoint) {
    let u;
    try { u = new URL(endpoint); } catch (e) { throw new Error('RTG_MEDIA_S3_ENDPOINT is geen geldig absoluut adres.'); }
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password ||
        (u.pathname && u.pathname !== '/') || u.search || u.hash)
      throw new Error('RTG_MEDIA_S3_ENDPOINT moet een kale http(s)-origin zonder credentials, pad, query of fragment zijn.');
    if (env.NODE_ENV === 'production' && u.protocol !== 'https:')
      throw new Error('RTG_MEDIA_S3_ENDPOINT moet in productie HTTPS gebruiken.');
  }
  const timeoutMs = env.RTG_MEDIA_S3_TIMEOUT_MS == null || env.RTG_MEDIA_S3_TIMEOUT_MS === ''
    ? 8000 : Number(env.RTG_MEDIA_S3_TIMEOUT_MS);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 60000)
    throw new Error('RTG_MEDIA_S3_TIMEOUT_MS moet een geheel aantal milliseconden tussen 500 en 60000 zijn.');
  return { bucket, region, endpoint, key, secret, prefix, timeoutMs };
}

// De S3-backend: put/get/del/has via ondertekende verzoeken. endpoint gezet ->
// path-style (MinIO/R2/on-prem, http of https); anders AWS virtual-hosted https.
function maakS3Backend(cfg) {
  const ep = cfg.endpoint ? new URL(cfg.endpoint) : null;
  const transport = ep && ep.protocol === 'http:' ? http : https;
  const host = ep ? ep.host : cfg.bucket + '.s3.' + cfg.region + '.amazonaws.com';
  const port = ep && ep.port ? Number(ep.port) : undefined;
  const basis = ep ? '/' + cfg.bucket : '';
  function keurNaam(naam) {
    naam = String(naam || '');
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(naam) || naam === '.' || naam === '..')
      throw new Error('S3-objectnaam moet een enkel veilig sleutelsegment zijn.');
    return naam;
  }
  function objectPad(naam) {
    return (basis + '/' + cfg.prefix + keurNaam(naam)).split('/').map(encodeURIComponent).join('/').replace(/%2F/g, '/');
  }
  function fout(handeling, status) {
    const e = new Error('S3 ' + handeling + ' ' + status);
    e.code = 'RTG_MEDIA_UPSTREAM';
    e.mediaNietGevonden = status === 404;
    return e;
  }
  function verzoek(method, naam, body) {
    if (body && body.length > MAX_OBJECT_BYTES)
      return Promise.reject(new Error('S3-object overschrijdt de maximale mediagrootte.'));
    return new Promise((resolve, reject) => {
      const amzDate = amzNu();
      const canonUri = objectPad(naam);
      const payload = body || Buffer.alloc(0);
      const payloadHash = sha256hex(payload);
      const canonicalHeaders = 'host:' + host + '\nx-amz-content-sha256:' + payloadHash + '\nx-amz-date:' + amzDate + '\n';
      const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
      const canonicalRequest = [method, canonUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
      const signature = sigV4({ secret: cfg.secret, region: cfg.region, service: 's3', amzDate, canonicalRequest });
      const scope = amzDate.slice(0, 8) + '/' + cfg.region + '/s3/aws4_request';
      const headers = {
        Host: host, 'x-amz-date': amzDate, 'x-amz-content-sha256': payloadHash,
        Authorization: 'AWS4-HMAC-SHA256 Credential=' + cfg.key + '/' + scope + ', SignedHeaders=' + signedHeaders + ', Signature=' + signature
      };
      if (body) headers['Content-Length'] = body.length;
      const req = transport.request({ host: ep ? ep.hostname : host, port, method, path: canonUri, headers }, res => {
        const chunks = [];
        let totaal = 0;
        let afgebroken = false;
        const gemeld = Number(res.headers['content-length']);
        if (Number.isFinite(gemeld) && gemeld > MAX_OBJECT_BYTES) {
          afgebroken = true;
          res.destroy();
          reject(new Error('S3-antwoord overschrijdt de maximale mediagrootte.'));
          return;
        }
        res.on('data', c => {
          totaal += c.length;
          if (totaal > MAX_OBJECT_BYTES) {
            afgebroken = true;
            res.destroy();
            reject(new Error('S3-antwoord overschrijdt de maximale mediagrootte.'));
            return;
          }
          chunks.push(c);
        });
        res.on('error', reject);
        res.on('end', () => { if (!afgebroken) resolve({ status: res.statusCode, body: Buffer.concat(chunks, totaal) }); });
      });
      req.on('error', reject);
      req.setTimeout(cfg.timeoutMs || 8000, () => req.destroy(new Error('S3 antwoordde niet binnen de ingestelde tijd.')));
      if (body) req.write(body);
      req.end();
    });
  }
  return {
    naam: 's3',
    async put(naam, enc) { const r = await verzoek('PUT', naam, enc); if (r.status >= 300) throw fout('put', r.status); },
    async get(naam) { const r = await verzoek('GET', naam); if (r.status >= 300) throw fout('get', r.status); return r.body; },
    async del(naam) { const r = await verzoek('DELETE', naam); if (r.status >= 300 && r.status !== 404) throw fout('del', r.status); },
    async has(naam) { const r = await verzoek('HEAD', naam); if (r.status === 404) return false; if (r.status >= 300) throw fout('head', r.status); return true; }
  };
}

module.exports = { MAX_OBJECT_BYTES, afgeleideSleutel, sigV4, s3ConfigVanEnv, maakS3Backend };
