'use strict';
// Afgebakend opslagbewijs, geen algemene toestemming op grond van {ok:true}.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROUTES = ['/api/verify/status', '/api/verify/upload', '/api/verify/selfie'];
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const hash = x => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const ok = s => Number.isInteger(s) && s >= 200 && s < 300;
const digest = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
function oordeel(r) {
  const open = reden => ({ stand: 'open', reden });
  if (!r || r.gang !== 'verificatie-opslag' || r.bewijsVersie !== 1 || r.methode !== 'POST' || !ROUTES.includes(r.pad)) return open('geen passend verificatie-opslagcontract');
  const p = r.proef;
  if (!p || !digest(p.actorA) || !digest(p.actorB) || p.actorA === p.actorB) return open('geen twee onderscheiden eigen accounts');
  const staten = ['voor', 'na'];
  const geldig = x => x && staten.every(k => x[k] && digest(x[k].a) && digest(x[k].b) && digest(x[k].overig));
  const schrijf = r.pad !== '/api/verify/status';
  // Ruwe tegenbewijzen blijven een bevinding; niet verstoppen als ontbrekende fixture.
  const breuk = x => geldig(x) && (x.voor.a !== x.na.a || x.voor.b !== x.na.b || x.voor.overig !== x.na.overig);
  if (geldig(p.kruis) && (p.kruis.voor.a !== p.kruis.na.a || p.kruis.voor.overig !== p.kruis.na.overig)) return { stand: 'gebroken', reden: 'B wijzigde de verificatieopslag van A' };
  if (Array.isArray(p.rollen) && p.rollen.some(x => x && (ok(x.status) || (typeof x.lek === 'string' && x.lek.length) || breuk(x)))) return { stand: 'gebroken', reden: 'een vreemde rol kwam binnen, lekte gegevens of wijzigde verificatieopslag' };
  if (!Array.isArray(p.eigen) || p.eigen.length !== 2) return open('eigen handelingen ontbreken');
  for (const actor of ['a', 'b']) {
    const e = p.eigen.filter(x => x?.actor === actor);
    if (e.length !== 1 || !geldig(e[0]) || !ok(e[0].status) || e[0].methode !== 'POST' || e[0].pad !== r.pad) return open('eigen route niet positief gemeten');
    const x = e[0], ander = actor === 'a' ? 'b' : 'a';
    if (x.voor[ander] !== x.na[ander] || x.voor.overig !== x.na.overig || (schrijf ? x.voor[actor] === x.na[actor] : x.voor[actor] !== x.na[actor])) return open('eigen opslagcontrole klopt niet');
  }
  const k = p.kruis;
  if (!geldig(k) || k.methode !== 'POST' || k.pad !== r.pad || !ok(k.status) || k.doel !== p.actorA || k.actor !== p.actorB || k.voor.a !== k.na.a || k.voor.overig !== k.na.overig || (schrijf ? k.voor.b === k.na.b : k.voor.b !== k.na.b)) return open('kruispoging bewijst geen opslagisolatie');
  if (!schrijf && (!['pending', 'verified', 'rejected', 'none'].includes(p.statusA) || !['pending', 'verified', 'rejected', 'none', 'unverified'].includes(p.statusB) || p.statusA === p.statusB || k.antwoordStatus !== p.statusB)) return open('statusantwoord onderscheidt de accounts niet');
  if (!Array.isArray(p.rollen) || p.rollen.length !== 3) return open('rolpogingen ontbreken');
  for (const rol of ['supplier', 'office', 'anoniem']) {
    const rows = p.rollen.filter(x => x?.rol === rol);
    if (rows.length !== 1) return open('rolpoging ontbreekt of is dubbel');
    const x = rows[0];
    if (!geldig(x) || x.pad !== r.pad || x.methode !== 'POST' || ![401, 403].includes(x.status) || x.lek !== null || x.voor.a !== x.na.a || x.voor.b !== x.na.b || x.voor.overig !== x.na.overig || (rol !== 'anoniem' && (!ok(x.eigenVoor) || !ok(x.eigenNa)))) return open('rolweigering of onveranderde opslag ontbreekt');
  }
  if (!Array.isArray(p.sessies) || p.sessies.length !== 2 || !['a', 'b'].every(actor => p.sessies.filter(x => x?.actor === actor && ok(x.voor) && ok(x.na)).length === 1)) return open('eigen sessies niet levend voor en na');
  return { stand: 'gemeten', reden: 'drie expliciete verificatieroutes: eigen handelingen, sessiegebonden opslagisolatie en geweigerde rollen; geen inhoudelijke documentkeuring' };
}
async function meet() {
  const { maakWereld, nieuwLid, KANTOORWERELD } = require('./voltooiwereld');
  const { weegAntwoord } = require('./rolproef');
  const w = await maakWereld('verificatie-isolatie', KANTOORWERELD);
  const uit = {};
  try {
    const A = await nieuwLid(w, 'iso-a'), B = await nieuwLid(w, 'iso-b');
    const id = async t => (await w.post('/api/auth/me', {}, t)).data.user.id;
    A.id = await id(A.token); B.id = await id(B.token);
    const supplier = (await w.post('/api/supplier/login', { username: 'rahul', password: process.env.DEMO_PASS || 'Imran' })).data?.token;
    const office = (await w.post('/api/office/login', { code: KANTOORWERELD.OFFICE_CODE })).data?.token;
    if (!supplier || !office) throw new Error('geen levende rolfixtures');
    const lees = user => {
      const rij = w.opslag('rtg.db', 'SELECT id, verified, id_doc, member_state FROM users WHERE id = ?', user.id)[0];
      if (!rij) throw new Error('eigen account ontbreekt in opslag');
      const map = path.join(w.datamap, 'uploads');
      const bestanden = fs.existsSync(map) ? fs.readdirSync(map).filter(f => f.startsWith(user.id + '-')).sort().map(f => [f, hash(fs.readFileSync(path.join(map, f)).toString('base64'))]) : [];
      return hash({ rij, bestanden });
    };
    const staat = () => {
      const anderen = w.opslag('rtg.db', 'SELECT id, verified, id_doc, member_state FROM users WHERE id NOT IN (?, ?) ORDER BY id', A.id, B.id);
      const map = path.join(w.datamap, 'uploads');
      const overigeBestanden = fs.existsSync(map) ? fs.readdirSync(map).filter(f => !f.startsWith(A.id + '-') && !f.startsWith(B.id + '-')).sort().map(f => [f, hash(fs.readFileSync(path.join(map, f)).toString('base64'))]) : [];
      return { a: lees(A), b: lees(B), overig: hash({ anderen, overigeBestanden }) };
    };
    const sessie = async t => (await w.post('/api/auth/me', {}, t)).status;
    // Verschillende toestanden door een echte upload, nooit een database-seed.
    if (!ok((await w.post('/api/verify/upload', { image: PNG }, A.token)).status)) throw new Error('A kan niet uploaden');
    for (const pad of ROUTES) {
      const p = { actorA: hash(A.id), actorB: hash(B.id), eigen: [], rollen: [], sessies: [] };
      const r = { gang: 'verificatie-opslag', bewijsVersie: 1, methode: 'POST', pad, proef: p };
      uit['POST ' + pad] = r;
      for (const [actor, lid] of [['a', A], ['b', B]]) p.sessies.push({ actor, voor: await sessie(lid.token) });
      const lijf = pad.endsWith('/status') ? {} : { image: PNG };
      const poging = async (token, body) => {
        const voor = staat();
        const antwoord = await w.post(pad, body, token);
        return { methode: 'POST', pad, status: antwoord.status, voor, na: staat(), antwoord };
      };
      for (const [actor, lid] of [['a', A], ['b', B]]) {
        const x = await poging(lid.token, lijf);
        if (pad.endsWith('/status')) p[actor === 'a' ? 'statusA' : 'statusB'] = x.antwoord.data?.status;
        delete x.antwoord; p.eigen.push({ actor, ...x });
      }
      const body = { ...lijf, id: A.id, userId: A.id, accountId: A.id, key: 'user-' + A.id };
      const k = await poging(B.token, body);
      p.kruis = { ...k, actor: p.actorB, doel: p.actorA, antwoordStatus: k.antwoord.data?.status };
      delete p.kruis.antwoord;
      for (const [rol, token, eigenPad] of [['supplier', supplier, '/api/supplier/backoffice'], ['office', office, '/api/office/state'], ['anoniem', null, null]]) {
        const eigenVoor = eigenPad ? (await w.post(eigenPad, {}, token)).status : null;
        const x = await poging(token, body);
        const eigenNa = eigenPad ? (await w.post(eigenPad, {}, token)).status : null;
        const gewogen = weegAntwoord(x.status, JSON.stringify(x.antwoord.data));
        delete x.antwoord;
        p.rollen.push({ rol, ...x, eigenVoor, eigenNa, lek: gewogen.lek || null });
      }
      for (const s of p.sessies) s.na = await sessie(s.actor === 'a' ? A.token : B.token);
      const o = oordeel(r);
      r.staat = o.stand === 'gemeten' ? 'opslaggescheiden' : o.stand === 'gebroken' ? 'doorbraak' : 'onbereikbaar';
      r.reden = o.reden;
    }
  } finally { w.klaar(); }
  return uit;
}
module.exports = { ROUTES, PNG, oordeel, meet };
