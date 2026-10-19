/* ============================================================================
   VOLTOOIPROEF: DE ROUTETEKENAAR (link:ovroutes, /apps/ovroutes.html).

   De belofte, in de woorden van het scherm: "Lijn bewaard; leden zien hem
   meteen in de OV-app." De manager van een OV-zaak tekent op zijn PDA een lijn
   met haltes, frequentie en tarief, en een lid ziet die lijn daarna op de
   OV-kaart. Weghalen haalt hem ook bij het lid weg.

   TWEE ACTOREN EN EEN GRENS. De manager van Ibiza Transit (uit de demostand)
   logt in langs de echte zaakdeur; het lid leest /api/ov/kaart. Een chauffeur
   van dezelfde zaak mag niet tekenen (alleen de manager), en een zaak die geen
   OV-vervoerder is evenmin.
   ========================================================================== */
'use strict';
const { nieuwLid, KANTOORWERELD } = require('../voltooiwereld');

const LIJNEN = '/api/staff/ov/lijnen';
const ZET = '/api/staff/ov/lijn/zet';
const KAART = '/api/ov/kaart';
const VERVOERDER = 'TRANSIT';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function login(w, code, manager) {
  const rooster = await w.post('/api/supplier/roster', { code });
  const wie = ((rooster.data && rooster.data.staff) || []).find((x) => manager ? x.role === 'manager' : x.role !== 'manager');
  if (!wie) throw new Error('de zaak ' + code + ' heeft geen ' + (manager ? 'manager' : 'medewerker') + ' in het rooster');
  const z = await w.post('/api/supplier/login', { code, staffId: wie.id, pin: manager ? '1234' : '5678' });
  if (!z.data || !z.data.token) throw new Error('inloggen bij ' + code + ' lukte niet (' + z.status + ')');
  return z.data.token;
}

async function loop(w, stap) {
  const merk = 'Lijn ' + Date.now().toString(36).slice(-5);
  let M = await login(w, VERVOERDER, true);
  const lid = await nieuwLid(w, 'ovr');
  const lijf = (naam, extra) => Object.assign({ naam, soort: 'tram', frequentieMin: 10,
    tarief: { basis: 200, perKm: 25 },
    haltes: [{ naam: 'Portal Nou', lat: 38.912, lng: 1.428 }, { naam: 'Figueretes', lat: 38.902, lng: 1.420 }, { naam: 'Platja d\'en Bossa', lat: 38.885, lng: 1.408 }] }, extra || {});
  const beheer = async (tok) => ((((await w.post(LIJNEN, {}, tok || M)).data) || {}).lijnen || []);
  const bijLid = async () => ((((await w.post(KAART, { lat: 38.91, lng: 1.43 }, lid.token)).data) || {}).lijnen || []);
  const metNaam = (lijst, naam) => lijst.filter((l) => l.naam === naam);
  let lijn = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'de manager opent de routetekenaar en ziet de lijnen van zijn zaak, met ijkpunten op de kaart', async () => {
    const r = await w.post(LIJNEN, {}, M);
    return { klopt: r.status === 200 && (r.data.lijnen || []).length >= 1 && (r.data.ijkpunten || []).length >= 1 && r.data.soorten.includes('tram'),
      ziet: r.status + ', ' + (r.data.lijnen || []).length + ' lijnen, ' + (r.data.ijkpunten || []).length + ' ijkpunten' };
  });

  await stap('voltooibaar', 'een lijn met een halte wordt geweigerd met de reden', async () => {
    const r = await w.post(ZET, lijf(merk + ' kort', { haltes: [{ naam: 'Alleen', lat: 38.91, lng: 1.43 }] }), M);
    return { klopt: r.status === 400 && /minstens twee haltes/.test(r.data.error), ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  await stap('voltooibaar', 'de manager tekent een tramlijn met drie haltes en bewaart hem', async () => {
    const r = await w.post(ZET, lijf(merk), M);
    lijn = r.data && r.data.lijn;
    const b = metNaam(await beheer(), merk);
    return { klopt: r.status === 200 && !!lijn && b.length === 1 && b[0].haltes.length === 3 && b[0].frequentieMin === 10,
      ziet: 'bewaren ' + r.status + ', ' + b.length + ' lijn in het beheer, ' + (b[0] && b[0].haltes.length) + ' haltes' };
  });

  await stap('voltooibaar', 'een lid ziet de nieuwe lijn meteen op de OV-kaart, met haltes en tarief', async () => {
    const l = metNaam(await bijLid(), merk);
    return { klopt: l.length === 1 && l[0].code === VERVOERDER && l[0].haltes.length === 3 && l[0].tarief.basis === 200,
      ziet: l.length + ' lijn bij het lid' + (l[0] ? ', ' + l[0].zaak + ', ' + l[0].haltes.map((h) => h.naam).join(' > ') : '') };
  });

  await stap('voltooibaar', 'de manager past de frequentie aan; het lid ziet de nieuwe stand', async () => {
    const r = await w.post(ZET, lijf(merk, { id: lijn.id, frequentieMin: 6 }), M);
    const l = metNaam(await bijLid(), merk);
    return { klopt: r.status === 200 && l.length === 1 && l[0].frequentieMin === 6, ziet: 'aanpassen ' + r.status + ', bij het lid elke ' + (l[0] && l[0].frequentieMin) + ' min' };
  });

  await stap('voltooibaar', 'een chauffeur van dezelfde zaak mag niet tekenen, en een zaak die geen OV-vervoerder is ook niet', async () => {
    const C = await login(w, VERVOERDER, false);
    const c = await w.post(ZET, lijf(merk + ' chauffeur'), C);
    const H = await login(w, 'BRISA', true);
    const h = await w.post(ZET, lijf(merk + ' horeca'), H);
    const weg = await w.post(ZET, { id: lijn.id, weg: true }, H);
    const nog = metNaam(await bijLid(), merk);
    return { klopt: c.status === 403 && h.status === 409 && weg.status === 409 && nog.length === 1 &&
      metNaam(await bijLid(), merk + ' chauffeur').length === 0,
      ziet: 'chauffeur ' + c.status + ' (' + (c.data && c.data.error) + '), horeca ' + h.status + ', weghalen door horeca ' + weg.status + ', lijn staat er nog' };
  });

  /* ---------------- persistent ---------------- */
  const voor = JSON.stringify(metNaam(await beheer(), merk));
  await w.herstart();

  await stap('persistent', 'na een nette herstart staat de lijn er nog, gelijk', async () => {
    const na = JSON.stringify(metNaam(await beheer(), merk));
    return { klopt: voor.length > 2 && na === voor, ziet: na === voor ? 'gelijk' : 'ANDERS: ' + na.slice(0, 100) };
  });

  await stap('persistent', 'een nieuwe sessie van de manager en het lid zien dezelfde lijn', async () => {
    M = await login(w, VERVOERDER, true);
    const na = JSON.stringify(metNaam(await beheer(), merk));
    const l = metNaam(await bijLid(), merk);
    return { klopt: na === voor && l.length === 1 && l[0].frequentieMin === 6, ziet: (na === voor ? 'beheer gelijk' : 'ANDERS') + ', lid ziet ' + l.length };
  });

  await stap('persistent', 'de lijn staat in de opslag zelf (gelezen buiten de server om)', async () => {
    const plek = w.vindInOpslag(merk).filter((p) => p.sleutel !== 'audit');
    return { klopt: plek.length >= 1, ziet: 'lijn in ' + plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op "bewaren" bij een nieuwe lijn: een lijn, niet twee', async () => {
    const [a, b] = await w.dubbel(ZET, lijf(merk + ' D'), M);
    const n = metNaam(await beheer(), merk + ' D').length;
    return { klopt: geen5xx(a) && geen5xx(b) && (a.status === 200 || b.status === 200) && n === 1,
      ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' lijn(en)' };
  });

  await stap('herstelbaar', 'een afgebroken "bewaren" en opnieuw: precies een lijn', async () => {
    const half = await w.afgebroken(ZET, lijf(merk + ' A'), M);
    const opnieuw = await w.post(ZET, lijf(merk + ' A'), M);
    const n = metNaam(await beheer(), merk + ' A').length;
    return { klopt: opnieuw.status === 200 && n === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' lijn(en)' };
  });

  await stap('herstelbaar', 'een crash direct na het weghalen: wat weg heette blijft weg, ook bij het lid', async () => {
    const x = await w.post(ZET, { id: lijn.id, weg: true }, M);
    await w.crash();
    const b = metNaam(await beheer(await login(w, VERVOERDER, true)), merk);
    const l = metNaam(await bijLid(), merk);
    return { klopt: x.status === 200 && b.length === 0 && l.length === 0, ziet: 'weghalen ' + x.status + ', na SIGKILL beheer ' + b.length + ', lid ' + l.length };
  });
}

module.exports = {
  functie: 'link:ovroutes',
  ingang: '/apps/ovroutes.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'de manager van een OV-zaak tekent een lijn met haltes, frequentie en tarief, en leden zien hem meteen op de OV-kaart; weghalen haalt hem ook bij hen weg -- ook na een herstart, een dubbele tik, een afgebroken verzoek en een crash',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf (het slepen van haltes op de SVG-kaart is niet gelopen). De vervoerder is Ibiza Transit uit de demostand. Wat er met lopende ritten en verkochte kaartjes gebeurt als een lijn verdwijnt, is niet beproefd. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
