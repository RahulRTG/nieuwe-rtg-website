/* ============================================================================
   VOLTOOIPROEF: DE ZORGTAB IN DE APP (tab:zorg, /apps/app.html via #tab=zorg).

   GEEN EIGEN ADRES, WEL EEN ECHTE NAVIGATIESTAP. De zorgtab is een stand van
   de ledenapp; app-main-12a.js kent het adres `#tab=zorg` als sprong naar die
   stand, en de tabbalk heeft de knop `#tabZorg`. Het contract noemt die stap
   (`via`) en de delen die de tab tekenen (app-main-13, -14 en -15); gekoppeld
   wordt op hun routes en niet op de hele schil.

   De belofte van de tab: het lid ziet het zorgaanbod, boekt een behandeling en
   betaalt hem in een beweging (app-main-14 doet boeken en betalen achter
   elkaar), deelt zijn medische context apart en alleen met die ene kliniek
   (en stopt dat zelf), boekt een pakket, en annuleert wat hij niet meer wil.

   DE WERELD. De ouder van een gezin met een eigenaar-account dat RTG heeft
   gezien (het delen van medische context vraagt de paspoortdeur), met een kind
   van tien (../voltooigezin.js). Een ander lid is de kruisproef.

   LET OP, en dat staat ook in de grens: /api/care/betaal zet een boeking op
   betaald zonder dat er geld beweegt (kern/care/leden.js). Geld bouwt de echte
   betaling; deze proef meet tot dan dat "betaald" een keer gebeurt en blijft.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');
const { GEZINSWERELD, accountGezin } = require('../voltooigezin');

const CARE = '/api/care';
const MIJN = '/api/care/mijn';
const BOEK = '/api/care/boek';
const BETAAL = '/api/care/betaal';
const ANNULEER = '/api/care/annuleer';
const INTAKE_DEEL = '/api/care/intake/deel';
const INTAKE_STOP = '/api/care/intake/stop';
const PAKKETTEN = '/api/care/pakketten';
const PAKKET_BOEK = '/api/care/pakket/boek';
const PAKKET_BETAAL = '/api/care/pakket/betaal';
const PAKKET_MIJN = '/api/care/pakket/mijn';

async function loop(w, stap) {
  const merk = Date.now().toString(36);
  const ouder = await accountGezin(w, 'tabzorg', { kind: true });
  const vreemd = await nieuwLid(w, 'tabzorgvreemd');
  let tok = ouder.token;
  const ov = async (t) => ((await w.post(CARE, {}, t || tok)).data) || {};
  const mijn = async (t) => (((await w.post(MIJN, {}, t || tok)).data) || {}).boekingen || [];
  const aanbod = (await ov()).aanbieders || [];
  const a = aanbod.find((x) => (x.behandelingen || []).some((b) => (b.tijden || []).length >= 3)) || {};
  const beh = (a.behandelingen || []).find((b) => (b.tijden || []).length >= 3) || {};
  const dag = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const slot = (i, d) => ({ aanbiederId: a.id, behandelingId: beh.id, datum: dag(d || 10), tijd: (beh.tijden || [])[i] });
  /* Zoals app-main-14.js: boeken en meteen betalen. */
  const boekEnBetaal = async (s, t) => {
    const r = await w.post(BOEK, s, t || tok);
    const ref = r.data && r.data.boeking && r.data.boeking.ref;
    const p = ref ? await w.post(BETAAL, { ref }, t || tok) : { status: 0 };
    return { boek: r, betaal: p, ref };
  };
  const MEDISCH = 'Allergisch voor noten; lichte astma ' + merk;
  let eerste = null, intake = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'de zorgtab toont het aanbod met behandelaars en tijden, en nog geen eigen afspraken', async () => {
    const m = await mijn();
    return { klopt: aanbod.length > 0 && !!beh.id && (beh.tijden || []).length >= 3 && m.length === 0,
      ziet: aanbod.length + ' aanbieder(s), ' + beh.naam + ' met ' + (beh.tijden || []).length + ' tijden, ' + m.length + ' afspraken' };
  });

  await stap('voltooibaar', 'het lid kiest een tijd en boekt: de afspraak staat er geboekt en betaald', async () => {
    const r = await boekEnBetaal(slot(0));
    eerste = r.ref;
    const b = (await mijn()).find((x) => x.ref === r.ref) || {};
    return { klopt: r.boek.status === 200 && r.betaal.status === 200 && b.status === 'geboekt' && b.paid === true,
      ziet: 'boeken ' + r.boek.status + ', betalen ' + r.betaal.status + ', ' + b.status };
  });

  await stap('voltooibaar', 'het lid deelt medische context met alleen deze kliniek, ziet tot wanneer, en stopt het zelf', async () => {
    const d = await w.post(INTAKE_DEEL, { aanbiederId: a.id, medisch: MEDISCH }, tok);
    intake = d.data && d.data.intake;
    const zichtbaar = ((await ov()).intakes || []).some((x) => intake && x.id === intake.id);
    const ander = (aanbod.find((x) => x.id !== a.id) || {}).intakeActief;
    const s = await w.post(INTAKE_STOP, { id: intake && intake.id }, tok);
    const weg = !((await ov()).intakes || []).some((x) => intake && x.id === intake.id);
    return { klopt: d.status === 200 && !!(intake && intake.vervaltOp) && zichtbaar && !ander && s.status === 200 && weg,
      ziet: 'delen ' + d.status + ' tot ' + (intake && intake.vervaltOp) + ', zichtbaar ' + zichtbaar + ', stoppen ' + s.status + ', daarna weg ' + weg };
  });

  await stap('voltooibaar', 'het lid boekt een pakket en betaalt het; het staat betaald onder zijn pakketten', async () => {
    const pk = ((((await w.post(PAKKETTEN, {}, tok)).data) || {}).pakketten || []).find((x) => (x.tijden || []).length) ||
      ((((await w.post(PAKKETTEN, {}, tok)).data) || {}).pakketten || [])[0] || {};
    const tijd = (pk.tijden || [])[0] || (beh.tijden || [])[2];
    const r = await w.post(PAKKET_BOEK, { pakketId: pk.id, datum: dag(15), tijd }, tok);
    const ref = r.data && r.data.pakket && r.data.pakket.ref;
    const p = await w.post(PAKKET_BETAAL, { ref }, tok);
    const m = (((await w.post(PAKKET_MIJN, {}, tok)).data) || {}).pakketten || [];
    return { klopt: r.status === 200 && p.status === 200 && m.some((x) => x.ref === ref && x.paid),
      ziet: 'pakket ' + (pk.naam || pk.id) + ': boeken ' + r.status + ', betalen ' + p.status + ', betaald in de lijst ' + m.some((x) => x.ref === ref && x.paid) };
  });

  await stap('voltooibaar', 'het lid annuleert een afspraak: hij verdwijnt en het tijdslot komt vrij voor een ander', async () => {
    const r = await boekEnBetaal(slot(1));
    const x = await w.post(ANNULEER, { ref: r.ref }, tok);
    const weg = !(await mijn()).some((y) => y.ref === r.ref);
    const vrij = await w.post(BOEK, slot(1), vreemd.token);
    return { klopt: x.status === 200 && weg && vrij.status === 200, ziet: 'annuleren ' + x.status + ', weg ' + weg + ', een ander boekt het slot ' + vrij.status };
  });

  /* Bevoegdheid. */
  await stap('voltooibaar', 'bevoegdheid: zonder account geen aanbod met eigen stand, geen boeking en geen betaling (401)', async () => {
    const o = await w.post(CARE, {}), b = await w.post(BOEK, slot(2)), p = await w.post(BETAAL, { ref: eerste });
    return { klopt: o.status === 401 && b.status === 401 && p.status === 401, ziet: 'aanbod ' + o.status + ', boeken ' + b.status + ', betalen ' + p.status };
  });

  await stap('voltooibaar', 'bevoegdheid: een ander lid ziet de afspraak niet, annuleert hem niet en stopt geen deling van het lid', async () => {
    const z = (await mijn(vreemd.token)).some((x) => x.ref === eerste);
    const x = await w.post(ANNULEER, { ref: eerste }, vreemd.token);
    const d = await w.post(INTAKE_DEEL, { aanbiederId: a.id, medisch: 'Nieuwe deling ' + merk }, tok);
    const s = await w.post(INTAKE_STOP, { id: d.data && d.data.intake && d.data.intake.id }, vreemd.token);
    const nog = ((await ov()).intakes || []).length;
    return { klopt: !z && x.status === 404 && s.status === 404 && nog === 1 && (await mijn()).some((y) => y.ref === eerste),
      ziet: 'ander lid ziet hem ' + z + ', annuleren ' + x.status + ', deling stoppen ' + s.status + ', deling staat nog: ' + nog };
  });

  await stap('voltooibaar', 'bevoegdheid: het kind van het gezin boekt geen zorg met zijn gezinssessie', async () => {
    const b = await w.post(BOEK, slot(2), ouder.kind.token);
    const o = await w.post(MIJN, { code: ouder.kind.code, token: ouder.kind.token });
    return { klopt: b.status === 401 && o.status === 401, ziet: 'boeken met het kindertoken ' + b.status + ', afspraken met code+token ' + o.status };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat de eerste afspraak betaald en de nieuwe deling actief', async () => {
    const b = (await mijn()).find((x) => x.ref === eerste) || {};
    const i = (await ov()).intakes || [];
    return { klopt: b.paid === true && b.status === 'geboekt' && i.length === 1, ziet: 'afspraak ' + b.status + ', ' + i.length + ' deling' };
  });

  /* De medische context van een intake (art. 9 AVG) staat per veld versleuteld,
     gebonden aan de rij (kern/care/intakesleutel.js) -- ook zonder RTG_ENC_KEY. */
  await stap('persistent', 'een read-only lezer vindt de boeking in de opslag, en de medische context nergens leesbaar', async () => {
    const r = w.vindInOpslag(eerste);
    const kaal = w.opslag('store.db', 'SELECT key FROM kv WHERE deleted = 0 AND val LIKE ?', '%Nieuwe deling ' + merk + '%');
    const ontsleuteld = w.vindInOpslag('Nieuwe deling ' + merk);
    return { klopt: r.length > 0 && kaal.length === 0 && ontsleuteld.length === 0,
      ziet: 'boeking in ' + r.length + ' vindplaats(en); medische context leesbaar: ' + kaal.length + ' (ook met de opslagsleutel: ' + ontsleuteld.length + ')' };
  });

  await stap('persistent', 'na de herstart logt het lid opnieuw in en ziet in een nieuwe sessie dezelfde afspraak', async () => {
    tok = await inloggen(w, ouder);
    const b = (await mijn()).find((x) => x.ref === eerste) || {};
    return { klopt: b.paid === true, ziet: 'nieuwe sessie: ' + b.status };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op Boeken op hetzelfde tijdslot geeft een afspraak; de tweede hoort dat het slot bezet is', async () => {
    const [x, y] = await w.dubbel(BOEK, slot(2), tok);
    const st = [x.status, y.status].sort().join();
    const n = (await mijn()).filter((b) => b.datum === slot(2).datum && b.tijd === slot(2).tijd).length;
    return { klopt: st === '200,409' && n === 1, ziet: 'tikken ' + x.status + '/' + y.status + ', ' + n + ' afspraak op dat slot' };
  });

  await stap('herstelbaar', 'een dubbele tik op Betalen betaalt een keer', async () => {
    const b = (await mijn()).find((z) => z.datum === slot(2).datum && z.tijd === slot(2).tijd) || {};
    const [x, y] = await w.dubbel(BETAAL, { ref: b.ref }, tok);
    const na = (await mijn()).find((z) => z.ref === b.ref) || {};
    return { klopt: [x.status, y.status].sort().join() === '200,409' && na.paid === true, ziet: 'tikken ' + x.status + '/' + y.status + ', ' + na.status };
  });

  await stap('herstelbaar', 'een afgebroken annulering en daarna opnieuw: geannuleerd, en een keer', async () => {
    const r = await boekEnBetaal(slot(0, 12));
    const half = await w.afgebroken(ANNULEER, { ref: r.ref }, tok);
    const opnieuw = await w.post(ANNULEER, { ref: r.ref }, tok);
    const weg = !(await mijn()).some((y) => y.ref === r.ref);
    return { klopt: (opnieuw.status === 200 || opnieuw.status === 409) && weg,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', weg ' + weg };
  });

  await stap('herstelbaar', 'een crash direct na boeken en betalen verliest de afspraak niet', async () => {
    const r = await boekEnBetaal(slot(1, 13));
    await w.crash();
    const b = (await mijn()).find((y) => y.ref === r.ref) || {};
    return { klopt: r.betaal.status === 200 && b.paid === true, ziet: 'betalen ' + r.betaal.status + ', na SIGKILL ' + b.status };
  });
}

module.exports = {
  functie: 'tab:zorg',
  ingang: '/apps/app.html',
  persona: 'gezin',
  omgeving: GEZINSWERELD,
  belofte: 'het lid ziet het zorgaanbod, boekt en betaalt een behandeling of pakket, deelt medische context apart met een kliniek en stopt dat zelf, en annuleert wat hij niet meer wil -- een ander lid of een kind kan er niets mee',
  grens: 'De proef loopt over de routes die de zorgtab (app-main-13, -14 en -15) aanroept, niet door de app zelf; de tab bereik je via #tab=zorg of de knop in de tabbalk. Betalen bij Care zet een boeking op betaald zonder dat er geld beweegt (kern/care/leden.js); dat is hier niet beproefd en ligt bij Geld. Wat de kliniek met een gedeelde intake ziet, toetst test/care-intake-versleuteld.test.js. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
