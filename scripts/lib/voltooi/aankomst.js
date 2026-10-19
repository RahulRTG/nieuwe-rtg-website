/* ============================================================================
   VOLTOOIPROEF: INVISIBLE ARRIVAL (link:aankomst, /apps/arrival.html).

   De belofte, in de woorden van het scherm en routes/supplier/horeca/
   invisible-arrival.js: "een wens, dezelfde bestaande reservering, plus een
   tijdelijke pass en verifieerbare beloften". De gast typt zijn wens, ziet het
   plan dat eruit is gelezen ("er is nog niets aangevraagd"), vraagt aan bij de
   zaak met een eenmalige aanvraagcode, en houdt een tijdelijke pass over
   waarmee hij -- vrijwillig, zonder GPS -- deelt dat hij onderweg is.

   TWEE KANTEN. Het lid is ingelogd (besluit van 19 oktober 2026: iedereen met
   minimaal een gratis account); de pass is een tweede sleutel naast die sessie. De
   ZAAK ziet de aankomst in haar eigen app (/api/supplier/horeca/arrivals) en
   bevestigt de beloften persoonlijk; pas als alles bevestigd is, staat de
   pass op "bevestigd". Een tweede zaak ziet er niets van. De zaken zijn
   synthetische leveranciers uit de seed van de testomgeving, met een eigen
   medewerker die inlogt langs de echte zaakdeur.

   DE REM telt aanvragen per IP (acht per kwartier, in het geheugen). De proef
   blijft daar per serverleven onder; een herstart begint de telling opnieuw.
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const { nieuwLid, inloggen, KANTOORWERELD } = require('../voltooiwereld');

const INTERPRET = '/api/arrival/interpret';
const AANVRAAG = '/api/arrival/request';
const PAS = '/api/arrival/pass';
const PULS = '/api/arrival/pulse';
const ZAAK_LIJST = '/api/supplier/horeca/arrivals';
const ZAAK_BELOFTE = '/api/supplier/horeca/arrival/promise';

const dag = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const aanvraagcode = () => crypto.randomBytes(16).toString('hex');
const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function zaakSessie(w, code) {
  const rooster = await w.post('/api/supplier/roster', { code });
  const man = ((rooster.data && rooster.data.staff) || []).find((x) => x.role === 'manager');
  if (!man) throw new Error('de zaak ' + code + ' heeft geen manager in het rooster');
  const z = await w.post('/api/supplier/login', { code, staffId: man.id, pin: '1234' });
  if (!z.data || !z.data.token) throw new Error('de manager van ' + code + ' kon niet inloggen (' + z.status + ')');
  return z.data.token;
}

async function loop(w, stap) {
  /* De zaakcode typt de gast over van de zaak; de proef haalt er twee uit de
     restaurantlijst van een lid, zoals een mens hem van de kaart van de zaak
     overneemt. */
  const kenner = await nieuwLid(w, 'iaz');
  const restaurants = (((await w.post('/api/foodcourt', {}, kenner.token)).data) || {}).restaurants || [];
  if (restaurants.length < 2) throw new Error('de testwereld heeft geen twee restaurants (' + restaurants.length + ')');
  const zaak = restaurants[0].code;
  /* De tweede zaak: de eerste andere met een manager in het rooster. */
  let ander = null, Z2 = null;
  for (const r of restaurants.slice(1)) { try { Z2 = await zaakSessie(w, r.code); ander = r.code; break; } catch (e) { /* volgende */ } }
  if (!Z2) throw new Error('de testwereld heeft geen tweede zaak met een manager');
  const A = await nieuwLid(w, 'iaa');
  const B = await nieuwLid(w, 'iab');
  let T = A.token;
  let plan = null, pas = null, Z = null;
  const lijstBij = async (tok) => (((await w.post(ZAAK_LIJST, {}, tok)).data) || {}).arrivals || [];
  const vraag = (code, d) => w.post(AANVRAAG, Object.assign({ requestToken: code, supplierCode: zaak,
    zone: 'zaal', toegankelijk: false, allergie: false }, d), T);

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'het lid typt zijn wens en ziet het plan dat eruit is gelezen -- er is nog niets aangevraagd', async () => {
    const r = await w.post(INTERPRET, { tekst: dag(4) + ' om 19:30 met 4 personen, allergie voor noten, verjaardag' }, T);
    plan = r.data && r.data.plan;
    return { klopt: r.status === 200 && !!plan && plan.datum === dag(4) && plan.tijd === '19:30' && plan.personen === 4 &&
      plan.allergie === true && plan.gelegenheid === 'verjaardag' && /nog niets aangevraagd/.test(r.data.let),
      ziet: r.status + ', plan ' + (plan && [plan.datum, plan.tijd, plan.personen + 'p', plan.allergie ? 'allergie' : '', plan.gelegenheid].join(' ')) };
  });

  await stap('voltooibaar', 'een aanvraag voor gisteren wordt geweigerd met de reden, en er ontstaat geen pass', async () => {
    const r = await vraag(aanvraagcode(), { datum: dag(-1), tijd: '19:30', personen: 2 });
    return { klopt: r.status === 400 && /datum en tijd/.test((r.data && r.data.error) || '') && !(r.data && r.data.pass),
      ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  await stap('voltooibaar', 'het lid vraagt aan bij de zaak; hij krijgt een tijdelijke pass met een voorgestelde tafel en open beloften', async () => {
    const r = await vraag(aanvraagcode(), { datum: plan.datum, tijd: plan.tijd, personen: plan.personen,
      allergie: true, gelegenheid: plan.gelegenheid });
    pas = r.data && r.data.pass;
    const b = (pas && pas.beloften || []).map((x) => x.id + '=' + x.status);
    return { klopt: r.status === 200 && !!pas && !!pas.accessToken && pas.status === 'aangevraagd' && !!pas.tafel &&
      b.includes('allergie=wacht-op-mens') && b.includes('moment=wacht-op-zaak'),
      ziet: r.status + (r.data && r.data.error ? ' (' + r.data.error + ')' : '') + ', ' + (pas ? pas.zaak.naam + ' ' + pas.tafel + ', beloften: ' + b.join(', ') : 'GEEN PASS') };
  });

  await stap('voltooibaar', 'met zijn pass leest het lid zijn aankomst terug', async () => {
    const r = await w.post(PAS, { pass: pas.accessToken }, T);
    return { klopt: r.status === 200 && r.data.pass.id === pas.id && r.data.pass.reserveringId === pas.reserveringId,
      ziet: r.status + ', ' + (r.data && r.data.pass && r.data.pass.status) };
  });

  await stap('voltooibaar', 'zonder inlog komt niemand binnen: wens, aanvraag en pass geven een 401', async () => {
    const i = await w.post(INTERPRET, { tekst: 'morgen om 20:00 met 2' });
    const a = await w.post(AANVRAAG, { requestToken: aanvraagcode(), supplierCode: zaak, datum: dag(4), tijd: '21:00', personen: 2 });
    const p = await w.post(PAS, { pass: pas.accessToken });
    return { klopt: i.status === 401 && a.status === 401 && p.status === 401 && !(p.data && p.data.pass),
      ziet: 'wens ' + i.status + ', aanvraag ' + a.status + ', pass ' + p.status + ' (' + (p.data && p.data.error) + ')' };
  });

  await stap('voltooibaar', 'een ander lid met de pass van dit lid komt er niet in: lezen, een status delen en roteren geven een 404', async () => {
    const l = await w.post(PAS, { pass: pas.accessToken }, B.token);
    const p = await w.post(PULS, { pass: pas.accessToken, pulse: 'onderweg' }, B.token);
    const r = await w.post('/api/arrival/pass/roteer', { pass: pas.accessToken }, B.token);
    const nog = await w.post(PAS, { pass: pas.accessToken }, T);
    return { klopt: l.status === 404 && p.status === 404 && r.status === 404 && !r.data.accessToken && nog.status === 200 && nog.data.pass.pulse !== 'onderweg',
      ziet: 'B leest ' + l.status + ', deelt ' + p.status + ', roteert ' + r.status + '; bij A nog ' + nog.status };
  });

  await stap('voltooibaar', 'de zaak ziet de aankomst in haar eigen app, met de wensen die persoonlijke controle vragen', async () => {
    Z = await zaakSessie(w, zaak);
    const a = (await lijstBij(Z)).find((x) => x.id === pas.id);
    return { klopt: !!a && a.wensen.allergie === true && a.status === 'aangevraagd' && !JSON.stringify(a).includes('Voltooilid'),
      ziet: a ? 'bij ' + zaak + ': ' + a.status + ', allergie ' + a.wensen.allergie : 'NIET BIJ DE ZAAK' };
  });

  await stap('voltooibaar', 'een andere zaak ziet deze aankomst niet en kan er geen belofte van bevestigen', async () => {
    const zichtbaar = (await lijstBij(Z2)).some((x) => x.id === pas.id);
    const p = await w.post(ZAAK_BELOFTE, { arrivalId: pas.id, id: 'allergie', akkoord: true }, Z2);
    const nog = await w.post(PAS, { pass: pas.accessToken }, T);
    const al = (nog.data && nog.data.pass.beloften || []).find((x) => x.id === 'allergie');
    return { klopt: !zichtbaar && p.status === 404 && !!al && al.status === 'wacht-op-mens',
      ziet: ander + ' ziet ' + (zichtbaar ? 'HEM WEL' : 'niets') + ', belofte ' + p.status + ', allergie bij de gast: ' + (al && al.status) };
  });

  await stap('voltooibaar', 'de zaak bevestigt elke open belofte persoonlijk; het lid ziet zijn pass op "bevestigd"', async () => {
    const open = pas.beloften.filter((x) => !['berekend', 'persoonlijk-bevestigd'].includes(x.status));
    const uit = [];
    for (const b of open) uit.push(await w.post(ZAAK_BELOFTE, { arrivalId: pas.id, id: b.id, akkoord: true, bewijs: 'Gecontroleerd met de keuken' }, Z));
    const r = await w.post(PAS, { pass: pas.accessToken }, T);
    return { klopt: uit.length >= 2 && uit.every((x) => x.status === 200) && r.status === 200 && r.data.pass.status === 'bevestigd',
      ziet: uit.length + ' beloften (' + uit.map((x) => x.status).join('/') + '), pass ' + (r.data && r.data.pass && r.data.pass.status) };
  });

  await stap('voltooibaar', 'het lid deelt dat hij onderweg is; zijn pass draagt die status, en een onbekende status wordt geweigerd', async () => {
    const p = await w.post(PULS, { pass: pas.accessToken, pulse: 'onderweg' }, T);
    const fout = await w.post(PULS, { pass: pas.accessToken, pulse: 'gps:52.37,4.89' }, T);
    return { klopt: p.status === 200 && p.data.pass.pulse === 'onderweg' && /geen GPS/.test(p.data.let) && fout.status === 400,
      ziet: 'puls ' + p.status + ' (' + (p.data && p.data.pass && p.data.pass.pulse) + '), onbekend ' + fout.status + ' (' + (fout.data && fout.data.error) + ')' };
  });

  /* ---------------- persistent ---------------- */
  const voor = JSON.stringify((await w.post(PAS, { pass: pas.accessToken }, T)).data.pass);
  await w.herstart();

  await stap('persistent', 'na een nette herstart leest dezelfde pass dezelfde aankomst, byte voor byte, ook in een nieuwe sessie van het lid', async () => {
    T = await inloggen(w, A);
    const r = await w.post(PAS, { pass: pas.accessToken }, T);
    const na = JSON.stringify(r.data && r.data.pass);
    return { klopt: r.status === 200 && na === voor, ziet: r.status + ', ' + (na === voor ? 'gelijk' : 'ANDERS: ' + String(na).slice(0, 80)) };
  });

  await stap('persistent', 'een nieuwe sessie van de zaak ziet de bevestigde aankomst met de status van de gast', async () => {
    const N = await zaakSessie(w, zaak);
    const a = (await lijstBij(N)).find((x) => x.id === pas.id);
    return { klopt: !!a && a.status === 'bevestigd' && a.pulse === 'onderweg', ziet: a ? a.status + ', ' + a.pulse : 'NIET BIJ DE ZAAK' };
  });

  await stap('persistent', 'de opslag draagt de aankomst en de reservering, en van de pass alleen een hash -- nooit de pass zelf', async () => {
    const plek = w.vindInOpslag(pas.id).map((p) => p.sleutel || p.tabel);
    const res = w.vindInOpslag(pas.reserveringId).map((p) => p.sleutel || p.tabel);
    const rauw = w.vindInOpslag(pas.accessToken);
    return { klopt: plek.length >= 2 && res.length >= 1 && rauw.length === 0,
      ziet: 'aankomst in ' + plek.join(', ') + '; reservering in ' + res.join(', ') + '; rauwe pass in ' + rauw.length + ' plek(ken)' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op "aanvragen" met dezelfde aanvraagcode: een aankomst bij de zaak, niet twee', async () => {
    const code = aanvraagcode();
    const [a, b] = await w.dubbel(AANVRAAG, { requestToken: code, supplierCode: zaak, datum: dag(5), tijd: '20:00', personen: 2, zone: 'zaal' }, T);
    const ids = new Set([a, b].filter((x) => x.status === 200).map((x) => x.data.pass.id));
    const bij = (await lijstBij(Z)).filter((x) => x.datum === dag(5) && x.tijd === '20:00');
    return { klopt: geen5xx(a) && geen5xx(b) && (a.status === 200 || b.status === 200) && ids.size === 1 && bij.length === 1,
      ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + ids.size + ' pass-id, ' + bij.length + ' aankomst bij de zaak' };
  });

  await stap('herstelbaar', 'een afgebroken aanvraag en opnieuw met dezelfde code: precies een aankomst, en de pass werkt', async () => {
    const lijf = { requestToken: aanvraagcode(), supplierCode: zaak, datum: dag(6), tijd: '19:00', personen: 2, zone: 'zaal' };
    const half = await w.afgebroken(AANVRAAG, lijf, T);
    const opnieuw = await w.post(AANVRAAG, lijf, T);
    const bij = (await lijstBij(Z)).filter((x) => x.datum === dag(6) && x.tijd === '19:00');
    const lees = opnieuw.status === 200 ? await w.post(PAS, { pass: opnieuw.data.pass.accessToken }, T) : { status: 0 };
    return { klopt: opnieuw.status === 200 && bij.length === 1 && lees.status === 200,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status +
        (opnieuw.data && opnieuw.data.idempotent ? ' (herhaald)' : '') + ', ' + bij.length + ' aankomst, pass ' + lees.status };
  });

  await stap('herstelbaar', 'een crash direct na het aanvragen: de pass die het lid kreeg, werkt na de herstart en de zaak ziet de aankomst', async () => {
    const r = await w.post(AANVRAAG, { requestToken: aanvraagcode(), supplierCode: zaak, datum: dag(7), tijd: '18:30', personen: 2, zone: 'zaal' }, T);
    await w.crash();
    const lees = r.status === 200 ? await w.post(PAS, { pass: r.data.pass.accessToken }, T) : { status: 0, data: null };
    const bij = (await lijstBij(await zaakSessie(w, zaak))).filter((x) => x.datum === dag(7) && x.tijd === '18:30');
    return { klopt: r.status === 200 && lees.status === 200 && bij.length === 1,
      ziet: 'aanvraag ' + r.status + ', na SIGKILL pass ' + lees.status + (lees.data && lees.data.error ? ' (' + lees.data.error + ')' : '') + ', ' + bij.length + ' aankomst bij de zaak' };
  });

  await stap('herstelbaar', 'een crash direct na een statuspuls: het lid en de zaak zien de nieuwe status', async () => {
    const p = await w.post(PULS, { pass: pas.accessToken, pulse: 'in-de-buurt' }, T);
    await w.crash();
    const r = await w.post(PAS, { pass: pas.accessToken }, T);
    const a = (await lijstBij(await zaakSessie(w, zaak))).find((x) => x.id === pas.id);
    return { klopt: p.status === 200 && r.status === 200 && r.data.pass.pulse === 'in-de-buurt' && !!a && a.pulse === 'in-de-buurt',
      ziet: 'puls ' + p.status + ', na SIGKILL gast ' + (r.data && r.data.pass && r.data.pass.pulse) + ', zaak ' + (a && a.pulse) };
  });
}

module.exports = {
  functie: 'link:aankomst',
  ingang: '/apps/arrival.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een ingelogd lid zet zijn wens om in een aanvraag bij de zaak, krijgt een tijdelijke pass met verifieerbare beloften die de zaak persoonlijk bevestigt, en deelt vrijwillig zijn aankomststatus -- ook na een herstart, een dubbele tik, een afgebroken verzoek en een crash',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf. De voorbereidingsmissie voor een ingeklokte host (bij "in de buurt") wordt niet nagekeken, en roteren en intrekken van de pass staan niet op dit scherm. Er wordt niets betaald en er is geen Redis of PostgreSQL in de wereld.',
  loop
};
