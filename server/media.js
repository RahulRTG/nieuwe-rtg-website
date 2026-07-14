/* Mediastore: foto's die anders als base64 IN de database (db.data) zouden staan,
   worden hier bewaard met alleen een korte verwijzing in db.data. Zo groeit het
   werkgeheugen en elke db-snapshot niet mee met de Salon-foto's en snaps.

   Twee verwisselbare backends (seam, net als server/betaal.js):
   - 'disk' (standaard): losse, met RTG_ENC_KEY versleutelde bestanden in
     DATA_DIR/media. Prima voor een enkele server of een gedeeld volume.
   - 's3': een S3-compatibele objectopslag (AWS S3, Cloudflare R2, MinIO,
     Backblaze) via ondertekende HTTPS-verzoeken (AWS SigV4, dependency-vrij met
     Node-crypto). ALLE servers delen dezelfde opslag, dus dit schaalt naar
     miljoenen gebruikers over losse machines. Een lokale kopie in DATA_DIR/media
     dient als warme cache zodat veelgevraagde foto's niet telkens opnieuw over het
     net komen.

   In beide gevallen staan de bytes VERSLEUTELD (met RTG_ENC_KEY) opgeslagen; de
   app ontsleutelt bij het uitserveren. De publieke API is async (het net kan traag
   zijn), maar identiek voor beide backends, zodat de rest van de app niet hoeft te
   weten waar de foto's staan.

   Twee soorten verwijzingen:
   - Salon-foto's (publiek): "/media/<naam>". De browser laadt die rechtstreeks in
     een <img src>; de /media-route serveert het bestand (en kan achter een CDN).
   - Snaps/verhalen (privé, kijk-een-keer): de kale bestandsnaam. Die komt nooit als
     publieke URL naar buiten; bij het openen leest de server het bestand en geeft
     het eenmalig als data-URL terug, waarna het weg mag. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const kluis = require('./kluis');

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const EXT_VAN_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const URL_PREFIX = '/media/';

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

function maakDiskBackend(dir) {
  function ensure() { try { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); fs.chmodSync(dir, 0o700); } catch (e) { try { fs.mkdirSync(dir, { recursive: true }); } catch (x) {} } }
  return {
    naam: 'disk',
    async put(naam, enc) { ensure(); fs.writeFileSync(path.join(dir, naam), enc, { mode: 0o600 }); },
    async get(naam) { return fs.readFileSync(path.join(dir, naam)); },
    async del(naam) { try { fs.unlinkSync(path.join(dir, naam)); } catch (e) {} },
    async has(naam) { return fs.existsSync(path.join(dir, naam)); }
  };
}

function maakMedia({ dir, env }) {
  env = env || process.env;
  const MEDIA_DIR = path.join(dir, 'media');
  const s3cfg = s3ConfigVanEnv(env);
  const backend = s3cfg ? maakS3Backend(s3cfg) : maakDiskBackend(MEDIA_DIR);
  // Bij S3 gebruiken we DATA_DIR/media als warme cache (versleutelde bytes).
  const cache = s3cfg ? maakDiskBackend(MEDIA_DIR) : null;

  function isRef(v) { return typeof v === 'string' && v.length > 0 && !v.startsWith('data:'); }
  function naamVan(ref) { return path.basename(String(ref || '').replace(URL_PREFIX, '')); }
  function url(naam) { return URL_PREFIX + naam; }
  function pad(ref) { return path.join(MEDIA_DIR, naamVan(ref)); }

  // De versleutelde bytes wegschrijven (backend + warme cache bij S3).
  async function put(naam, enc) { await backend.put(naam, enc); if (cache) { try { await cache.put(naam, enc); } catch (e) {} } }
  // De versleutelde bytes ophalen: eerst de warme cache, anders de backend (en cachen).
  async function haal(naam) {
    if (cache) { try { if (await cache.has(naam)) return await cache.get(naam); } catch (e) {} }
    const enc = await backend.get(naam);
    if (cache) { try { await cache.put(naam, enc); } catch (e) {} }
    return enc;
  }

  // Een data-URL opslaan -> bestandsnaam (of null als het geen geldige foto is/te groot).
  async function bewaar(dataUrl, maxBytes) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
    if (!m) return null;
    let buf;
    try { buf = Buffer.from(m[2], 'base64'); } catch (e) { return null; }
    if (!buf.length) return null;
    if (maxBytes && buf.length > maxBytes) return null;
    const naam = crypto.randomBytes(16).toString('hex') + '.' + EXT_VAN_MIME[m[1]];
    try { await put(naam, kluis.versleutelBuf(buf)); } catch (e) { return null; }
    return naam;
  }
  async function bewaarPubliek(dataUrl, maxBytes) { const n = await bewaar(dataUrl, maxBytes); return n ? url(n) : null; }

  async function leesBuf(ref) {
    try { return kluis.ontsleutelBuf(await haal(naamVan(ref))); } catch (e) { return null; }
  }
  async function leesDataUrl(ref) {
    if (typeof ref === 'string' && ref.startsWith('data:')) return ref; // oude, nog-inline foto: gewoon teruggeven
    const buf = await leesBuf(ref);
    if (!buf) return null;
    const ext = (path.extname(naamVan(ref)).slice(1) || 'jpg').toLowerCase();
    return 'data:' + (MIME[ext] || 'application/octet-stream') + ';base64,' + buf.toString('base64');
  }
  // Best-effort opruimen (backend + cache); niet gewacht, cleanup mag falen.
  function verwijder(ref) {
    if (!ref) return;
    const naam = naamVan(ref);
    Promise.resolve(backend.del(naam)).catch(() => {});
    if (cache) Promise.resolve(cache.del(naam)).catch(() => {});
  }
  async function bestaat(ref) { try { return await backend.has(naamVan(ref)); } catch (e) { return false; } }

  // De publieke /media-route: streamt een Salon-foto (na ontsleutelen). De naam is
  // 32 hex-tekens en dus onraadbaar; geen directory-traversal (basename + whitelist).
  async function serveer(req, res) {
    const naam = path.basename(String(req.params.naam || ''));
    if (!/^[0-9a-f]{32}\.(jpg|jpeg|png|webp)$/.test(naam)) return res.status(400).end();
    const buf = await leesBuf(naam);
    if (!buf) return res.status(404).end();
    const ext = path.extname(naam).slice(1).toLowerCase();
    res.set('Content-Type', MIME[ext] || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=31536000, immutable'); // inhoud verandert nooit voor een naam; CDN mag cachen
    res.set('X-Content-Type-Options', 'nosniff');
    res.end(buf);
  }

  /* Eenmalige migratie: foto's die nu nog als base64 IN db.data staan, verplaatsen
     naar de mediastore en vervangen door een verwijzing. Idempotent. */
  async function migreerDb(db) {
    if (!db || !db.data) return 0;
    let n = 0;
    const naarPubliek = async v => { if (typeof v === 'string' && v.startsWith('data:')) { const r = await bewaarPubliek(v, 1.5 * 1024 * 1024); if (r) { n++; return r; } } return v; };
    const naarPrive = async v => { if (typeof v === 'string' && v.startsWith('data:')) { const r = await bewaar(v, 900 * 1024); if (r) { n++; return r; } } return v; };
    for (const s of (db.data.suppliers || [])) {
      if (Array.isArray(s.photos)) { const out = []; for (const p of s.photos) out.push(await naarPubliek(p)); s.photos = out; }
      if (s.salon && s.salon.foto) s.salon.foto = await naarPubliek(s.salon.foto);
    }
    for (const p of (db.data.posts || [])) {
      if (p.photo) p.photo = await naarPubliek(p.photo);
      if (p.folder && Array.isArray(p.folder.fotos)) { const out = []; for (const f of p.folder.fotos) out.push(await naarPubliek(f)); p.folder.fotos = out; }
    }
    for (const s of (db.data.snaps || [])) if (s.foto) s.foto = await naarPrive(s.foto);
    for (const s of (db.data.stories || [])) if (s.foto) s.foto = await naarPrive(s.foto);
    return n;
  }

  return { MEDIA_DIR, backendNaam: backend.naam, isRef, url, naamVan, pad, bewaar, bewaarPubliek, leesBuf, leesDataUrl, verwijder, bestaat, serveer, migreerDb };
}

module.exports = { maakMedia, sigV4, afgeleideSleutel };
