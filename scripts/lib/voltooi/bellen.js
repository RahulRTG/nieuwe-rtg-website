/* ============================================================================
   VOLTOOIPROEF: BELLEN (os:bellen) -- een spraakoproep tussen twee verbonden
   leden in de ledenapp.

   DE ROUTE (LivingOS-B, 19 oktober 2026). Bellen heeft geen tegel: de werktafel
   is het beginscherm (WERELD.md). Een lid vraagt het Rahul: "Praat met Rahul" in
   de rand, "open bellen", en de functiegids opent de kiezer met Salon-contacten
   (app-main-26.js); een tik op een contact belt (RTGSocial.bel in app-main-10.js),
   en de live-verbinding geeft de signalen door (app-main-11.js).

   WAT DEZE PROEF MEET. De server is een doorgeefluik (/api/member/call naar de
   live-stroom van de ander, routes/social/leden.js); er wordt van een gesprek
   NIETS bewaard. De proef luistert daarom met een echte live-verbinding per lid
   (/api/stroom/ticket en /api/stream, zoals shared/stroom.js) en eist dat elk
   signaal ongeschonden en alleen bij de bedoelde ander aankomt. Het geluid zelf
   loopt rechtstreeks tussen de toestellen (WebRTC); dat de media in een echte
   browser aankomt, meet test/videobellen-echt.e2e.js voor videobellen.
   ========================================================================== */
'use strict';
const { geverifieerdLid, nieuwLid, verbind, KANTOORWERELD } = require('../voltooiwereld');

const BEL = '/api/member/call';
const TICKET = '/api/stroom/ticket';
const BLOK = '/api/member/block';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
async function totDat(fn, ms) { const eind = Date.now() + (ms || 4000); while (Date.now() < eind) { if (fn()) return true; await wacht(50); } return !!fn(); }

/* Een live-verbinding zoals het scherm hem opent: sessie in de kop ruilen voor
   een ticket, daarna /api/stream?ticket=. Geeft de ontvangen oproepsignalen. */
async function luister(w, tok) {
  const t = (await w.post(TICKET, { stroom: 'lid' }, tok)).data || {};
  const ac = new AbortController(), ev = [];
  const r = await fetch(w.basis + '/api/stream?ticket=' + encodeURIComponent(t.ticket || ''), { signal: ac.signal }).catch(() => ({ status: 0 }));
  if (r.body) (async () => {
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
    try {
      for (;;) {
        const { value, done } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true }); let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const blok = buf.slice(0, i); buf = buf.slice(i + 2);
          const e = (blok.match(/^event: (.*)$/m) || [])[1], d = (blok.match(/^data: (.*)$/m) || [])[1];
          if (e === 'call' && d) ev.push(JSON.parse(d));
        }
      }
    } catch (e) { /* afgebroken bij stop() */ }
  })();
  await wacht(150);
  return { status: r.status, oproepen: () => ev.slice(), stop: () => ac.abort() };
}

async function loop(w, stap) {
  const merk = 'bl' + Date.now().toString(36);
  const A = await geverifieerdLid(w, 'bla'), B = await geverifieerdLid(w, 'blb');
  const C = await geverifieerdLid(w, 'blc'), E = await geverifieerdLid(w, 'ble');
  const G = await nieuwLid(w, 'blg', 'guest');
  const ab = await verbind(w, A, B), ae = await verbind(w, A, E);
  const sdp = 'v=0 rtg-bel-' + merk;
  let lb, la, lc;
  const van = (l, kind) => l.oproepen().filter((x) => x.kind === kind);
  const opnieuw = async () => { for (const l of [la, lb, lc]) if (l) l.stop(); la = await luister(w, A.token); lb = await luister(w, B.token); lc = await luister(w, C.token); };

  await stap('voltooibaar', 'A belt B met spraak: bij B gaat het over, met de codenaam van A en zonder beeld', async () => {
    await opnieuw();
    const r = await w.post(BEL, { toKey: ab.b.key, kind: 'ring', video: false }, A.token);
    await totDat(() => van(lb, 'ring').length);
    const ring = van(lb, 'ring')[0] || {};
    return { klopt: lb.status === 200 && r.status === 200 && ring.from === ab.a.key && ring.codename === ab.a.codenaam && ring.video === false,
      ziet: 'stroom ' + lb.status + ', bellen ' + r.status + ', bij B: ' + JSON.stringify(ring).slice(0, 120) };
  });

  await stap('voltooibaar', 'B neemt op; aanbod, antwoord en ice komen ongeschonden aan de andere kant aan', async () => {
    await w.post(BEL, { toKey: ab.a.key, kind: 'accept' }, B.token);
    await w.post(BEL, { toKey: ab.b.key, kind: 'offer', payload: { type: 'offer', sdp } }, A.token);
    await w.post(BEL, { toKey: ab.a.key, kind: 'answer', payload: { type: 'answer', sdp: sdp + '-b' } }, B.token);
    await w.post(BEL, { toKey: ab.b.key, kind: 'ice', payload: { candidate: 'candidate:1 ' + merk } }, A.token);
    await totDat(() => van(lb, 'ice').length && van(la, 'answer').length);
    const ok = van(la, 'accept').length === 1 && (van(lb, 'offer')[0] || {}).payload && van(lb, 'offer')[0].payload.sdp === sdp
      && van(la, 'answer')[0].payload.sdp === sdp + '-b' && van(lb, 'ice')[0].payload.candidate === 'candidate:1 ' + merk;
    return { klopt: !!ok, ziet: 'bij A: accept ' + van(la, 'accept').length + ', answer ' + van(la, 'answer').length + '; bij B: offer ' + van(lb, 'offer').length + ', ice ' + van(lb, 'ice').length };
  });

  await stap('voltooibaar', 'ophangen beeindigt het gesprek bij de ander, en een nieuwe oproep weigeren zegt de beller dat', async () => {
    await w.post(BEL, { toKey: ab.b.key, kind: 'hangup' }, A.token);
    await w.post(BEL, { toKey: ab.b.key, kind: 'ring', video: false }, A.token);
    await w.post(BEL, { toKey: ab.a.key, kind: 'decline' }, B.token);
    await totDat(() => van(lb, 'hangup').length && van(la, 'decline').length);
    return { klopt: van(lb, 'hangup').length === 1 && van(la, 'decline').length === 1, ziet: 'ophangen bij B ' + van(lb, 'hangup').length + ', weigering bij A ' + van(la, 'decline').length };
  });

  await stap('bevoegd', 'bevoegdheid: zonder sessie geen oproep en geen live-verbinding (401)', async () => {
    const r = await w.post(BEL, { toKey: ab.b.key, kind: 'ring' });
    const t = await w.post(TICKET, { stroom: 'lid' });
    return { klopt: r.status === 401 && t.status === 401, ziet: 'bellen ' + r.status + ', stroomticket ' + t.status };
  });

  await stap('bevoegd', 'bevoegdheid: een onverbonden lid belt B niet, en een derde hoort niets van het gesprek van A en B', async () => {
    const voor = lb.oproepen().length;
    const r = await w.post(BEL, { toKey: ab.b.key, kind: 'ring' }, C.token);
    await wacht(400);
    return { klopt: r.status === 403 && /niet verbonden/.test(r.data.error) && lb.oproepen().length === voor && lc.oproepen().length === 0,
      ziet: 'C belt B: ' + r.status + ' "' + (r.data && r.data.error) + '", bij B ' + (lb.oproepen().length - voor) + ' nieuw, C hoorde ' + lc.oproepen().length + ' signalen' };
  });

  await stap('bevoegd', 'bevoegdheid: wie A blokkeerde wordt niet meer door A gebeld, en een gratis account belt niet', async () => {
    const b = await w.post(BLOK, { key: ae.a.key }, E.token);
    const r = await w.post(BEL, { toKey: ae.b.key, kind: 'ring' }, A.token);
    const g = await w.post(BEL, { toKey: ab.b.key, kind: 'ring' }, G.token);
    return { klopt: b.status === 200 && r.status === 403 && /niet beschikbaar/.test(r.data.error) && g.status === 403,
      ziet: 'blokkeren ' + b.status + ', A belt E ' + r.status + ' "' + (r.data && r.data.error) + '", gratis ' + g.status };
  });

  /* ---------------- persistent ---------------- */
  for (const l of [la, lb, lc]) l.stop();
  await w.herstart();
  await opnieuw();
  await stap('persistent', 'na een nette herstart kunnen A en B elkaar nog bellen: de verbinding staat er nog', async () => {
    const r = await w.post(BEL, { toKey: ab.b.key, kind: 'ring', video: false }, A.token);
    await totDat(() => van(lb, 'ring').length);
    return { klopt: r.status === 200 && van(lb, 'ring').length === 1, ziet: 'bellen ' + r.status + ', bij B ' + van(lb, 'ring').length + ' oproep' };
  });
  await stap('persistent', 'na de herstart belt het onverbonden lid nog steeds niet, en de blokkade houdt', async () => {
    const c = await w.post(BEL, { toKey: ab.b.key, kind: 'ring' }, C.token);
    const e = await w.post(BEL, { toKey: ae.b.key, kind: 'ring' }, A.token);
    return { klopt: c.status === 403 && e.status === 403, ziet: 'C belt B ' + c.status + ', A belt E ' + e.status };
  });
  await stap('persistent', 'van een gesprek wordt niets bewaard: de inhoud van aanbod en antwoord staat nergens in de opslag', async () => {
    const v = w.vindInOpslag('rtg-bel-' + merk);
    return { klopt: v.length === 0, ziet: v.length ? 'gevonden in ' + v.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') : 'nergens gevonden' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op bellen: geen fout, en bij B komt alleen A binnen (het toestel toont een oproep per beller)', async () => {
    const voor = van(lb, 'ring').length;
    const [x, y] = await w.dubbel(BEL, { toKey: ab.b.key, kind: 'ring', video: false }, A.token);
    await totDat(() => van(lb, 'ring').length >= voor + 2);
    const nieuw = van(lb, 'ring').slice(voor);
    return { klopt: geen5xx(x) && geen5xx(y) && nieuw.length >= 1 && nieuw.every((z) => z.from === ab.a.key), ziet: 'antwoorden ' + x.status + '/' + y.status + ', bij B ' + nieuw.length + ' signaal/signalen van A' };
  });
  await stap('herstelbaar', 'een afgebroken ophangen, daarna opnieuw: het gesprek eindigt bij B, zonder fout', async () => {
    const half = await w.afgebroken(BEL, { toKey: ab.b.key, kind: 'hangup' }, A.token);
    const r = await w.post(BEL, { toKey: ab.b.key, kind: 'hangup' }, A.token);
    await totDat(() => van(lb, 'hangup').length >= 1);
    return { klopt: r.status === 200 && van(lb, 'hangup').length >= 1, ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + r.status + ', ophangen bij B ' + van(lb, 'hangup').length };
  });
  await stap('herstelbaar', 'een crash midden in een gesprek: na het opstarten belt er geen spookoproep na, en een nieuwe oproep komt gewoon aan', async () => {
    await w.post(BEL, { toKey: ab.b.key, kind: 'ring', video: false }, A.token);
    for (const l of [la, lb, lc]) l.stop();
    await w.crash();
    await opnieuw();
    await wacht(400);
    const spook = lb.oproepen().length;
    const r = await w.post(BEL, { toKey: ab.b.key, kind: 'ring', video: false }, A.token);
    await totDat(() => van(lb, 'ring').length);
    return { klopt: spook === 0 && r.status === 200 && van(lb, 'ring').length === 1, ziet: 'na SIGKILL ' + spook + ' oude signalen bij B, nieuwe oproep ' + r.status + ', bij B ' + van(lb, 'ring').length };
  });
  for (const l of [la, lb, lc]) l.stop();
}

module.exports = {
  functie: 'os:bellen',
  ingang: '/apps/app.html',
  via: 'de rand "Praat met Rahul", dan "open bellen": de functiegids opent de kiezer met Salon-contacten, en een tik op een contact belt',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een lid belt een verbonden lid met spraak: het gaat over bij de ander, opnemen, ophangen en weigeren komen aan, niemand anders hoort iets, een onverbonden of geblokkeerd lid belt niet, en van het gesprek wordt niets bewaard',
  grens: 'De proef loopt de signalering van het scherm (/api/member/call en de live-stroom), niet het scherm zelf en niet het geluid: dat loopt rechtstreeks tussen de toestellen; de media in een echte browser meet test/videobellen-echt.e2e.js voor videobellen. Een dubbel signaal komt twee keer aan; dat het toestel er een oproep van maakt, staat in app-main-10.js en wordt hier niet gelopen. Geen TURN, geen Redis of PostgreSQL.',
  loop
};
