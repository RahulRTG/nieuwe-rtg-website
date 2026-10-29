'use strict';
// Twee sessiegebonden gegevensroutes, telefoonflow, geïsoleerde HTTP/SQLite.
// Gesprekken leven bewust in geheugen; alleen voltooide opslag wordt herstartgetoetst.
const crypto = require('node:crypto');
const ROUTES = ['/api/gegevens/start', '/api/gegevens/zeg'];
const hash = x => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const digest = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const ok = s => Number.isInteger(s) && s >= 200 && s < 300;
const canon = x => Array.isArray(x) ? x.map(canon) : x && typeof x === 'object'
  ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canon(v)])) : x;
const gelijk = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const antwoordVan = x => typeof x === 'string' ? hash(x) : Array.isArray(x) ? x.map(antwoordVan) : x && typeof x === 'object'
  ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, antwoordVan(v)])) : x;
const geldig = x => x && ['a', 'b', 'overig'].every(k => digest(x[k]));
function voegToe(bestaand, nieuw) {
  for (const [k, v] of Object.entries(nieuw)) if (!(bestaand[k]?.lek === true || ['doorbraak', 'lek'].includes(bestaand[k]?.staat))) bestaand[k] = v;
  return bestaand;
}
function succesStructuur(s) {
  const a = s.antwoord;
  const velden = s.pad === ROUTES[0] ? ['status', 'id', 'tekst', 'veld', 'viaVerificatie', 'viaScan', 'nog'] : ['status', 'klaar', 'tekst'];
  if (!a || typeof a !== 'object' || Array.isArray(a) || !gelijk(Object.keys(a).sort(), velden.sort())) return false;
  if (a.status !== 200 || !digest(a.tekst)) return false;
  return s.pad === ROUTES[0] ? digest(a.id) && a.veld === hash('telefoon') && a.viaVerificatie === false && a.viaScan === false && a.nog === 1 : a.klaar === true;
}
function oordeel(r) {
  const open = reden => ({ stand: 'open', reden }), stuk = reden => ({ stand: 'gebroken', reden });
  if (!r || r.gang !== 'gegevensisolatie' || r.bewijsVersie !== 1 || r.methode !== 'POST' || !ROUTES.includes(r.pad)) return open('geen passend gegevenscontract');
  const p = r.proef;
  if (!p || !Array.isArray(p.stappen)) return open('geen ruwe gegevensproef');
  // Concrete negatieve resultaten blijven staan, ook bij een later fixtureprobleem.
  for (const s of p.stappen) if (s && s.methode === 'POST' && ROUTES.includes(s.pad) && typeof s.id === 'string') {
    if (ok(s.status) && !succesStructuur(s)) return stuk('succesantwoord bevat ontbrekende, extra of geneste inhoud buiten het gegevenscontract');
    if (s.id.startsWith('weigering:') && (ok(s.status) || s.lek === true || (geldig(s.voor) && geldig(s.na) && !gelijk(s.voor, s.na)))) return stuk('vreemde actor kreeg gegevens of wijzigde opslag');
    if (['a', 'b'].includes(s.actor) && geldig(s.voor) && geldig(s.na)) {
      const ander = s.actor === 'a' ? 'b' : 'a';
      if (s.voor[ander] !== s.na[ander] || s.voor.overig !== s.na.overig) return stuk('sessiegebonden handeling wijzigde een ander account');
    }
  }
  if (p.omgeving !== 'geisoleerde-http-sqlite' || !p.actors || !['a', 'b'].every(a => digest(p.actors[a])) || p.actors.a === p.actors.b ||
      !p.telefoons || !['a', 'b'].every(a => digest(p.telefoons[a])) || p.telefoons.a === p.telefoons.b) return open('onderscheiden accounts of telefoonwaarden ontbreken');
  const stappen = new Map();
  for (const s of p.stappen) {
    if (!s || typeof s.id !== 'string' || stappen.has(s.id) || s.methode !== 'POST' || !ROUTES.includes(s.pad) || !Number.isInteger(s.status) ||
        !geldig(s.voor) || !geldig(s.na) || !s.antwoord || typeof s.lek !== 'boolean') return open('onvolledige of dubbele stap');
    stappen.set(s.id, s);
  }
  if (p.fout) return open('uitvoering niet afgerond: ' + p.fout);
  const vraag = s => ({ status: 200, id: s.gesprek, tekst: hash('Waar kan de zaak je bereiken? Je telefoonnummer.'), veld: hash('telefoon'), viaVerificatie: false, viaScan: false, nog: 1 });
  const sessie = (s, a, nummer) => s && ok(s.status) && s.actor === p.actors[a] && s.telefoon === nummer;
  for (const a of ['a', 'b']) {
    const ander = a === 'a' ? 'b' : 'a';
    const start = stappen.get('start:' + a), zeg = stappen.get('zeg:' + a), kruis = stappen.get('weigering:kruis:' + a);
    if (!start || start.pad !== ROUTES[0] || start.actor !== a || start.actorId !== p.actors[a] || start.doel !== p.actors[ander] || !digest(start.gesprek) ||
        !ok(start.status) || !gelijk(start.antwoord, vraag(start)) || !gelijk(start.voor, start.na)) return open('start met vreemde lichaamsidentiteit niet als eigen gesprek bewezen');
    const vreemd = stappen.get('start:' + ander);
    if (!vreemd || start.gesprek === vreemd.gesprek) return open('geen twee onderscheiden gesprekken');
    if (!kruis || kruis.pad !== ROUTES[1] || kruis.actor !== a || kruis.actorId !== p.actors[a] || kruis.doel !== p.actors[ander] || kruis.gesprek !== vreemd.gesprek || kruis.status !== 403 ||
        !gelijk(kruis.antwoord, antwoordVan({ status: 403, error: 'Dit gesprek is niet van jou.' })) || kruis.lek || !gelijk(kruis.voor, kruis.na)) return open('kruiscontrole op bestaand gesprek ontbreekt');
    if (!zeg || zeg.pad !== ROUTES[1] || zeg.actor !== a || zeg.actorId !== p.actors[a] || zeg.doel !== p.actors[ander] || zeg.gesprek !== start.gesprek || !ok(zeg.status) ||
        !gelijk(zeg.antwoord, antwoordVan({ status: 200, klaar: true, tekst: 'Genoteerd. Ga je gang.' })) || zeg.voor[a] === zeg.na[a] ||
        zeg.voor[ander] !== zeg.na[ander] || zeg.voor.overig !== zeg.na.overig) return open('eigen afronding en geïsoleerde opslag niet bewezen');
    const ijk = p.sessies?.[a];
    if (!ijk || !sessie(ijk.voor, a, hash(null)) || !sessie(ijk.na, a, p.telefoons[a]) || !sessie(ijk.herstart, a, p.telefoons[a])) return open('identiteit of eigen telefoon niet voor/na/herstart geijkt');
  }
  const plaats = id => p.stappen.findIndex(s => s.id === id);
  for (const a of ['a', 'b']) if (plaats('weigering:kruis:' + a) > plaats('zeg:a') || plaats('weigering:kruis:' + a) > plaats('zeg:b')) return open('kruiscontrole kwam na consumptie');
  for (let i = 0; i < ROUTES.length; i++) {
    const x = stappen.get('weigering:anoniem:' + i);
    if (!x || x.pad !== ROUTES[i] || x.actor !== 'anoniem' || x.actorId !== null || ![401, 403].includes(x.status) || x.lek || !gelijk(x.voor, x.na)) return open('anonieme weigering ontbreekt');
    if (!gelijk(x.antwoord, antwoordVan({ error: 'Niet ingelogd.' }))) return stuk('anonieme weigering bevat onverwachte inhoud');
    if (i === 1 && (x.gesprek !== stappen.get('start:a').gesprek || plaats(x.id) > plaats('zeg:a'))) return open('anonieme proef gebruikte geen levend gesprek');
  }
  for (let i = 1; i < p.stappen.length; i++) if (!gelijk(p.stappen[i - 1].na, p.stappen[i].voor)) return open('persistente opslaglijn onderbroken');
  if (!p.herstart || p.herstart.aantal !== 1 || !geldig(p.herstart.voor) || !geldig(p.herstart.na) || !gelijk(p.herstart.voor, p.herstart.na) ||
      !gelijk(p.herstart.voor, p.stappen.at(-1).na)) return open('voltooide opslag niet na herstart behouden');
  return { stand: 'gemeten', reden: 'twee gegevensroutes: echte eigen telefoonflow, vreemde gespreksids geweigerd, lichaamsidentiteit genegeerd, anoniem geweigerd en eigen kluisopslag na herstart; HTTP/SQLite, geen algemene adres/document/PG/concurrencykwalificatie' };
}
module.exports = { ROUTES, oordeel, voegToe, antwoordVan };
