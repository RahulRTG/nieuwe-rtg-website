/* Mediastore (deelmodule): de S3-laag. De dependency-vrije AWS Signature
   V4-ondertekening (los testbaar tegen de officiele voorbeeldvector), de
   configuratie uit de omgeving en de S3-backend (put/get/del/has via
   ondertekende verzoeken; MinIO/R2 via endpoint, anders AWS). */
const crypto = require('crypto');
const https = require('https');
const http = require('http');

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
  const wil = (env.RTG_MEDIA_BACKEND || '').toLowerCase() === 's3';
  const bucket = env.RTG_MEDIA_S3_BUCKET;
  if (!wil && !bucket) return null; // geen S3 gevraagd -> disk
  const key = env.RTG_MEDIA_S3_KEY || env.AWS_ACCESS_KEY_ID;
  const secret = env.RTG_MEDIA_S3_SECRET || env.AWS_SECRET_ACCESS_KEY;
  if (!bucket || !key || !secret) {
    throw new Error('RTG_MEDIA_BACKEND=s3 vraagt om RTG_MEDIA_S3_BUCKET, RTG_MEDIA_S3_KEY en RTG_MEDIA_S3_SECRET.');
  }
  let prefix = env.RTG_MEDIA_S3_PREFIX != null ? env.RTG_MEDIA_S3_PREFIX : 'media/';
  if (prefix && !prefix.endsWith('/')) prefix += '/';
  return { bucket, region: env.RTG_MEDIA_S3_REGION || 'us-east-1', endpoint: env.RTG_MEDIA_S3_ENDPOINT || '', key, secret, prefix };
}

// De S3-backend: put/get/del/has via ondertekende verzoeken. endpoint gezet ->
// path-style (MinIO/R2/on-prem, http of https); anders AWS virtual-hosted https.
function maakS3Backend(cfg) {
  const ep = cfg.endpoint ? new URL(cfg.endpoint) : null;
  const transport = ep && ep.protocol === 'http:' ? http : https;
  const host = ep ? ep.host : cfg.bucket + '.s3.' + cfg.region + '.amazonaws.com';
  const port = ep && ep.port ? Number(ep.port) : undefined;
  const basis = ep ? '/' + cfg.bucket : '';
  function objectPad(naam) {
    return (basis + '/' + cfg.prefix + naam).split('/').map(encodeURIComponent).join('/').replace(/%2F/g, '/');
  }
  function verzoek(method, naam, body) {
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
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }
  return {
    naam: 's3',
    async put(naam, enc) { const r = await verzoek('PUT', naam, enc); if (r.status >= 300) throw new Error('S3 put ' + r.status); },
    async get(naam) { const r = await verzoek('GET', naam); if (r.status >= 300) throw new Error('S3 get ' + r.status); return r.body; },
    async del(naam) { const r = await verzoek('DELETE', naam); if (r.status >= 300 && r.status !== 404) throw new Error('S3 del ' + r.status); },
    async has(naam) { const r = await verzoek('HEAD', naam); return r.status < 300; }
  };
}

module.exports = { afgeleideSleutel, sigV4, s3ConfigVanEnv, maakS3Backend };
