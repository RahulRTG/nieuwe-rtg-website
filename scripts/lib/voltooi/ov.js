/* ============================================================================
   VOLTOOIPROEF: RTG OV (link:ov, /apps/ov.html) -- het vervoerbewijs.

   De belofte, in de woorden van het scherm: "De vervoerder verkoopt deze
   bewijzen via RTG." Een lid koopt een kaartje voor een lijn, betaalt uit zijn
   wallet (met autolaad als het saldo tekortschiet), toont het als code, en de
   controleur van de vervoerder ziet het als geldig -- een keer, want een enkele
   reis is een rit.

   DRIE PARTIJEN, EN GEEN VAN HEN IS EEN VLAG. De verkoop bestaat alleen als RTG
   een overeenkomst met de vervoerder heeft vastgelegd en de module voor die
   vervoerder aanzet (kern/mobiliteit/overeenkomst.js: "dat besluit je niet
   zelf"). Dat doet hier het kantoor langs zijn eigen routes, met het
   eigenaarsaccount van de kantoorwereld. De vervoerder is Ibiza Transit uit
   de demostand; zijn medewerker logt in langs de echte zaakdeur.

   DE BANK IS DE SIMULATIEBANK, en de afloop wordt GEKOZEN, niet gegokt: de
   autolaad draagt de herhaalsleutel `kaartlaad:<idem>` (kern/mobiliteit/
   kaartje.js) en de simulatiebank leidt zijn afloop af uit het betaling-id
   (zie ./pay.js voor dezelfde afleiding).
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const { nieuwLid, geverifieerdLid, inloggen, eigenaarSessie, KANTOORWERELD } = require('../voltooiwereld');
const simulatiebank = require('../../../server/betaal/synthetisch');

const AANBOD = '/api/mob/kaart/aanbod';
const KOOP = '/api/mob/kaart/koop';
const MIJN = '/api/mob/kaart/mijn';
const TOON = '/api/mob/kaart/toon';
const CONTROLE = '/api/staff/mob/kaart/controle';
const VERVOERDER = 'TRANSIT';

const bank = simulatiebank({ crypto, env: {}, echteRail: null });
const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const dag = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const geen5xx = (r) => r && r.status > 0 && r.status < 500;

/* Een herhaalsleutel waarmee de autolaad bij de simulatiebank deze afloop
   krijgt. Zelfde afleiding als kern/pay/opladen.js en kern/betaalwaarheid. */
function idemVoor(codenaam, afloop, merk) {
  for (let i = 0; i < 10000; i++) {
    const idem = 'vp-ov-' + merk + '-' + i;
    const laad = 'kaartlaad:' + idem;
    const id = 'BW-' + sha('pay:' + codenaam + '|pay-oplaad:' + codenaam + ':' + laad).slice(0, 20).toUpperCase();
    if (bank.scenarioVan({ idempotentieSleutel: 'waarheid:' + id }) === afloop) return idem;
  }
  throw new Error('geen herhaalsleutel gevonden die "' + afloop + '" geeft');
}

async function zaakSessie(w, code) {
  const rooster = await w.post('/api/supplier/roster', { code });
  const man = ((rooster.data && rooster.data.staff) || []).find((x) => x.role === 'manager');
  if (!man) throw new Error('de vervoerder ' + code + ' heeft geen manager in het rooster');
  const z = await w.post('/api/supplier/login', { code, staffId: man.id, pin: '1234' });
  if (!z.data || !z.data.token) throw new Error('de manager van ' + code + ' kon niet inloggen (' + z.status + ')');
  return z.data.token;
}

async function loop(w, stap) {
  /* gekeurd: een kaartje kopen vraagt eenmalig het paspoort (payGate, besluit 19 oktober 2026) */
  const lid = await geverifieerdLid(w, 'ova');
  const B = await nieuwLid(w, 'ovb');
  let T = lid.token;
  const codenaam = ((((await w.post('/api/member/connections', {}, T)).data) || {}).codename);
  const kaartjes = async (tok) => ((((await w.post(MIJN, {}, tok || T)).data) || {}).kaartjes || []);
  let aanbod = null, kaartje = null, Z = null;
  const lijfVoor = (idem) => ({ vervoerder: VERVOERDER, lijnId: aanbod.lijnId, product: 'enkel',
    van: aanbod.haltes[0].id, naar: aanbod.haltes[aanbod.haltes.length - 1].id, idem });

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'zonder overeenkomst met de vervoerder is er niets te koop, en het scherm zegt waarom', async () => {
    const a = await w.post(AANBOD, { vervoerder: VERVOERDER }, T);
    return { klopt: a.status === 200 && a.data.aanbod.length === 0 && !!a.data.reden,
      ziet: a.status + ', ' + a.data.aanbod.length + ' producten, reden: ' + a.data.reden };
  });

  await stap('voltooibaar', 'het kantoor legt de overeenkomst vast en zet de kaartverkoop voor deze vervoerder aan; dan staat het aanbod er', async () => {
    const K = await eigenaarSessie(w);
    const o = await w.post('/api/office/mob/overeenkomst', { vervoerder: VERVOERDER, van: dag(-1), tot: dag(300),
      producten: ['enkel', 'retour', 'dagkaart'], lijnen: ['L1'], getekendDoor: 'Directie Ibiza Transit' }, K);
    const zet = [];
    for (const id of ['partner_contracts', 'public_transport_ticketing']) {
      zet.push(await w.post('/api/office/mob/module/zet', { id, aan: true, niveau: 'vervoerder', vervoerder: VERVOERDER }, K));
    }
    const a = await w.post(AANBOD, { vervoerder: VERVOERDER }, T);
    aanbod = (a.data.aanbod || []).find((x) => x.product === 'enkel');
    return { klopt: o.status === 200 && o.data.overeenkomst.geldigNu === true && zet.every((x) => x.status === 200) && !!aanbod && aanbod.haltes.length >= 2,
      ziet: 'overeenkomst ' + o.status + ', modules ' + zet.map((x) => x.status).join('/') + ', aanbod ' + (a.data.aanbod || []).length + ' producten op ' + (aanbod && aanbod.lijnNaam) };
  });

  await stap('voltooibaar', 'de bank weigert de autolaad: het lid hoort het, er is geen kaartje en niets afgeschreven', async () => {
    const r = await w.post(KOOP, lijfVoor(idemVoor(codenaam, 'geweigerd', 'nee')), T);
    const k = await kaartjes();
    return { klopt: r.status === 402 && /niet gelukt/.test(r.data.error || '') && k.length === 0,
      ziet: r.status + ' (' + (r.data && r.data.error || '').slice(0, 80) + '), ' + k.length + ' kaartjes' };
  });

  await stap('voltooibaar', 'het lid koopt een enkele reis; de bank betaalt de autolaad en het kaartje staat geldig in zijn app', async () => {
    const r = await w.post(KOOP, lijfVoor(idemVoor(codenaam, 'betaald', 'ok')), T);
    kaartje = r.data && r.data.kaartje;
    const k = await kaartjes();
    return { klopt: r.status === 200 && !!kaartje && kaartje.stand === 'geldig' && kaartje.prijs > 0 && k.length === 1 && k[0].id === kaartje.id,
      ziet: r.status + (r.data && r.data.error ? ' (' + r.data.error + ')' : '') + ', ' + (kaartje ? kaartje.productNaam + ' ' + kaartje.van.naam + ' - ' + kaartje.naar.naam + ' voor ' + kaartje.prijs + ' cent' : 'GEEN KAARTJE') };
  });

  let code = null;
  await stap('voltooibaar', 'het lid toont het kaartje; de controleur van de vervoerder ziet het als geldig', async () => {
    const t = await w.post(TOON, { id: kaartje.id }, T);
    code = t.data && t.data.code;
    Z = await zaakSessie(w, VERVOERDER);
    const c = await w.post(CONTROLE, { code, lijnId: aanbod.lijnId }, Z);
    return { klopt: t.status === 200 && !!code && c.status === 200 && c.data.geldig === true,
      ziet: 'tonen ' + t.status + ', controle ' + c.status + ' (geldig ' + (c.data && c.data.geldig) + ')' };
  });

  await stap('voltooibaar', 'dezelfde code nog eens scannen: een enkele reis is een rit, en de controleur hoort waarom niet', async () => {
    const c = await w.post(CONTROLE, { code, lijnId: aanbod.lijnId }, Z);
    return { klopt: c.status >= 400 && c.status < 500 && c.data.geldig === false && !!c.data.error,
      ziet: c.status + ' (' + (c.data && c.data.error) + ')' };
  });

  await stap('voltooibaar', 'een ander lid ziet het kaartje niet en kan het niet tonen', async () => {
    const k = await kaartjes(B.token);
    const t = await w.post(TOON, { id: kaartje.id }, B.token);
    return { klopt: k.length === 0 && t.status >= 400 && t.status < 500 && !t.data.code,
      ziet: 'B heeft ' + k.length + ' kaartjes, tonen ' + t.status + ' (' + (t.data && t.data.error) + ')' };
  });

  await stap('voltooibaar', 'een gratis account (gast) krijgt een dichte deur met de reden', async () => {
    const G = await nieuwLid(w, 'ovg', 'guest');
    const r = await w.post(AANBOD, { vervoerder: VERVOERDER }, G.token);
    return { klopt: r.status === 403 && /voor leden/.test(r.data.error), ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  /* ---------------- persistent ---------------- */
  const voor = JSON.stringify(await kaartjes());
  await w.herstart();

  await stap('persistent', 'na een nette herstart staat het kaartje er nog, gelijk -- ook dat de rit gebruikt is', async () => {
    const na = JSON.stringify(await kaartjes());
    return { klopt: voor.length > 2 && na === voor, ziet: na === voor ? 'gelijk (' + na.length + ' tekens)' : 'ANDERS: ' + na.slice(0, 120) };
  });

  await stap('persistent', 'een nieuwe sessie (een ander toestel) ziet hetzelfde kaartje, en het aanbod staat er nog', async () => {
    T = await inloggen(w, lid);
    const na = JSON.stringify(await kaartjes());
    const a = await w.post(AANBOD, { vervoerder: VERVOERDER }, T);
    return { klopt: na === voor && (a.data.aanbod || []).length >= 1, ziet: (na === voor ? 'gelijk' : 'ANDERS') + ', aanbod ' + (a.data.aanbod || []).length };
  });

  await stap('persistent', 'het kaartje en de overeenkomst staan in de opslag, en de getoonde code staat er niet kaal in', async () => {
    const k = w.vindInOpslag(kaartje.id).map((p) => p.sleutel || p.tabel);
    const rauw = w.vindInOpslag(code);
    const ok = (w.collectie('mobOvereenkomsten') || []).filter((o) => o.vervoerder === VERVOERDER);
    return { klopt: k.length >= 1 && rauw.length === 0 && ok.length === 1,
      ziet: 'kaartje in ' + [...new Set(k)].join(', ') + '; kale code in ' + rauw.length + ' plek(ken); ' + ok.length + ' overeenkomst' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op "kopen" met dezelfde herhaalsleutel: een kaartje, een keer betaald', async () => {
    const voorN = (await kaartjes()).length;
    const [a, b] = await w.dubbel(KOOP, lijfVoor(idemVoor(codenaam, 'betaald', 'dubbel')), T);
    const na = await kaartjes();
    const ids = new Set([a, b].filter((x) => x.status === 200).map((x) => x.data.kaartje.id));
    return { klopt: geen5xx(a) && geen5xx(b) && ids.size === 1 && na.length === voorN + 1,
      ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + ids.size + ' kaartje-id, ' + (na.length - voorN) + ' nieuw' };
  });

  await stap('herstelbaar', 'een afgebroken aankoop en opnieuw met dezelfde sleutel: precies een kaartje erbij', async () => {
    const voorN = (await kaartjes()).length;
    const idem = idemVoor(codenaam, 'betaald', 'half');
    const half = await w.afgebroken(KOOP, lijfVoor(idem), T);
    const opnieuw = await w.post(KOOP, lijfVoor(idem), T);
    const na = await kaartjes();
    return { klopt: opnieuw.status === 200 && na.length === voorN + 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + (na.length - voorN) + ' nieuw' };
  });

  await stap('herstelbaar', 'een crash direct na de aankoop: het kaartje staat er, en opnieuw kopen met dezelfde sleutel geeft hetzelfde kaartje', async () => {
    const idem = idemVoor(codenaam, 'betaald', 'crash');
    const r = await w.post(KOOP, lijfVoor(idem), T);
    await w.crash();
    const na = await kaartjes();
    const opnieuw = await w.post(KOOP, lijfVoor(idem), T);
    const daarna = await kaartjes();
    const id = r.data && r.data.kaartje && r.data.kaartje.id;
    return { klopt: r.status === 200 && na.some((k) => k.id === id) && opnieuw.status === 200 && opnieuw.data.kaartje.id === id && daarna.length === na.length,
      ziet: 'kopen ' + r.status + ', na SIGKILL ' + (na.some((k) => k.id === id) ? 'aanwezig' : 'WEG') + ', opnieuw ' + opnieuw.status + (opnieuw.data && opnieuw.data.error ? ' (' + opnieuw.data.error + ')' : '') + (opnieuw.data && opnieuw.data.kaartje && opnieuw.data.kaartje.id === id ? ' (zelfde kaartje)' : ' (ANDER kaartje)') };
  });
}

module.exports = {
  functie: 'link:ov',
  ingang: '/apps/ov.html',
  persona: 'lid',
  omgeving: Object.assign({ RTG_SIMULATIEBANK: '1' }, KANTOORWERELD),
  belofte: 'een lid koopt bij een vervoerder waarmee RTG een overeenkomst heeft een kaartje uit zijn wallet, toont het, en de controleur ziet het een keer als geldig; weigert de bank, dan is er geen kaartje -- ook na een herstart, een dubbele tik, een afgebroken verzoek en een crash',
  grens: 'De proef loopt de vervoerbewijsroutes van het scherm, niet het scherm zelf. Inchecken in een voertuig (/api/ov/code, /uit), de multimodale reis, het abonnement en de bedrijfspendel zijn niet gelopen. De rail is de simulatiebank; de vervoerder is Ibiza Transit uit de demostand. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
