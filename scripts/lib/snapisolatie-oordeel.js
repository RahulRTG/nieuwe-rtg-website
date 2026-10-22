'use strict';
// Bewijs van drie concrete HTTP-deuren. Geen concurrency-, PostgreSQL- of
// productievrijgave: de standaard meetwereld is geïsoleerde HTTP/SQLite.
const crypto = require('node:crypto');
const ROUTES = ['/api/member/snap/send', '/api/member/snaps', '/api/member/snap/view'];
const hash = x => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const digest = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const ok = s => Number.isInteger(s) && s >= 200 && s < 300;
const canon = x => Array.isArray(x) ? x.map(canon) : x && typeof x === 'object'
  ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canon(v)])) : x;
const gelijk = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
// Behoud alle veldnamen en geneste structuur; alleen waarden worden gehasht.
function antwoordVan(x) {
  if (typeof x === 'string') return hash(x);
  if (Array.isArray(x)) return x.map(antwoordVan);
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, antwoordVan(v)]));
  return x;
}
function voegToe(bestaand, nieuw) {
  for (const [pad, rij] of Object.entries(nieuw)) {
    const oud = bestaand[pad];
    if (oud && (oud.lek === true || ['doorbraak', 'lek'].includes(oud.staat))) continue;
    bestaand[pad] = rij;
  }
  return bestaand;
}
const geldig = s => s && Array.isArray(s.snaps) && s.snaps.every(x => x && ['id', 'inhoud', 'van', 'naar', 'tekst', 'foto', 'at'].every(k => digest(x[k]))) &&
  new Set(s.snaps.map(x => x.id)).size === s.snaps.length && Array.isArray(s.media) && s.media.every(digest);
const zonder = (s, id) => s.snaps.filter(x => x.id !== id);
function antwoordStructuur(x) {
  const velden = (o, ks) => o && !Array.isArray(o) && typeof o === 'object' && gelijk(Object.keys(o).sort(), ks.sort());
  if (x.pad === ROUTES[0]) return velden(x.antwoord, ['ok']) && x.antwoord.ok === true;
  if (x.pad === ROUTES[1]) return velden(x.antwoord, ['snaps']) && Array.isArray(x.antwoord.snaps) &&
    x.antwoord.snaps.every(s => velden(s, ['id', 'tekst', 'van', 'at']) && Object.values(s).every(digest));
  return velden(x.antwoord, ['foto', 'tekst', 'van']) && Object.values(x.antwoord).every(digest);
}
function oordeel(r) {
  const open = reden => ({ stand: 'open', reden });
  const stuk = reden => ({ stand: 'gebroken', reden });
  if (!r || r.gang !== 'snapisolatie' || r.bewijsVersie !== 1 || r.methode !== 'POST' || !ROUTES.includes(r.pad)) return open('geen passend snapcontract');
  const p = r.proef;
  if (!p || !Array.isArray(p.stappen)) return open('geen ruwe stappen');
  for (const x of p.stappen) if (x && typeof x.id === 'string' && x.id.startsWith('weigering:') &&
      ROUTES.includes(x.pad) && x.methode === 'POST' && Number.isInteger(x.status) &&
      (x.lek === true || ok(x.status) || (geldig(x.voor) && geldig(x.na) && !gelijk(x.voor, x.na))))
    return stuk('geweigerde actor kreeg toegang, inhoud of wijzigde snap/mediaopslag');
  for (const x of p.stappen) if (x && ROUTES.includes(x.pad) && x.methode === 'POST' && ok(x.status) &&
      x.antwoord && !antwoordStructuur(x)) return stuk('succesantwoord bevat ontbrekende, extra of geneste inhoud buiten het snapcontract');
  if (p.omgeving !== 'geisoleerde-http-sqlite' || !Array.isArray(p.actors) || p.actors.length !== 3 ||
      !p.actors.every(digest) || new Set(p.actors).size !== 3 || !Array.isArray(p.codenamen) || p.codenamen.length !== 3 ||
      !p.codenamen.every(digest) || new Set(p.codenamen).size !== 3) return open('drie onderscheiden accounts ontbreken');
  const stappen = new Map();
  for (const x of p.stappen) {
    if (!x || typeof x.id !== 'string' || stappen.has(x.id) || !ROUTES.includes(x.pad) || x.methode !== 'POST' ||
        !Number.isInteger(x.status) || !geldig(x.voor) || !geldig(x.na) || !x.antwoord || typeof x.lek !== 'boolean') return open('onvolledige of dubbele stap');
    stappen.set(x.id, x);
  }
  const pak = (id, pad) => { const x = stappen.get(id); return x?.pad === pad ? x : null; };
  // Bekende concrete tegenbewijzen mogen niet verdwijnen achter ontbrekende fixtures.
  for (const x of p.stappen) if (x.id.startsWith('weigering:') &&
      (ok(x.status) || x.lek || !gelijk(x.voor, x.na))) return stuk('geweigerde actor kreeg toegang, inhoud of wijzigde snap/mediaopslag');
  if (p.fout) return open('meetuitvoering niet afgerond: ' + String(p.fout));
  if (!p.objecten || !['a', 'b'].every(a => p.objecten[a] && ['id', 'tekst', 'foto', 'van', 'media'].every(k => digest(p.objecten[a][k]))) ||
      p.objecten.a.id === p.objecten.b.id || p.objecten.a.tekst === p.objecten.b.tekst || p.objecten.a.foto === p.objecten.b.foto) return open('twee onderscheiden echte snaps ontbreken');
  for (const a of ['a', 'b']) {
    const o = p.objecten[a];
    const index = a === 'a' ? 0 : 1;
    if (!o.opslag || !geldig({ snaps: [o.opslag], media: [] }) || o.opslag.id !== o.id || o.opslag.van !== p.actors[index] ||
        o.opslag.naar !== p.actors[1 - index] || o.opslag.tekst !== o.tekst || o.van !== p.codenamen[index]) return open('objectinhoud niet gebonden aan de verwachte actoren');
    const stuur = pak('send:' + a, ROUTES[0]);
    if (!stuur || stuur.actor !== a || !ok(stuur.status) || !gelijk(stuur.antwoord, { ok: true }) || !gelijk(stuur.na.snaps.find(x => x.id === o.id), o.opslag) ||
        stuur.na.snaps.length !== stuur.voor.snaps.length + 1 || !gelijk(zonder(stuur.na, o.id), stuur.voor.snaps) ||
        stuur.na.media.length !== stuur.voor.media.length + 1 || !gelijk(stuur.na.media.filter(x => x !== o.media), stuur.voor.media) || !stuur.na.media.includes(o.media)) return open('eigen verzending niet positief opgeslagen');
    const lijst = pak('lijst:' + a, ROUTES[1]);
    // Object a is verzonden DOOR a, maar alleen zichtbaar VOOR de andere vriend.
    const eigen = p.objecten[a === 'a' ? 'b' : 'a'];
    if (!lijst || lijst.actor !== a || !ok(lijst.status) || !gelijk(lijst.voor, lijst.na)) return open('eigen lijstcontrole ontbreekt');
    if (!gelijk(lijst.antwoord, { snaps: [{ id: eigen.id, tekst: eigen.tekst, van: eigen.van, at: eigen.opslag.at }] })) return stuk('lijst mist eigen snap of bevat vreemde inhoud');
    const kijk = pak('view:' + a, ROUTES[2]);
    if (!kijk || kijk.actor !== a || kijk.doel !== eigen.id || !ok(kijk.status)) return open('eigen ontvanger kon snap niet openen');
    if (!gelijk(kijk.antwoord, { foto: eigen.foto, tekst: eigen.tekst, van: eigen.van })) return stuk('eigen ontvanger kreeg verkeerde inhoud');
    if (!gelijk(kijk.na.snaps, zonder(kijk.voor, eigen.id)) || kijk.voor.snaps.length !== kijk.na.snaps.length + 1 ||
        kijk.voor.media.length !== kijk.na.media.length + 1 || !gelijk(kijk.na.media, kijk.voor.media.filter(x => x !== eigen.media))) return stuk('openen verwijderde niet uitsluitend de eigen snap');
    const herhaal = pak('weigering:herhaal:' + a, ROUTES[2]);
    if (!herhaal || herhaal.actor !== a || herhaal.doel !== eigen.id || herhaal.status !== 404) return open('eenmalig openen niet bewezen');
  }
  const buiten = pak('lijst:c', ROUTES[1]);
  if (!buiten || buiten.actor !== 'c' || !ok(buiten.status) || !gelijk(buiten.voor, buiten.na)) return open('levende derde actor ontbreekt');
  if (!gelijk(buiten.antwoord, { snaps: [] })) return stuk('derde actor ziet snaps');
  const verwacht = [
    ['weigering:send:c', ROUTES[0], 'c', [403]],
    ['weigering:view:c', ROUTES[2], 'c', [404]],
    ['weigering:view:afzender', ROUTES[2], 'a', [404]],
    ...ROUTES.map((pad, i) => ['weigering:anoniem:' + i, pad, 'anoniem', [401, 403]])
  ];
  for (const [id, pad, actor, statussen] of verwacht) {
    const x = pak(id, pad);
    if (!x || x.actor !== actor || !statussen.includes(x.status) || x.lek || !gelijk(x.voor, x.na)) return open('expliciete negatieve controle ontbreekt: ' + id);
  }
  for (const id of ['weigering:view:c', 'weigering:view:afzender', 'weigering:anoniem:2']) {
    const x = stappen.get(id);
    if (x.doel !== p.objecten.a.id || !x.voor.snaps.some(s => s.id === x.doel)) return open('kruisproef gebruikte geen bestaand object van de ander');
  }
  if (stappen.get('weigering:send:c').doel !== p.actors[0]) return open('derde actor probeerde geen van de vrienden te bereiken');
  // Negatieve view moet vóór de legitieme consumptie plaatsvinden: anders
  // is 404 slechts bewijs van een al verdwenen object.
  const plaats = id => p.stappen.findIndex(x => x.id === id);
  if (plaats('weigering:view:c') > plaats('view:b') || plaats('weigering:view:afzender') > plaats('view:b') ||
      plaats('weigering:anoniem:2') > plaats('view:b')) return open('object ontbrak mogelijk bij de kruisproef');
  for (let i = 1; i < p.stappen.length; i++) if (!gelijk(p.stappen[i - 1].na, p.stappen[i].voor)) return open('opslaglijn onderbroken');
  if (!Array.isArray(p.sessies) || p.sessies.length !== 3 || !['a', 'b', 'c'].every(a =>
      p.sessies.filter(x => x?.actor === a && ['voor', 'na'].every(k => ok(x[k]?.status) &&
        x[k].me === p.actors[['a', 'b', 'c'].indexOf(a)] && x[k].codenaam === p.codenamen[['a', 'b', 'c'].indexOf(a)])).length === 1)) return open('sessies niet voor en na geijkt');
  return { stand: 'gemeten', reden: 'drie HTTP-snaproutes met echte vriendschap, eigen ontvangers, derde actor, anoniem, inhoud en opslag; geïsoleerde SQLite-proef, geen productie/concurrencykwalificatie' };
}
module.exports = { ROUTES, oordeel, antwoordVan, voegToe };
