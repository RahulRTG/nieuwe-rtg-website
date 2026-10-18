/* ============================================================================
   VOLTOOIPROEF: RTG PAY OPLADEN (link:pay, /apps/pay.html).

   De belofte van het scherm: een lid laadt zijn wallet op en ziet het nieuwe
   saldo. Achter die ene knop zit het enige pad waar geld van BUITEN het huis
   binnenkomt (kern/pay/opladen.js -> kern/betaalwaarheid -> de betaalnaad), en
   daarmee de keten die straks Stripe, Mollie of Adyen draagt.

   DE RAIL IS DE SIMULATIEBANK (server/betaal/synthetisch.js), en die is hier
   met opzet gekozen boven een altijd-ja: hij kan weigeren, blijven hangen en
   terugboeken. Een proef die alleen de zonnige dag loopt, bewijst niets over
   de dag waarop een lid zijn geld kwijt denkt te zijn. Geen vlag in een poort:
   KYC, het toestelbewijs, de vrijgavepoort en het walletplafond draaien
   ongewijzigd mee (MAGNAATLAB.md par. 3).

   DE AFLOOP WORDT GEKOZEN, NIET GEGOKT. De simulatiebank leidt zijn scenario
   af uit de providersleutel `waarheid:<betaling-id>`, en dat id volgt uit de
   eigenaar en de herhaalsleutel (kern/betaalwaarheid/index.js, idVan). De
   proef zoekt dus vooraf een herhaalsleutel die de gewenste afloop geeft.
   Verandert een van die twee afleidingen, dan krijgt een stap de verkeerde
   afloop en sluit hij niet -- luid, niet stil.

   Het lid is een echt account met een door een medewerker op naam goedgekeurde
   identiteit en een gebonden toestel; elke betaalroute wordt met een eigen
   bezitsbewijs getekend, zoals de browser dat doet.
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const { geverifieerdLid, gebondenToestel, inloggen, KANTOORWERELD } = require('../voltooiwereld');
const simulatiebank = require('../../../server/betaal/synthetisch');

const OPLAAD = '/api/pay/oplaad';
const OVERZICHT = '/api/pay/overzicht';

const bank = simulatiebank({ crypto, env: {}, echteRail: null });
const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');

/* Een herhaalsleutel waarmee de simulatiebank deze afloop kiest. Zelfde
   afleiding als de server: actor `pay:<codenaam>`, idem `pay-oplaad:<codenaam>:<idem>`. */
function sleutelVoor(codenaam, afloop, merk) {
  for (let i = 0; i < 10000; i++) {
    const idem = 'voltooi-pay-' + merk + '-' + i;
    const id = 'BW-' + sha('pay:' + codenaam + '|pay-oplaad:' + codenaam + ':' + idem).slice(0, 20).toUpperCase();
    if (bank.scenarioVan({ idempotentieSleutel: 'waarheid:' + id }) === afloop) return { idem, id };
  }
  throw new Error('geen herhaalsleutel gevonden die "' + afloop + '" geeft');
}

const oplaadregels = (r) => ((r && r.data && r.data.geschiedenis) || []).filter((g) => g.soort === 'oplaad');

async function loop(w, stap) {
  const lid = await geverifieerdLid(w, 'pay');
  const toestel = await gebondenToestel(w, lid.token);
  const post = async (pad, lijf) => w.post(pad, lijf, lid.token, await toestel.bewijs('POST', pad));
  const overzicht = () => post(OVERZICHT, {});
  let codenaam = null;
  const BEDRAG = 2500;
  let betaald = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een geverifieerd lid met een gebonden toestel opent RTG Pay en ziet een leeg saldo', async () => {
    const r = await overzicht();
    codenaam = r.data && r.data.codenaam;
    return { klopt: r.status === 200 && !!codenaam && r.data.saldo === 0 && oplaadregels(r).length === 0,
      ziet: 'status ' + r.status + ', saldo ' + (r.data && r.data.saldo) };
  });

  await stap('voltooibaar', 'het lid laadt 25 euro op, de bank keurt goed, en het nieuwe saldo staat er meteen', async () => {
    betaald = sleutelVoor(codenaam, 'betaald', 'ok');
    const r = await post(OPLAAD, { centen: BEDRAG, idem: betaald.idem });
    const o = await overzicht();
    return { klopt: r.status === 200 && r.data.geladen === BEDRAG && r.data.betalingId === betaald.id &&
      o.data.saldo === BEDRAG && oplaadregels(o).length === 1,
      ziet: 'opladen ' + r.status + ', saldo ' + (o.data && o.data.saldo) + ', ' + oplaadregels(o).length + ' oplaadregel' };
  });

  await stap('voltooibaar', 'de bank weigert: het lid hoort dat er niets is afgeschreven, en het saldo blijft gelijk', async () => {
    const k = sleutelVoor(codenaam, 'geweigerd', 'nee');
    const r = await post(OPLAAD, { centen: 1000, idem: k.idem });
    const o = await overzicht();
    const zin = (r.data && r.data.error) || '';
    return { klopt: r.status === 402 && /niet gelukt/.test(zin) && /niets afgeschreven/.test(zin) && !/wacht/.test(zin) &&
      o.data.saldo === BEDRAG,
      ziet: r.status + ' (' + zin.slice(0, 70) + '), saldo ' + (o.data && o.data.saldo) };
  });

  await stap('voltooibaar', 'de bank boekt terug: ook dat is geen wachtende betaling, en er wordt niets bijgeschreven', async () => {
    const k = sleutelVoor(codenaam, 'terugboeking', 'terug');
    const r = await post(OPLAAD, { centen: 1000, idem: k.idem });
    const o = await overzicht();
    const zin = (r.data && r.data.error) || '';
    return { klopt: r.status === 402 && /niet gelukt/.test(zin) && o.data.saldo === BEDRAG,
      ziet: r.status + ' (' + zin.slice(0, 70) + '), saldo ' + (o.data && o.data.saldo) };
  });

  await stap('voltooibaar', 'de bank blijft hangen: het lid hoort dat de betaling wacht, en er wordt niets bijgeschreven', async () => {
    const k = sleutelVoor(codenaam, 'traag', 'traag');
    const r = await post(OPLAAD, { centen: 1000, idem: k.idem });
    const o = await overzicht();
    const zin = (r.data && r.data.error) || '';
    return { klopt: r.status === 402 && /wacht op bevestiging/.test(zin) && o.data.saldo === BEDRAG,
      ziet: r.status + ' (' + zin + '), saldo ' + (o.data && o.data.saldo) };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  /* De toestelbinding hoort bij de sessie en overleeft een herstart; een
     nieuw bewijs per verzoek is gewoon het recept van de browser. */
  await stap('persistent', 'na een nette herstart staat het saldo er nog, met precies een oplaadregel', async () => {
    const o = await overzicht();
    return { klopt: o.status === 200 && o.data.saldo === BEDRAG && oplaadregels(o).length === 1,
      ziet: 'status ' + o.status + ', saldo ' + (o.data && o.data.saldo) + ', ' + oplaadregels(o).length + ' oplaadregel' };
  });

  await stap('persistent', 'een read-only lezer vindt de waarheid van alle vier de betalingen in de opslag, en geen rauwe sessiesleutel', async () => {
    const waarheid = Object.values(w.collectie('betaalWaarheid') || {}).filter((b) => b.actor === 'pay:' + codenaam);
    const stand = (afloop) => waarheid.filter((b) => b.providerStatus === afloop).map((b) => b.status);
    const ok = waarheid.find((b) => b.id === betaald.id);
    return { klopt: waarheid.length === 4 && !!ok && ok.status === 'BEVESTIGD' && !!ok.afgehandeldAt &&
      stand('geweigerd').join() === 'GEWEIGERD' && stand('teruggeboekt').join() === 'GEWEIGERD' &&
      stand('open').join() === 'WACHT_OP_KLANT' && !JSON.stringify(waarheid).includes(lid.token),
      ziet: waarheid.length + ' betalingen: ' + waarheid.map((b) => b.providerStatus + '=' + b.status).join(', ') };
  });

  await stap('persistent', 'na de herstart logt het lid opnieuw in op een nieuw toestel en ziet hetzelfde saldo', async () => {
    const tok = await inloggen(w, lid);
    const ander = await gebondenToestel(w, tok);
    const o = await w.post(OVERZICHT, {}, tok, await ander.bewijs('POST', OVERZICHT));
    return { klopt: o.status === 200 && o.data.codenaam === codenaam && o.data.saldo === BEDRAG && oplaadregels(o).length === 1,
      ziet: 'nieuwe sessie ' + o.status + ', saldo ' + (o.data && o.data.saldo) + ', ' + oplaadregels(o).length + ' oplaadregel' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik met dezelfde herhaalsleutel laadt een keer op', async () => {
    const k = sleutelVoor(codenaam, 'betaald', 'dubbel');
    const voor = (await overzicht()).data.saldo;
    const [a, b] = await Promise.all([post(OPLAAD, { centen: 500, idem: k.idem }), post(OPLAAD, { centen: 500, idem: k.idem })]);
    const na = (await overzicht()).data.saldo;
    return { klopt: a.status === 200 && b.status === 200 && na - voor === 500,
      ziet: 'tikken ' + a.status + '/' + b.status + ', saldo +' + (na - voor) };
  });

  await stap('herstelbaar', 'een afgebroken verzoek, daarna opnieuw met dezelfde sleutel: een keer bijgeschreven', async () => {
    const k = sleutelVoor(codenaam, 'betaald', 'half');
    const voor = (await overzicht()).data.saldo;
    const half = await w.afgebroken(OPLAAD, { centen: 700, idem: k.idem }, lid.token, await toestel.bewijs('POST', OPLAAD));
    const opnieuw = await post(OPLAAD, { centen: 700, idem: k.idem });
    const na = (await overzicht()).data.saldo;
    return { klopt: opnieuw.status === 200 && na - voor === 700,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', saldo +' + (na - voor) };
  });

  await stap('herstelbaar', 'een crash direct na de bevestiging verliest of verdubbelt de oplading niet', async () => {
    const k = sleutelVoor(codenaam, 'betaald', 'crash');
    const voor = (await overzicht()).data.saldo;
    const r = await post(OPLAAD, { centen: 900, idem: k.idem });
    await w.crash();
    const opnieuw = await post(OPLAAD, { centen: 900, idem: k.idem });
    const na = (await overzicht()).data.saldo;
    return { klopt: r.status === 200 && opnieuw.status === 200 && opnieuw.data.betalingId === k.id && na - voor === 900,
      ziet: 'bevestigd ' + r.status + ', na SIGKILL ' + opnieuw.status + (opnieuw.data && opnieuw.data.herhaald ? ' (herhaald)' : '') + ', saldo +' + (na - voor) };
  });

  await stap('herstelbaar', 'na de crash wordt een hangende betaling niet alsnog bijgeschreven', async () => {
    const o = await overzicht();
    const hangt = Object.values(w.collectie('betaalWaarheid') || {})
      .filter((b) => b.actor === 'pay:' + codenaam && b.providerStatus === 'open');
    return { klopt: o.status === 200 && hangt.length === 1 && hangt[0].status === 'WACHT_OP_KLANT' && !hangt[0].afgehandeldAt,
      ziet: hangt.length + ' hangende betaling, stand ' + (hangt[0] && hangt[0].status) + ', saldo ' + (o.data && o.data.saldo) };
  });
}

module.exports = {
  functie: 'link:pay',
  ingang: '/apps/pay.html',
  persona: 'lid',
  omgeving: Object.assign({ RTG_SIMULATIEBANK: '1' }, KANTOORWERELD),
  belofte: 'een geverifieerd lid laadt zijn wallet op en ziet het nieuwe saldo; weigert of hangt de bank, dan hoort het lid wat er werkelijk gebeurde en wordt er niets bijgeschreven -- ook na een herstart, een dubbele tik, een afgebroken verzoek en een crash',
  grens: 'De rail is de simulatiebank, geen echte provider: dit bewijst de keten van knop tot grootboek, niet dat Stripe, Mollie of Adyen zo antwoorden (dat is de sandboxproef per provider). Er loopt geen webhook: de simulatiebank antwoordt meteen. De proef loopt de routes van het scherm, niet het scherm zelf, en kent geen Redis, PostgreSQL of geldmotor.',
  loop
};
