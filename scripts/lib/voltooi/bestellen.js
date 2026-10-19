/* ============================================================================
   VOLTOOIPROEF: BESTELLEN (tab:bestellen) -- de stand Bestellen in de
   ledenapp, bereikt langs de navigatieroute /apps/app.html#tab=bestellen.

   De belofte van de stand ("Boodschappen -- bestel en laat bezorgen"): een lid
   kiest bij een groothandel die aan leden levert de producten en aantallen,
   bestelt, en volgt de bestelling tot ze geleverd is. Wat er niet ligt, kan
   niet worden besteld; een bestelling die nog niet bevestigd is, kan het lid
   annuleren. Over de routes die de stand aanroept: /api/groothandel/markt,
   /bestel, /mijn en /annuleer. De andere kant is de groothandel zelf (demo-code
   MERCABIZA) die de bestelling verder zet langs /api/supplier/groothandel/
   order/status.

   De koppeling van een stand zonder eigen adres: zie de kop van ./gezin.js.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, KANTOORWERELD } = require('../voltooiwereld');

const MARKT = '/api/groothandel/markt';
const BESTEL = '/api/groothandel/bestel';
const MIJN = '/api/groothandel/mijn';
const ANNULEER = '/api/groothandel/annuleer';
const VERDER = '/api/supplier/groothandel/order/status';
const GH = 'MERCABIZA';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function zaakSessie(w, code) {
  const roster = (await w.post('/api/supplier/roster', { code })).data || {};
  const wie = (roster.staff || []).find((x) => x.role === 'manager');
  return ((await w.post('/api/supplier/login', { code, staffId: wie && wie.id, pin: '1234' })).data || {}).token;
}

async function loop(w, stap) {
  const L = await nieuwLid(w, 'bol');
  const X = await nieuwLid(w, 'box');
  const Z = await zaakSessie(w, GH);
  let product = null, ref = null;
  const markt = async (tok) => (((await w.post(MARKT, {}, tok || L.token)).data || {}).groothandels || []).find((g) => g.code === GH) || null;
  const voorraad = async (id) => (((await markt()) || {}).producten || []).find((p) => p.id === id).voorraad;
  const mijn = async (tok) => ((await w.post(MIJN, {}, tok || L.token)).data || {}).bestellingen || [];
  const order = async (r, tok) => (await mijn(tok)).find((o) => o.ref === r) || null;
  const bestel = (aantal, tok) => w.post(BESTEL, { groothandelCode: GH, regels: [{ productId: product.id, aantal }] }, tok || L.token);

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'het lid ziet de groothandel met producten, prijs en voorraad, en bestelt; de voorraad gaat omlaag', async () => {
    const g = await markt();
    product = g && (g.producten || []).find((p) => typeof p.voorraad === 'number' && p.voorraad >= 10);
    const voor = product.voorraad;
    const b = await bestel(product.minBestel || 2);
    ref = b.data && b.data.order && b.data.order.ref;
    const o = await order(ref);
    return { klopt: !!g && b.status === 200 && !!o && o.status === 'aangevraagd' && (await voorraad(product.id)) === voor - (product.minBestel || 2),
      ziet: 'markt met ' + ((g && g.producten) || []).length + ' producten, bestellen ' + b.status + ', ' + (o && o.status) + ', voorraad ' + voor + ' -> ' + (await voorraad(product.id)) };
  });

  await stap('voltooibaar', 'de groothandel bevestigt, stuurt op weg en levert; het lid ziet elke stap op volgorde', async () => {
    const stappen = [];
    for (let i = 0; i < 3; i++) stappen.push((await w.post(VERDER, { ref, actie: 'verder' }, Z)).status);
    const o = await order(ref);
    const pad = ((o && o.stappen) || []).map((s) => s.status).join('>');
    return { klopt: stappen.join() === '200,200,200' && o.status === 'geleverd' && pad === 'aangevraagd>bevestigd>onderweg>geleverd',
      ziet: 'stappen ' + stappen.join('/') + ', bij het lid: ' + pad };
  });

  await stap('voltooibaar', 'meer bestellen dan er ligt kan niet: een melding in woorden en geen bestelling', async () => {
    const v = await voorraad(product.id);
    const voor = (await mijn()).length;
    const b = await bestel(v + 1000);
    return { klopt: b.status === 409 && /ligt er nog/.test((b.data && b.data.error) || '') && (await mijn()).length === voor && (await voorraad(product.id)) === v,
      ziet: b.status + ' -- ' + (b.data && b.data.error) };
  });

  await stap('voltooibaar', 'een nog niet bevestigde bestelling annuleert het lid; de voorraad komt terug', async () => {
    const v = await voorraad(product.id);
    const b = await bestel(product.minBestel || 2);
    const r = b.data && b.data.order && b.data.order.ref;
    const a = await w.post(ANNULEER, { ref: r }, L.token);
    const o = await order(r);
    return { klopt: b.status === 200 && a.status === 200 && o && o.status === 'geannuleerd' && (await voorraad(product.id)) === v,
      ziet: 'bestellen ' + b.status + ', annuleren ' + a.status + ', ' + (o && o.status) + ', voorraad ' + v + ' -> ' + (await voorraad(product.id)) };
  });

  await stap('voltooibaar', 'bevoegdheid: zonder sessie geen markt, geen bestelling en geen annulering (401)', async () => {
    const a = await w.post(MARKT, {});
    const b = await w.post(BESTEL, { groothandelCode: GH, regels: [{ productId: product.id, aantal: 2 }] });
    const c = await w.post(MIJN, {});
    return { klopt: a.status === 401 && b.status === 401 && c.status === 401, ziet: 'markt ' + a.status + ', bestel ' + b.status + ', mijn ' + c.status };
  });

  await stap('voltooibaar', 'bevoegdheid: een ander lid ziet de bestelling niet en annuleert haar niet', async () => {
    const b = await bestel(product.minBestel || 2);
    const r = b.data && b.data.order && b.data.order.ref;
    const zicht = (await mijn(X.token)).some((o) => o.ref === r);
    const a = await w.post(ANNULEER, { ref: r }, X.token);
    const o = await order(r);
    await w.post(ANNULEER, { ref: r }, L.token);
    return { klopt: !zicht && a.status === 404 && o && o.status === 'aangevraagd', ziet: 'X ziet: ' + zicht + ', annuleren door X ' + a.status + ', bij L nog ' + (o && o.status) };
  });

  await stap('voltooibaar', 'bevoegdheid: een zaak die geen groothandel is, zet de bestelling van een ander niet verder', async () => {
    const K = await zaakSessie(w, 'KIKUNOI');
    const b = await bestel(product.minBestel || 2);
    const r = b.data && b.data.order && b.data.order.ref;
    const v = await w.post(VERDER, { ref: r, actie: 'verder' }, K);
    const o = await order(r);
    await w.post(ANNULEER, { ref: r }, L.token);
    return { klopt: v.status >= 400 && v.status < 500 && o && o.status === 'aangevraagd', ziet: 'verder door een restaurant ' + v.status + ' (' + (v.data && v.data.error) + '), bestelling nog ' + (o && o.status) };
  });

  /* ---------------- persistent ---------------- */
  const vorm = (o) => o && JSON.stringify([o.ref, o.status, o.subtotaal, o.regels, (o.stappen || []).map((s) => s.status)]);
  const voor = vorm(await order(ref));
  await w.herstart();

  await stap('persistent', 'na een nette herstart staat de geleverde bestelling er precies zo, met haar stappen', async () => {
    const na = vorm(await order(ref));
    return { klopt: !!voor && na === voor, ziet: na === voor ? 'gelijk' : 'ANDERS: ' + na };
  });

  await stap('persistent', 'een nieuwe sessie (een ander toestel) ziet dezelfde bestellingen', async () => {
    const tok = await inloggen(w, L);
    const na = vorm(await order(ref, tok));
    return { klopt: na === voor, ziet: na === voor ? 'nieuwe sessie leest hetzelfde' : 'ANDERS' };
  });

  await stap('persistent', 'de bestelling staat in de opslag zelf (gelezen buiten de server om)', async () => {
    const p = w.vindInOpslag(ref);
    return { klopt: p.length >= 1, ziet: 'in ' + [...new Set(p.map((x) => x.bestand + '/' + (x.sleutel || x.tabel)))].join(', ') };
  });

  /* ---------------- herstelbaar ---------------- */
  const aangevraagd = async () => (await mijn()).filter((o) => o.status === 'aangevraagd');
  await stap('herstelbaar', 'een dubbele tik op "Bezorgen": een bestelling, niet twee', async () => {
    const voor = (await aangevraagd()).length;
    /* zoals de stand: een herhaalsleutel per samengestelde bestelling */
    const [a, b] = await w.dubbel(BESTEL, { groothandelCode: GH, regels: [{ productId: product.id, aantal: product.minBestel || 2 }], idem: 'boodschappen-dubbel-' + ref }, L.token);
    const nieuw = (await aangevraagd()).length - voor;
    for (const o of await aangevraagd()) await w.post(ANNULEER, { ref: o.ref }, L.token);
    return { klopt: geen5xx(a) && geen5xx(b) && (a.status === 200 || b.status === 200) && nieuw === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + nieuw + ' nieuwe bestelling(en)' };
  });

  await stap('herstelbaar', 'een dubbele tik van de groothandel op "volgende stap": een stap verder, niet twee', async () => {
    const b = await bestel(product.minBestel || 2);
    const r = b.data && b.data.order && b.data.order.ref;
    /* zoals het scherm van de groothandel: de stand die het zag, gaat mee */
    const [x, y] = await w.dubbel(VERDER, { ref: r, actie: 'verder', van: 'aangevraagd' }, Z);
    const o = await order(r);
    return { klopt: geen5xx(x) && geen5xx(y) && o && o.status === 'bevestigd', ziet: 'antwoorden ' + x.status + '/' + y.status + ', status ' + (o && o.status) + ' (' + ((o && o.stappen) || []).map((s) => s.status).join('>') + ')' };
  });

  await stap('herstelbaar', 'een afgebroken bestelling, daarna opnieuw: een bestelling', async () => {
    const voor = (await aangevraagd()).length;
    const lijf = { groothandelCode: GH, regels: [{ productId: product.id, aantal: product.minBestel || 2 }], idem: 'boodschappen-half-' + ref };
    const half = await w.afgebroken(BESTEL, lijf, L.token);
    const opnieuw = await w.post(BESTEL, lijf, L.token);
    const nieuw = (await aangevraagd()).length - voor;
    for (const o of await aangevraagd()) await w.post(ANNULEER, { ref: o.ref }, L.token);
    return { klopt: geen5xx(opnieuw) && nieuw === 1, ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + nieuw + ' nieuwe bestelling(en)' };
  });

  await stap('herstelbaar', 'een crash direct na het bestellen, en het toestel probeert opnieuw: een bestelling, en de voorraad een keer lager', async () => {
    const v = await voorraad(product.id);
    const lijf = { groothandelCode: GH, regels: [{ productId: product.id, aantal: product.minBestel || 2 }], idem: 'boodschappen-stroom-' + ref };
    const b = await w.post(BESTEL, lijf, L.token);
    const r = b.data && b.data.order && b.data.order.ref;
    await w.crash();
    const opnieuw = await w.post(BESTEL, lijf, L.token);
    const o = await order(r);
    return { klopt: b.status === 200 && opnieuw.status === 200 && opnieuw.data.order.ref === r && o && o.status === 'aangevraagd' && (await voorraad(product.id)) === v - (product.minBestel || 2),
      ziet: 'bestellen ' + b.status + ', na SIGKILL opnieuw ' + opnieuw.status + (opnieuw.data && opnieuw.data.order && opnieuw.data.order.ref === r ? ' (dezelfde)' : ' (EEN NIEUWE)') + ', voorraad ' + v + ' -> ' + (await voorraad(product.id)) };
  });
}

module.exports = {
  functie: 'tab:bestellen',
  ingang: '/apps/app.html',
  via: '#tab=bestellen',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een lid bestelt boodschappen bij een groothandel die aan leden levert, volgt de bestelling tot ze geleverd is en annuleert zolang ze niet bevestigd is; wat er niet ligt, kan niet worden besteld -- ook na een herstart, een dubbeltik, een afgebroken verzoek en een crash',
  grens: 'De stand heeft geen eigen scherm; de ingang is de navigatieroute /apps/app.html#tab=bestellen. Er wordt niets afgerekend: de groothandel factureert buiten deze stand. Bezorging is een status die de groothandel zet, geen rit. De groothandel is de demozaak MERCABIZA met haar demo-PIN. Geen Redis of PostgreSQL.',
  loop
};
