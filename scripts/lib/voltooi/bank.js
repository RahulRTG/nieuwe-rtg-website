/* ============================================================================
   VOLTOOIPROEF: RTG BANK (link:bank, /apps/geld.html#bank).

   De belofte van de stand: zodra het kantoor de leden-bank live zet, geeft
   een lid akkoord en krijgt het meteen een betaalrekening; het opent er een
   spaarrekening bij, stort geld van buiten, boekt over tussen eigen rekeningen
   en leest het afschrift. Routes letterlijk uit apps/geld/bankb.js en bankc.js.

   DE RAIL IS DE SIMULATIEBANK. Storten in de stand partner/hybride loopt via de
   betaalwaarheid naar de kaart-naad (kern/bank/stortwaarheid.js); de
   simulatiebank kiest zijn afloop uit het betaling-id, en de proef kiest de
   herhaalsleutel vooraf (zelfde recept als ./pay.js). Geen vlag in een poort: de leden-bank gaat
   open langs de echte kantoorroute (/api/office/bank/leden) door een
   herleidbaar mens, en /api/bank/* draagt het bezitsbewijs van een gebonden
   toestel (kern/identiteit/bezitspaden.js), zoals de browser dat meestuurt.
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const { geverifieerdLid, nieuwLid, inloggen, gebondenToestel, eigenaarSessie, KANTOORWERELD } = require('../voltooiwereld');
const simulatiebank = require('../../../server/betaal/synthetisch');

const OVERZICHT = '/api/bank/overzicht';
const AKKOORD = '/api/bank/akkoord';
const OPEN = '/api/bank/rekening/open';
const STORTEN = '/api/bank/storten';
const OVERBOEK = '/api/bank/overboek';
const AFSCHRIFT = '/api/bank/afschrift';
const LEDEN_LIVE = '/api/office/bank/leden';

const bank = simulatiebank({ crypto, env: {}, echteRail: null });
const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
/* Storten loopt via de betaalwaarheid (kern/bank/stortwaarheid.js): actor
   `bank:<codenaam>`, idem `bank-stort:<iban>:<idem>`, en de rail krijgt
   `waarheid:<betaling-id>` -- dezelfde afleiding als ./pay.js. */
let codenaam = null;
function stortSleutel(iban, afloop, merk) {
  for (let i = 0; i < 10000; i++) {
    const idem = merk + '-' + i;
    const id = 'BW-' + sha('bank:' + codenaam + '|bank-stort:' + iban + ':' + idem).slice(0, 20).toUpperCase();
    if (bank.scenarioVan({ idempotentieSleutel: 'waarheid:' + id }) === afloop) return idem;
  }
  throw new Error('geen herhaalsleutel gevonden die "' + afloop + '" geeft');
}

async function loop(w, stap) {
  const merk = 'bk' + Date.now().toString(36);
  const lid = await geverifieerdLid(w, 'bank');
  const T = lid.token;
  const toestel = await gebondenToestel(w, T);
  codenaam = ((await w.post('/api/member/connections', {}, T)).data || {}).codename;
  const post = async (pad, lijf, tok, t) => w.post(pad, lijf, tok || T, await (t || toestel).bewijs('POST', pad));
  const ov = async (tok, t) => (await post(OVERZICHT, {}, tok, t)).data || {};
  const saldo = (o, iban) => ((o.rekeningen || []).find((r) => r.iban === iban) || {}).saldoCenten;
  let betaal = null, spaar = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'zolang het kantoor de leden-bank niet live zette, ziet het lid dat en gaat er niets open', async () => {
    const o = await ov();
    const a = await post(AKKOORD, {});
    return { klopt: o.online === false && a.status === 403 && /nog niet live/.test(a.data.error),
      ziet: 'online ' + o.online + ', akkoord ' + a.status + ' (' + (a.data && a.data.error) + ')' };
  });

  await stap('voltooibaar', 'het kantoor zet de leden-bank live; het lid geeft akkoord en heeft meteen een lege betaalrekening', async () => {
    const live = await w.post(LEDEN_LIVE, { aan: true }, await eigenaarSessie(w));
    const a = await post(AKKOORD, {});
    const o = await ov();
    betaal = (o.rekeningen || []).find((r) => r.soort === 'betaal');
    return { klopt: live.status === 200 && a.status === 200 && o.online === true && o.akkoord === true &&
      o.rekeningen.length === 1 && !!betaal && betaal.saldoCenten === 0,
      ziet: 'live ' + live.status + ', akkoord ' + a.status + ', ' + (o.rekeningen || []).length + ' rekening, saldo ' + (betaal && betaal.saldoCenten) };
  });

  await stap('voltooibaar', 'het lid opent er een spaarrekening bij; een onbekende soort wordt geweigerd met de reden', async () => {
    const fout = await post(OPEN, { soort: 'goud', idem: merk + '-goud' });
    const r = await post(OPEN, { soort: 'spaar', idem: merk + '-spaar' });
    spaar = r.data && r.data.rekening;
    const o = await ov();
    return { klopt: fout.status === 400 && /soort/.test(fout.data.error) && r.status === 200 && o.rekeningen.length === 2 && saldo(o, spaar.iban) === 0,
      ziet: 'goud ' + fout.status + ', spaar ' + r.status + ', ' + o.rekeningen.length + ' rekeningen' };
  });

  await stap('voltooibaar', 'het lid stort 50 euro, de bank keurt goed: het saldo en het afschrift tonen de storting', async () => {
    const r = await post(STORTEN, { iban: betaal.iban, centen: 5000, idem: stortSleutel(betaal.iban, 'betaald', merk + '-ok') });
    const af = await post(AFSCHRIFT, { iban: betaal.iban, limit: 15 });
    const o = await ov();
    const regels = (af.data && af.data.regels) || [];
    return { klopt: r.status === 200 && r.data.gestort === 5000 && saldo(o, betaal.iban) === 5000 &&
      regels.length === 1 && regels[0].centen === 5000 && !regels[0].af,
      ziet: 'storten ' + r.status + (r.data && r.data.error ? ' (' + r.data.error + ')' : '') + ', saldo ' + saldo(o, betaal.iban) + ', ' + regels.length + ' afschriftregel' };
  });

  await stap('voltooibaar', 'de bank weigert een storting: het lid hoort dat er niets is gebeurd, niet dat het wacht, en het saldo blijft', async () => {
    const r = await post(STORTEN, { iban: betaal.iban, centen: 1000, idem: stortSleutel(betaal.iban, 'geweigerd', merk + '-nee') });
    const o = await ov();
    const zin = (r.data && r.data.error) || '';
    return { klopt: r.status === 402 && /niet gelukt/.test(zin) && !/wacht/.test(zin) && saldo(o, betaal.iban) === 5000,
      ziet: r.status + ' (' + zin + '), saldo ' + saldo(o, betaal.iban) };
  });

  await stap('voltooibaar', 'de bank blijft hangen: het lid hoort dat de storting wacht, en er wordt niets bijgeschreven', async () => {
    const r = await post(STORTEN, { iban: betaal.iban, centen: 1000, idem: stortSleutel(betaal.iban, 'traag', merk + '-traag') });
    const o = await ov();
    const zin = (r.data && r.data.error) || '';
    return { klopt: r.status === 402 && /wacht op bevestiging/.test(zin) && saldo(o, betaal.iban) === 5000,
      ziet: r.status + ' (' + zin + '), saldo ' + saldo(o, betaal.iban) };
  });

  await stap('voltooibaar', 'het lid boekt 20 euro over naar de spaarrekening: beide saldi kloppen tot op de cent', async () => {
    const r = await post(OVERBOEK, { vanIban: betaal.iban, naarIban: spaar.iban, centen: 2000, idem: merk + '-over' });
    const o = await ov();
    return { klopt: r.status === 200 && saldo(o, betaal.iban) === 3000 && saldo(o, spaar.iban) === 2000 && o.totaalCenten === 5000,
      ziet: 'overboeken ' + r.status + ', betaal ' + saldo(o, betaal.iban) + ', spaar ' + saldo(o, spaar.iban) };
  });

  await stap('voltooibaar', 'een ANDER lid ziet deze rekeningen niet, leest het afschrift niet en kan er niet van afboeken', async () => {
    /* gekeurd, zoals elk lid dat geld verplaatst (payGate, besluit 19 oktober
       2026): anders houdt de paspoortpoort hem tegen en meet dit de eigendom niet */
    const ander = await geverifieerdLid(w, 'bankander');
    const t2 = await gebondenToestel(w, ander.token);
    await post(AKKOORD, {}, ander.token, t2);
    const zijn = await ov(ander.token, t2);
    const zijnIban = ((zijn.rekeningen || [])[0] || {}).iban;
    const af = await post(AFSCHRIFT, { iban: betaal.iban }, ander.token, t2);
    const weg = await post(OVERBOEK, { vanIban: betaal.iban, naarIban: zijnIban, centen: 1000, idem: merk + '-diefstal' }, ander.token, t2);
    const o = await ov();
    return { klopt: !!zijnIban && !(zijn.rekeningen || []).some((r) => r.iban === betaal.iban) && af.status === 404 && weg.status === 404 &&
      saldo(o, betaal.iban) === 3000,
      ziet: 'ander ziet ' + (zijn.rekeningen || []).length + ' eigen rekening, afschrift ' + af.status + ', afboeken ' + weg.status + '; eigen saldo ' + saldo(o, betaal.iban) };
  });

  await stap('voltooibaar', 'uitgelogd ziet niemand een rekening en boekt niemand iets: 401, met een zin', async () => {
    const o = await w.post(OVERZICHT, {}, null);
    const a = await w.post(AFSCHRIFT, { iban: betaal.iban }, null);
    const b = await w.post(OVERBOEK, { vanIban: betaal.iban, naarIban: spaar.iban, centen: 100, idem: merk + '-uit' }, null);
    return { klopt: [o, a, b].every((r) => r.status === 401 && r.data && r.data.error) && saldo(await ov(), betaal.iban) === 3000,
      ziet: 'overzicht ' + o.status + ', afschrift ' + a.status + ', overboeken ' + b.status + ' (' + (o.data && o.data.error) + ')' };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staan het akkoord, beide rekeningen en de saldi er nog', async () => {
    const o = await ov();
    return { klopt: o.akkoord === true && (o.rekeningen || []).length === 2 && saldo(o, betaal.iban) === 3000 && saldo(o, spaar.iban) === 2000,
      ziet: 'akkoord ' + o.akkoord + ', ' + (o.rekeningen || []).length + ' rekeningen, betaal ' + saldo(o, betaal.iban) + ', spaar ' + saldo(o, spaar.iban) };
  });

  await stap('persistent', 'een read-only lezer vindt de storting en de overboeking in de opslag, en de geweigerde storting niet', async () => {
    const hier = w.vindInOpslag(betaal.iban).map((v) => v.sleutel || v.tabel);
    const af = await post(AFSCHRIFT, { iban: betaal.iban, limit: 15 });
    const regels = (af.data && af.data.regels) || [];
    return { klopt: hier.length > 0 && regels.length === 2 && regels.filter((x) => x.af).length === 1 && regels.reduce((s, x) => s + (x.af ? -x.centen : x.centen), 0) === 3000,
      ziet: 'IBAN op schijf in ' + [...new Set(hier)].join(', ') + '; afschrift ' + regels.length + ' regels' };
  });

  await stap('persistent', 'na de herstart logt het lid opnieuw in op een nieuw toestel en ziet dezelfde rekeningen', async () => {
    const tok = await inloggen(w, lid);
    const t = await gebondenToestel(w, tok);
    const o = await ov(tok, t);
    return { klopt: saldo(o, betaal.iban) === 3000 && saldo(o, spaar.iban) === 2000,
      ziet: 'nieuwe sessie: betaal ' + saldo(o, betaal.iban) + ', spaar ' + saldo(o, spaar.iban) };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op Storten (dezelfde sleutel, tegelijk) stort een keer', async () => {
    const idem = stortSleutel(betaal.iban, 'betaald', merk + '-dubbel');
    const voor = saldo(await ov(), betaal.iban);
    const [a, b] = await Promise.all([post(STORTEN, { iban: betaal.iban, centen: 700, idem }), post(STORTEN, { iban: betaal.iban, centen: 700, idem })]);
    const na = saldo(await ov(), betaal.iban);
    return { klopt: a.status === 200 && b.status === 200 && na - voor === 700, ziet: 'tikken ' + a.status + '/' + b.status + ', saldo +' + (na - voor) };
  });

  await stap('herstelbaar', 'een dubbele tik op Rekening openen (dezelfde sleutel, tegelijk) opent er een', async () => {
    const voor = ((await ov()).rekeningen || []).length;
    const [a, b] = await Promise.all([post(OPEN, { soort: 'spaar', idem: merk + '-open2' }), post(OPEN, { soort: 'spaar', idem: merk + '-open2' })]);
    const na = ((await ov()).rekeningen || []).length;
    return { klopt: a.status === 200 && b.status === 200 && na - voor === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', rekeningen +' + (na - voor) };
  });

  await stap('herstelbaar', 'een afgebroken overboeking, daarna opnieuw met dezelfde sleutel: een keer overgeboekt', async () => {
    const voor = await ov();
    const lijf = { vanIban: betaal.iban, naarIban: spaar.iban, centen: 300, idem: merk + '-half' };
    const half = await w.afgebroken(OVERBOEK, lijf, T, await toestel.bewijs('POST', OVERBOEK));
    const opnieuw = await post(OVERBOEK, lijf);
    const na = await ov();
    return { klopt: opnieuw.status === 200 && saldo(voor, betaal.iban) - saldo(na, betaal.iban) === 300 && saldo(na, spaar.iban) - saldo(voor, spaar.iban) === 300,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', betaal -' + (saldo(voor, betaal.iban) - saldo(na, betaal.iban)) };
  });

  await stap('herstelbaar', 'een crash direct na een storting, daarna dezelfde tik opnieuw: niet verloren en niet verdubbeld', async () => {
    const idem = stortSleutel(betaal.iban, 'betaald', merk + '-crash');
    const voor = saldo(await ov(), betaal.iban);
    const r = await post(STORTEN, { iban: betaal.iban, centen: 900, idem });
    await w.crash();
    const opnieuw = await post(STORTEN, { iban: betaal.iban, centen: 900, idem });
    const na = saldo(await ov(), betaal.iban);
    return { klopt: r.status === 200 && opnieuw.status === 200 && na - voor === 900,
      ziet: 'gestort ' + r.status + ', na SIGKILL ' + opnieuw.status + (opnieuw.data && opnieuw.data.herhaald ? ' (herhaald)' : '') + ', saldo +' + (na - voor) };
  });
}

module.exports = {
  functie: 'link:bank',
  ingang: '/apps/geld.html#bank',
  persona: 'lid',
  omgeving: Object.assign({ RTG_SIMULATIEBANK: '1' }, KANTOORWERELD),
  belofte: 'zodra het kantoor de leden-bank live zet, geeft een lid akkoord, krijgt een rekening, stort geld van buiten, boekt over tussen eigen rekeningen en leest het afschrift; weigert of hangt de bank, dan hoort het lid wat er werkelijk gebeurde -- een ander lid kan er niet bij, en een dubbele tik, een afgebroken verzoek of een crash boekt nooit dubbel',
  grens: 'De rail is de simulatiebank, achter de betaalwaarheid; de bankregie staat in zijn standaardstand (partner, clearing via de kaart-naad). Passen, spaardoel, de AI-bankier, de CSV-export en de eventstream zijn hier niet beproefd. De proef loopt de routes van de stand, niet de stand zelf, en kent geen Redis, PostgreSQL of geldmotor.',
  loop
};
