'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { ROUTES, oordeel, antwoordVan, voegToe } = require('./snapisolatie-oordeel');
const hash = x => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const ok = s => Number.isInteger(s) && s >= 200 && s < 300;
const FOTOS = {"a": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==", "b": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwADAgH/5ncLrgAAAABJRU5ErkJggg=="};
async function meet() {
  const { maakWereld, nieuwLid, verbind } = require('./voltooiwereld');
  // Deze proef leest lokale SQLite en media: geërfde PG/Redis/S3-config
  // mag nooit een tweede, gedeelde opslag buiten de wegwerpmap aanspreken.
  const w = await maakWereld('snapisolatie', {
    RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '', REDIS_URL: '', RTG_AUDIT_DATABASE_URL: '',
    RTG_MEDIA_BACKEND: 'disk', RTG_MEDIA_S3_BUCKET: '', RTG_MEDIA_S3_ENDPOINT: '',
    RTG_MEDIA_S3_KEY: '', RTG_MEDIA_S3_SECRET: '', AWS_ACCESS_KEY_ID: '', AWS_SECRET_ACCESS_KEY: ''
  });
  const p = { omgeving: 'geisoleerde-http-sqlite', actors: [], objecten: {}, stappen: [], sessies: [] };
  const uit = Object.fromEntries(ROUTES.map(pad => ['POST ' + pad, { gang: 'snapisolatie', bewijsVersie: 1, methode: 'POST', pad, proef: p }]));
  try {
    const A = await nieuwLid(w, 'snapiso-a'), B = await nieuwLid(w, 'snapiso-b'), C = await nieuwLid(w, 'snapiso-c');
    const personen = { a: A, b: B, c: C };
    const v = await verbind(w, A, B);
    A.key = v.a.key; B.key = v.b.key;
    const cc = await w.post('/api/member/connections', {}, C.token);
    C.key = cc.data?.me; C.codenaam = cc.data?.codename;
    if (!ok(cc.status) || ![v.a.codenaam, v.b.codenaam, C.codenaam].every(x => typeof x === 'string' && x.length)) throw new Error('geen geldige codenamen uit connections/verbind');
    A.codenaam = v.a.codenaam; B.codenaam = v.b.codenaam;
    if (![A.key, B.key, C.key].every(x => typeof x === 'string' && x)) throw new Error('accountidentiteit ontbreekt');
    p.actors = [A.key, B.key, C.key].map(hash);
    p.codenamen = [A.codenaam, B.codenaam, C.codenaam].map(hash);
    const tekst = { a: 'snap-a-' + crypto.randomUUID(), b: 'snap-b-' + crypto.randomUUID() };
    const staat = () => {
      const s = w.collectie('snaps');
      if (!Array.isArray(s)) throw new Error('geen persistente snapcollectie');
      const dir = path.join(w.datamap, 'media');
      return { snaps: s.map(x => ({ id: hash(x.id), inhoud: hash(x), van: hash(x.van), naar: hash(x.naar), tekst: hash(x.tekst), foto: hash(x.foto), at: hash(x.at) })).sort((a, b) => a.id.localeCompare(b.id)),
        media: fs.existsSync(dir) ? fs.readdirSync(dir).sort().map(f => hash([f, fs.readFileSync(path.join(dir, f)).toString('base64')])).sort() : [] };
    };
    const sessie = async a => {
      const r = await w.post('/api/member/connections', {}, personen[a].token);
      return { status: r.status, me: hash(r.data?.me ?? null), codenaam: hash(r.data?.codename ?? null) };
    };
    for (const actor of ['a', 'b', 'c']) p.sessies.push({ actor, voor: await sessie(actor) });
    const poging = async (id, pad, actor, body) => {
      const voor = staat();
      const r = await w.post(pad, body, personen[actor]?.token);
      const d = r.data || {};
      const geheimen = [tekst.a, tekst.b, ...Object.values(FOTOS), ...Object.values(personen).flatMap(x => [x.key, x.codenaam, x.snapId])].filter(x => typeof x === 'string' && x);
      const lekt = waarde => {
        if (typeof waarde === 'string') return geheimen.some(x => waarde.includes(x));
        if (!waarde || typeof waarde !== 'object') return false;
        return Object.entries(waarde).some(([k, v]) => ['foto', 'tekst', 'van', 'naar', 'toKey', 'id', 'snapId', 'snaps', 'email', 'naam', 'name'].includes(k) || lekt(v));
      };
      const antwoord = antwoordVan(d);
      p.stappen.push({ id, pad, methode: 'POST', actor, doel: body.id ? hash(body.id) : body.toKey ? hash(body.toKey) : null, status: r.status, antwoord, voor, na: staat(),
        lek: id.startsWith('weigering:') && lekt(d) });
      return r;
    };
    for (const actor of ['a', 'b']) {
      const ander = actor === 'a' ? 'b' : 'a';
      const r = await poging('send:' + actor, ROUTES[0], actor, { toKey: personen[ander].key, foto: FOTOS[actor], tekst: tekst[actor], idem: crypto.randomUUID() });
      if (!ok(r.status)) throw new Error('eigen verzending mislukt: ' + r.status);
      const snap = w.collectie('snaps').find(x => x.van === personen[actor].key && x.naar === personen[ander].key && x.tekst === tekst[actor]);
      if (!snap) throw new Error('verzonden snap ontbreekt op schijf');
      personen[actor].snapId = snap.id;
      const naam = path.basename(String(snap.foto || '').replace('/media/', ''));
      const media = hash([naam, fs.readFileSync(path.join(w.datamap, 'media', naam)).toString('base64')]);
      p.objecten[actor] = { id: hash(snap.id), tekst: hash(tekst[actor]), foto: hash(FOTOS[actor]), van: hash(v[actor].codenaam), media,
        opslag: { id: hash(snap.id), inhoud: hash(snap), van: hash(personen[actor].key), naar: hash(personen[ander].key),
          tekst: hash(tekst[actor]), foto: hash(snap.foto), at: hash(snap.at) } };
    }
    for (const actor of ['a', 'b', 'c']) await poging('lijst:' + actor, ROUTES[1], actor, { userId: A.key, key: A.key });
    await poging('weigering:send:c', ROUTES[0], 'c', { toKey: A.key, foto: FOTOS.a, tekst: tekst.a, idem: crypto.randomUUID() });
    await poging('weigering:view:c', ROUTES[2], 'c', { id: A.snapId });
    await poging('weigering:view:afzender', ROUTES[2], 'a', { id: A.snapId });
    const bodies = [{ toKey: B.key, foto: FOTOS.a, tekst: tekst.a }, {}, { id: A.snapId }];
    for (let i = 0; i < ROUTES.length; i++) await poging('weigering:anoniem:' + i, ROUTES[i], 'anoniem', bodies[i]);
    for (const actor of ['a', 'b']) {
      const ander = actor === 'a' ? 'b' : 'a';
      await poging('view:' + actor, ROUTES[2], actor, { id: personen[ander].snapId });
      await poging('weigering:herhaal:' + actor, ROUTES[2], actor, { id: personen[ander].snapId });
    }
    for (const s of p.sessies) s.na = await sessie(s.actor);
  } catch (e) { p.fout = String(e.message || e); }
  finally { await w.klaar(); }
  for (const r of Object.values(uit)) {
    const o = oordeel(r); r.staat = o.stand === 'gemeten' ? 'snapgescheiden' : o.stand === 'gebroken' ? 'doorbraak' : 'onbereikbaar'; r.reden = o.reden;
  }
  return uit;
}
module.exports = { ROUTES, oordeel, meet, voegToe };
