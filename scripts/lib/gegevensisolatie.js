'use strict';
const crypto = require('node:crypto');
const { ROUTES, oordeel, voegToe, antwoordVan } = require('./gegevensisolatie-oordeel');
const hash = x => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const ok = s => Number.isInteger(s) && s >= 200 && s < 300;
async function meet() {
  const { maakWereld } = require('./voltooiwereld');
  // Deze proef leest lokale SQLite en media: geërfde PG/Redis/S3-config
  // mag nooit een tweede, gedeelde opslag buiten de wegwerpmap aanspreken.
  const w = await maakWereld('gegevensisolatie', {
    RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '', REDIS_URL: '', RTG_AUDIT_DATABASE_URL: '',
    RTG_MEDIA_BACKEND: 'disk', RTG_MEDIA_S3_BUCKET: '', RTG_MEDIA_S3_ENDPOINT: '',
    RTG_MEDIA_S3_KEY: '', RTG_MEDIA_S3_SECRET: '', AWS_ACCESS_KEY_ID: '', AWS_SECRET_ACCESS_KEY: ''
  });
  const { bindToestel, metToestellen } = require('./proeftoestel');
  const toestellen = [];
  const post = metToestellen(w.post, { toestellen: () => toestellen });
  const p = { omgeving: 'geisoleerde-http-sqlite', actors: {}, telefoons: {}, stappen: [], sessies: {} };
  const uit = Object.fromEntries(ROUTES.map(pad => ['POST ' + pad, { gang: 'gegevensisolatie', bewijsVersie: 1, methode: 'POST', pad, proef: p }]));
  try {
    const leden = {};
    for (const a of ['a', 'b']) {
      const r = await w.post('/api/auth/register', { name: 'Gegevensproef ' + a, email: 'gegevens-' + crypto.randomUUID() + '@voorbeeld.test', password: 'Gegevensproef123!', geboortedatum: '1985-05-05', tier: 'rtg', pasApp: 'rtg' });
      if (!ok(r.status) || !r.data?.token) throw new Error('echte registratie mislukt');
      const me = await w.post('/api/auth/me', {}, r.data.token);
      if (!ok(me.status) || me.data?.user?.id == null || me.data.user.phone) throw new Error('geen leeg eigen telefoonprofiel');
      leden[a] = { token: r.data.token, id: me.data.user.id, telefoon: a === 'a' ? '0612345678' : '0687654321' };
      const binding = await bindToestel({ post: w.post, token: leden[a].token, naam: 'Gegevensisolatie ' + a });
      if (!binding.klaar) throw new Error('eigen toestel niet gebonden: ' + binding.reden);
      toestellen.push(binding.klaar);
      p.actors[a] = hash(leden[a].id); p.telefoons[a] = hash(leden[a].telefoon);
    }
    const staat = () => {
      const rows = w.opslag('rtg.db', 'SELECT * FROM users ORDER BY id');
      const row = a => { const r = rows.find(x => x.id === leden[a].id); if (!r) throw new Error('account ontbreekt op schijf'); return hash(r); };
      return { a: row('a'), b: row('b'), overig: hash(rows.filter(x => x.id !== leden.a.id && x.id !== leden.b.id)) };
    };
    const sessie = async a => {
      const r = await w.post('/api/auth/me', {}, leden[a].token);
      return { status: r.status, actor: hash(r.data?.user?.id ?? null), telefoon: hash(r.data?.user?.phone || null) };
    };
    for (const a of ['a', 'b']) p.sessies[a] = { voor: await sessie(a) };
    const poging = async (id, pad, a, body) => {
      const voor = staat(), r = await post(pad, body, leden[a]?.token);
      const geheimen = Object.values(leden).flatMap(l => [l.telefoon, l.gesprek]).filter(Boolean);
      const lek = value => typeof value === 'string' ? geheimen.some(g => value.includes(g)) : value && typeof value === 'object'
        ? Object.entries(value).some(([k, v]) => ['phone', 'telefoon', 'enc_phone', 'member_state', 'user', 'users', 'account', 'accounts'].includes(k) || lek(v)) : false;
      const s = { id, pad, methode: 'POST', actor: a, actorId: leden[a] ? p.actors[a] : null, doel: body.userId == null ? null : hash(body.userId),
        gesprek: body.id ? hash(body.id) : null, status: r.status, antwoord: antwoordVan(r.data || {}), voor, na: staat(), lek: id.startsWith('weigering:') && !!lek(r.data) };
      p.stappen.push(s); return { r, s };
    };
    const vervals = a => { const b = leden[a === 'a' ? 'b' : 'a']; return { userId: b.id, accountId: b.id, key: 'user-' + b.id, id: b.id }; };
    for (const a of ['a', 'b']) {
      const { r, s } = await poging('start:' + a, ROUTES[0], a, { soort: 'bestelling', ...vervals(a) });
      if (!ok(r.status) || typeof r.data?.id !== 'string') throw new Error('eigen gesprek niet gestart');
      leden[a].gesprek = r.data.id; s.gesprek = hash(r.data.id);
    }
    for (const a of ['a', 'b']) await poging('weigering:kruis:' + a, ROUTES[1], a, { ...vervals(a), id: leden[a === 'a' ? 'b' : 'a'].gesprek, tekst: leden[a].telefoon });
    await poging('weigering:anoniem:0', ROUTES[0], 'anoniem', { soort: 'bestelling' });
    await poging('weigering:anoniem:1', ROUTES[1], 'anoniem', { id: leden.a.gesprek, tekst: leden.b.telefoon });
    for (const a of ['a', 'b']) await poging('zeg:' + a, ROUTES[1], a, { ...vervals(a), id: leden[a].gesprek, tekst: leden[a].telefoon });
    for (const a of ['a', 'b']) p.sessies[a].na = await sessie(a);
    p.herstart = { voor: staat() }; await w.herstart(); p.herstart.na = staat(); p.herstart.aantal = w.herstarts.netjes;
    for (const a of ['a', 'b']) p.sessies[a].herstart = await sessie(a);
  } catch (e) { p.fout = String(e.message || e); }
  finally { await w.klaar(); }
  for (const r of Object.values(uit)) { const o = oordeel(r); r.staat = o.stand === 'gemeten' ? 'gegevensgescheiden' : o.stand === 'gebroken' ? 'doorbraak' : 'onbereikbaar'; r.reden = o.reden; }
  return uit;
}
module.exports = { ROUTES, meet, oordeel, voegToe, antwoordVan };
