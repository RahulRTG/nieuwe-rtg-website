/* ============================================================================
   VOLTOOIPROEF: BETALEN (tab:betalen) -- de stand Betalen in de ledenapp,
   bereikt langs de navigatieroute /apps/app.html#tab=betalen.

   De belofte van de stand: een zaak stuurt een lid een betaalverzoek op zijn
   codenaam; het lid ziet het in Betalen, rekent het af uit zijn wallet, en
   het verzoek is daarna voldaan -- een keer, ook bij een dubbele tik. Rechtstreeks
   betalen aan een zaak gaat langs dezelfde weg. Over de routes die de stand
   aanroept: /api/betaal/verzoeken, /api/betaal/verzoek/pay, /api/betaal/direct
   en /api/betaal/mijn, met /api/pay/saldo voor het saldo.

   DE RAIL IS DE SIMULATIEBANK. Een directe betaling loopt niet over de wallet
   maar over de betaalwaarheid en de bankrail (kern/directpay/betalen.js); de
   proef kiest de afloop vooraf met een herhaalsleutel, zoals ../voltooi/pay.js,
   en tekent elk verzoek met een gebonden toestel. Geen vlag in een poort.

   WAAROM DIT NIET IN scripts/lib/voltooi/ STAAT: zie de kop van ./gezin.js --
   een stand zonder eigen adres hangt nog niet aan het register.
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const { geverifieerdLid, gebondenToestel, inloggen, nieuwLid, KANTOORWERELD } = require('../voltooiwereld');
const simulatiebank = require('../../../server/betaal/synthetisch');

const VERZOEKEN = '/api/betaal/verzoeken';
const BETAAL = '/api/betaal/verzoek/pay';
const DIRECT = '/api/betaal/direct';
const MIJN = '/api/betaal/mijn';
const ZAAK = 'KIKUNOI';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;
const bank = simulatiebank({ crypto, env: {}, echteRail: null });
const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');

/* Een herhaalsleutel waarmee de simulatiebank deze afloop kiest voor een
   directe betaling: actor `dp:<sleutel>`, idem `dp:<sleutel>:<client-idem>`
   (kern/directpay/betalen.js en kern/betaalwaarheid/index.js, idVan). */
function directSleutel(key, merk, afloop) {
  for (let i = 0; i < 10000; i++) {
    const idem = merk + '-' + i;
    const id = 'BW-' + sha('dp:' + key + '|dp:' + key + ':' + idem).slice(0, 20).toUpperCase();
    if (bank.scenarioVan({ idempotentieSleutel: 'waarheid:' + id }) === (afloop || 'betaald')) return idem;
  }
  throw new Error('geen herhaalsleutel gevonden die "' + afloop + '" geeft');
}

async function loop(w, stap) {
  const merk = 'bt' + Date.now().toString(36);
  const L = await geverifieerdLid(w, 'btl');
  const X = await geverifieerdLid(w, 'btx');
  const tL = await gebondenToestel(w, L.token);
  const tX = await gebondenToestel(w, X.token);
  /* Elk geldverzoek getekend met het gebonden toestel, zoals de browser. */
  const post = async (pad, lijf, wie, tok) => w.post(pad, lijf, tok || wie.token, await (wie === X ? tX : wie.t || tL).bewijs('POST', pad));
  const ik = (await w.post('/api/member/connections', {}, L.token)).data || {};
  const codenaam = ik.codename, key = ik.me;
  const roster = (await w.post('/api/supplier/roster', { code: ZAAK })).data || {};
  const chef = (roster.staff || []).find((x) => x.role === 'manager');
  const Z = ((await w.post('/api/supplier/login', { code: ZAAK, staffId: chef && chef.id, pin: '1234' })).data || {}).token;
  const verzoeken = async (wie) => ((await post(VERZOEKEN, {}, wie || L)).data || {}).verzoeken || [];
  const betalingen = async (wie) => ((await post(MIJN, {}, wie || L)).data || {}).betalingen || [];
  const ontvangsten = async () => JSON.stringify((await w.post('/api/supplier/ontvangsten', {}, Z)).data || {});
  const stuurVerzoek = async (centen, oms) => { const v = (await w.post('/api/supplier/betaalverzoek', { codename: codenaam, centen, omschrijving: oms, idem: 'bv-' + oms }, Z)).data || {}; return v.verzoek && v.verzoek.ref; };
  let ref = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een zaak stuurt een betaalverzoek op de codenaam; het lid ziet het open in Betalen', async () => {
    ref = await stuurVerzoek(1250, 'Diner ' + merk);
    const mijn = (await verzoeken()).find((x) => x.ref === ref);
    return { klopt: !!ref && !!mijn && mijn.bedrag === 1250 && mijn.status === 'open', ziet: 'verzoek ' + ref + ', bij het lid: ' + (mijn ? mijn.bedrag + ' cent, ' + mijn.status : 'NIETS') };
  });

  await stap('voltooibaar', 'het lid rekent af en de bank keurt goed: het verzoek is voldaan, de zaak ziet de ontvangst, het lid ziet zijn betaling', async () => {
    const p = await post(BETAAL, { ref, idem: directSleutel(key, 'bv-ok-' + merk) }, L);
    const open = (await verzoeken()).some((x) => x.ref === ref);
    const b = (await betalingen()).filter((x) => x.supplierCode === ZAAK && x.bedrag === 1250);
    return { klopt: p.status === 200 && !open && (await ontvangsten()).includes(ref) && b.length === 1,
      ziet: 'afrekenen ' + p.status + ' (' + ((p.data && p.data.error) || 'ok') + '), nog open: ' + open + ', bij de zaak: ' + (await ontvangsten()).includes(ref) + ', ' + b.length + ' betaling bij het lid' };
  });

  await stap('voltooibaar', 'de bank weigert een directe betaling: het lid hoort dat er niets is afgeschreven, en de zaak ontvangt niets', async () => {
    const voor = (await betalingen()).length;
    const d = await post(DIRECT, { supplierCode: ZAAK, bedrag: 7.5, omschrijving: 'Geweigerd ' + merk, bron: 'app', idem: directSleutel(key, 'dp-nee-' + merk, 'geweigerd') }, L);
    const na = (await betalingen()).filter((x) => x.omschrijving === 'Geweigerd ' + merk && x.status !== 'geweigerd' && x.status !== 'mislukt').length;
    return { klopt: d.status === 402 && /niet gelukt/.test((d.data && d.data.error) || '') && !/nog niet definitief|wacht/.test((d.data && d.data.error) || '') && na === 0 && !(await ontvangsten()).includes('Geweigerd ' + merk),
      ziet: d.status + ' -- ' + (d.data && d.data.error) + '; betalingen ' + voor + ' -> ' + (await betalingen()).length };
  });

  await stap('voltooibaar', 'rechtstreeks betalen aan de zaak met goedkeuring van de bank: een betaling bij het lid en een ontvangst bij de zaak', async () => {
    const d = await post(DIRECT, { supplierCode: ZAAK, bedrag: 7.5, omschrijving: 'Koffie ' + merk, bron: 'app', idem: directSleutel(key, 'dp-ok-' + merk) }, L);
    const b = (await betalingen()).filter((x) => x.omschrijving === 'Koffie ' + merk);
    return { klopt: d.status === 200 && b.length === 1 && b[0].bedrag === 750 && (await ontvangsten()).includes('Koffie ' + merk),
      ziet: 'direct ' + d.status + ' (' + ((d.data && d.data.error) || 'ok') + '), ' + b.length + ' betaling bij het lid' };
  });

  await stap('voltooibaar', 'bevoegdheid: zonder sessie geen verzoeken en niet betalen (401)', async () => {
    const a = await w.post(VERZOEKEN, {});
    const b = await w.post(BETAAL, { ref });
    const c = await w.post(DIRECT, { supplierCode: ZAAK, bedrag: 1 });
    return { klopt: a.status === 401 && b.status === 401 && c.status === 401, ziet: 'verzoeken ' + a.status + ', betalen ' + b.status + ', direct ' + c.status };
  });

  await stap('voltooibaar', 'bevoegdheid: een ander gekeurd lid ziet het verzoek van het eerste niet en rekent het niet af', async () => {
    const r3 = await stuurVerzoek(300, 'Alleen voor L ' + merk);
    const bijX = await verzoeken(X);
    const p = await post(BETAAL, { ref: r3, idem: 'bv-x-' + r3 }, X);
    const nogOpen = (await verzoeken()).some((x) => x.ref === r3);
    return { klopt: !bijX.some((x) => x.ref === r3) && p.status === 403 && /iemand anders/.test((p.data && p.data.error) || '') && nogOpen,
      ziet: 'bij X: ' + bijX.length + ' verzoeken, afrekenen door X ' + p.status + ' (' + (p.data && p.data.error) + '), bij L nog open: ' + nogOpen };
  });

  await stap('voltooibaar', 'bevoegdheid: een betaling zonder bewezen toestel gaat niet door, en een gratis account betaalt niet', async () => {
    const zonder = await w.post(DIRECT, { supplierCode: ZAAK, bedrag: 1, idem: 'zonder-' + merk }, L.token);
    const g = await nieuwLid(w, 'btg', 'guest');
    const gast = await w.post(DIRECT, { supplierCode: ZAAK, bedrag: 1 }, g.token);
    return { klopt: (zonder.status === 401 || zonder.status === 403) && gast.status === 403, ziet: 'zonder toestelbewijs ' + zonder.status + ', gast ' + gast.status };
  });

  /* ---------------- persistent ---------------- */
  const vorm = (l) => JSON.stringify(l.map((x) => [x.ref, x.bedrag, x.status, x.omschrijving]));
  const voor = vorm(await betalingen());
  await w.herstart();

  await stap('persistent', 'na een nette herstart staan de betalingen er precies zo, en het voldane verzoek is niet weer open', async () => {
    const na = vorm(await betalingen());
    const open = (await verzoeken()).some((x) => x.ref === ref);
    return { klopt: voor.length > 4 && na === voor && !open, ziet: (na === voor ? 'gelijk' : 'ANDERS') + ', voldaan verzoek open: ' + open };
  });

  await stap('persistent', 'het lid logt opnieuw in op een nieuw toestel en ziet dezelfde betalingen', async () => {
    const tok = await inloggen(w, L);
    const t2 = await gebondenToestel(w, tok);
    const r = await w.post(MIJN, {}, tok, await t2.bewijs('POST', MIJN));
    return { klopt: r.status === 200 && vorm(r.data.betalingen || []) === voor, ziet: r.status + ', ' + (vorm((r.data && r.data.betalingen) || []) === voor ? 'gelijk' : 'ANDERS') };
  });

  await stap('persistent', 'het verzoek en de betaalwaarheid staan in de opslag zelf (gelezen buiten de server om)', async () => {
    const p = w.vindInOpslag(ref);
    return { klopt: p.length >= 1, ziet: 'verzoek ' + ref + ' in ' + [...new Set(p.map((x) => x.bestand + '/' + (x.sleutel || x.tabel)))].join(', ') };
  });

  /* ---------------- herstelbaar ---------------- */
  const telBij = async (oms) => (await betalingen()).filter((x) => x.omschrijving === oms && x.status !== 'geweigerd').length;
  await stap('herstelbaar', 'een dubbele tik op "afrekenen": een betaling, een ontvangst', async () => {
    const r = await stuurVerzoek(400, 'Dubbel ' + merk);
    const idem = directSleutel(key, 'bv-dubbel-' + merk);
    const [a, b] = await Promise.all([post(BETAAL, { ref: r, idem }, L), post(BETAAL, { ref: r, idem }, L)]);
    return { klopt: geen5xx(a) && geen5xx(b) && (a.status === 200 || b.status === 200) && (await telBij('Dubbel ' + merk)) === 1,
      ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + (await telBij('Dubbel ' + merk)) + ' betaling' };
  });

  await stap('herstelbaar', 'een afgebroken directe betaling, daarna opnieuw met dezelfde sleutel: een betaling', async () => {
    const lijf = { supplierCode: ZAAK, bedrag: 2.5, omschrijving: 'Half ' + merk, bron: 'app', idem: directSleutel(key, 'dp-half-' + merk) };
    const half = await w.afgebroken(DIRECT, lijf, L.token, await tL.bewijs('POST', DIRECT));
    const opnieuw = await post(DIRECT, lijf, L);
    return { klopt: geen5xx(opnieuw) && (await telBij('Half ' + merk)) === 1, ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + (await telBij('Half ' + merk)) + ' betaling' };
  });

  await stap('herstelbaar', 'een crash direct na het afrekenen, en het toestel probeert opnieuw: een betaling', async () => {
    const r = await stuurVerzoek(600, 'Stroom ' + merk);
    const idem = directSleutel(key, 'bv-stroom-' + merk);
    const p = await post(BETAAL, { ref: r, idem }, L);
    await w.crash();
    const opnieuw = await post(BETAAL, { ref: r, idem }, L);
    return { klopt: p.status === 200 && geen5xx(opnieuw) && (await telBij('Stroom ' + merk)) === 1, ziet: 'betalen ' + p.status + ', na SIGKILL opnieuw ' + opnieuw.status + ', ' + (await telBij('Stroom ' + merk)) + ' betaling' };
  });
}

module.exports = {
  functie: 'tab:betalen',
  ingang: '/apps/app.html#tab=betalen',
  persona: 'lid',
  omgeving: Object.assign({ RTG_SIMULATIEBANK: '1' }, KANTOORWERELD),
  belofte: 'een lid ziet het betaalverzoek van een zaak op zijn codenaam en rekent het een keer af, betaalt een zaak rechtstreeks, en hoort het als de bank weigert -- een betaling staat er een keer, ook na een herstart, een dubbeltik, een afgebroken verzoek en een crash',
  grens: 'De stand heeft geen eigen scherm; de ingang is de navigatieroute /apps/app.html#tab=betalen. Face ID is in de app een bevestiging op het toestel; de proef tekent elk geldverzoek met het gebonden toestel zoals de browser. De munt, facturen en de terugbetaling worden niet gelopen. Geen Redis of PostgreSQL.',
  loop
};
