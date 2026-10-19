/* ============================================================================
   VOLTOOIPROEF: HULP & ZORG VOOR HET GEZIN (link:foundationzorg, /apps/foundation/zorg.html).

   De belofte van het scherm: twee gescheiden bronnen rustig samen. Van RTG
   Care de eigen afspraken (betalen en annuleren) en de lopende intakes; van de
   Foundation de gezondheidskaart van het gezin (wie wanneer naar de dokter
   moet, welke medicijnen er vandaag nog gegeven worden); en een hulpwijzer die
   meedenkt zonder de tekst te bewaren.

   DE WERELD. De ouder van een gezin met een eigenaar-account dat RTG heeft
   gezien, met een kind van tien (../voltooigezin.js). De ouder boekt bij Care
   met zijn ledensessie (/api/care/boek, de route van de Care-app; zorg.html
   toont, betaalt en annuleert) en zet een doktersafspraak op de kaart van zijn
   kind langs de route van de gezondheidskaart. Een ander lid en een ander gezin
   zijn de kruisproef.

   ECHT GELD. /api/care/betaal betaalt via RTG Pay aan de zaak van de
   aanbieder (kern/care/leden.js careBetaal); de proef leest op /api/pay/overzicht
   dat er precies een zorgregel van prijs x 100 centen afging, en dat een
   geweigerde bijlading de boeking op wacht-op-betaling laat zonder dat er iets
   afgaat (../voltooizorggeld.js). De ouder heeft een RTG Pass: Care boekt niet
   met een gratis account, en RTG Pay vraagt een gebonden toestel.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, gebondenToestel } = require('../voltooiwereld');
const { autolaadAfloop, geldVan, vulWallet } = require('../voltooizorggeld');
const { GEZINSWERELD, accountGezin, haal } = require('../voltooigezin');

const CARE = '/api/care';
const CARE_MIJN = '/api/care/mijn';
const CARE_BOEK = '/api/care/boek';
const CARE_BETAAL = '/api/care/betaal';
const CARE_ANNULEER = '/api/care/annuleer';
const HULP_AI = '/api/foundation/hulp/ai';
const GEZONDHEID = (code) => '/api/foundation/gezin/' + encodeURIComponent(code) + '/gezondheid';
const AFSPRAAK = '/api/foundation/gezin/gezondheid/afspraak';
const TOESTEMMING = '/api/foundation/gezin/toestemming/gezondheid';

async function loop(w, stap) {
  const merk = Date.now().toString(36);
  const ouder = await accountGezin(w, 'zorg', { kind: true, tier: 'rtg' }); // Care boekt alleen met een pas (kern/care/leden.js)
  const ander = await accountGezin(w, 'zorgander');
  const vreemd = await nieuwLid(w, 'zorgvreemd');
  let tok = ouder.token;
  let toestel = await gebondenToestel(w, tok);
  const geld = geldVan(w, () => toestel, () => tok);
  const codenaam = (await geld.overzicht()).codenaam;
  await vulWallet(w, tok, toestel, codenaam, 60000);
  const mijn = async (t) => (((await w.post(CARE_MIJN, {}, t || tok)).data) || {}).boekingen || [];
  const aanbod = ((await w.post(CARE, {}, tok)).data || {}).aanbieders || [];
  const a = aanbod.find((x) => (x.behandelingen || []).some((b) => (b.tijden || []).length >= 3)) || {};
  const beh = (a.behandelingen || []).find((b) => (b.tijden || []).length >= 3) || {};
  const dag = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
  const slot = (i) => ({ aanbiederId: a.id, behandelingId: beh.id, datum: dag, tijd: (beh.tijden || [])[i] });
  const DOKTER = 'Controle bij de kinderarts ' + merk;
  const G = { code: ouder.gezin.code, token: ouder.gezin.token };
  const kaart = async (s) => (await haal(w, GEZONDHEID((s || ouder.gezin).code), (s || ouder.gezin).token));
  let boeking = null, tweede = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'de ouder ziet het zorgaanbod van Care en nog geen eigen afspraken', async () => {
    const m = await mijn();
    return { klopt: aanbod.length > 0 && !!beh.id && m.length === 0, ziet: aanbod.length + ' aanbieder(s), behandeling ' + beh.naam + ', ' + m.length + ' afspraken' };
  });

  await stap('voltooibaar', 'de ouder boekt een behandeling en betaalt hem vanuit Hulp & Zorg: hij staat als geboekt', async () => {
    const b = await w.post(CARE_BOEK, slot(0), tok);
    boeking = b.data && b.data.boeking;
    const voor = (await mijn()).find((x) => boeking && x.ref === boeking.ref) || {};
    const saldoVoor = (await geld.overzicht()).saldo;
    const p = await w.post(CARE_BETAAL, { ref: boeking && boeking.ref }, tok);
    const na = (await mijn()).find((x) => boeking && x.ref === boeking.ref) || {};
    const o = await geld.overzicht();
    const z = (o.geschiedenis || []).filter((g) => g.soort === 'zorg');
    const centen = Math.round(Number(boeking && boeking.prijs) * 100);
    return { klopt: b.status === 200 && voor.status === 'wacht-op-betaling' && p.status === 200 && na.paid === true && na.status === 'geboekt' &&
      z.length === 1 && z[0].centen === -centen && saldoVoor - o.saldo === centen,
      ziet: 'boeken ' + b.status + ' (' + voor.status + '), betalen ' + p.status + ', daarna ' + na.status + '; RTG Pay: ' + z.length + ' zorgregel van ' + (z[0] && z[0].centen) + ' centen aan ' + (z[0] && z[0].tegen) + ', saldo ' + saldoVoor + ' -> ' + o.saldo };
  });

  await stap('voltooibaar', 'een lid met een lege wallet wiens bijlading de bank weigert: de afspraak blijft wacht-op-betaling en er gaat niets af', async () => {
    /* De bank kiest de afloop uit de sleutel ('care:<ref>:autolaad'); de proef
       boekt tot de bijlading van een boeking volgens de bank NIET doorgaat, en
       annuleert de rest. Zo is de weigering reproduceerbaar en geen geluk. */
    const leeg = await nieuwLid(w, 'zorgleeg');
    const lt = await gebondenToestel(w, leeg.token);
    const lg = geldVan(w, () => lt, () => leeg.token);
    const cn = (await lg.overzicht()).codenaam;
    let bk = null, soort = null;
    for (let i = 0; i < 60 && !bk; i++) {
      const b = ((await w.post(CARE_BOEK, Object.assign(slot(2), { datum: new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10) }), leeg.token)).data || {}).boeking;
      if (!b) break;
      const a = autolaadAfloop(cn, b.ref);
      if (a === 'geweigerd' || a === 'traag') { bk = b; soort = a; } else await w.post(CARE_ANNULEER, { ref: b.ref }, leeg.token);
    }
    const p = await w.post(CARE_BETAAL, { ref: bk && bk.ref }, leeg.token);
    const na = (((await w.post(CARE_MIJN, {}, leeg.token)).data || {}).boekingen || []).find((x) => bk && x.ref === bk.ref) || {};
    const o = await lg.overzicht();
    const z = (o.geschiedenis || []).filter((g) => g.soort === 'zorg');
    return { klopt: !!bk && p.status === 402 && na.paid === false && na.status === 'wacht-op-betaling' && z.length === 0 && o.saldo === 0,
      ziet: 'bijlading ' + soort + ': betalen ' + p.status + ' (' + (p.data && p.data.error) + '), afspraak ' + na.status + ', ' + z.length + ' zorgregels, saldo ' + o.saldo };
  });

  await stap('voltooibaar', 'de ouder annuleert een tweede afspraak: hij verdwijnt en het tijdslot komt vrij voor een ander', async () => {
    const b = await w.post(CARE_BOEK, slot(1), tok);
    tweede = b.data && b.data.boeking;
    const x = await w.post(CARE_ANNULEER, { ref: tweede && tweede.ref }, tok);
    const weg = !(await mijn()).some((y) => tweede && y.ref === tweede.ref);
    const vrij = await w.post(CARE_BOEK, slot(1), vreemd.token);
    return { klopt: b.status === 200 && x.status === 200 && weg && vrij.status === 200,
      ziet: 'boeken ' + b.status + ', annuleren ' + x.status + ', weg ' + weg + ', een ander boekt het slot ' + vrij.status };
  });

  await stap('voltooibaar', 'de ouder geeft toestemming voor gezondheidsgegevens, zet een doktersafspraak op de kaart van zijn kind, en Hulp & Zorg toont hem als de volgende', async () => {
    /* Gezondheid is een bijzonder persoonsgegeven (art. 9 AVG): zonder
       toestemming van een ouder weigert de kaart, en dat is goed. */
    const zonder = await w.post(AFSPRAAK, Object.assign({ voor: ouder.kind.profielId, wat: 'Zonder toestemming', datum: dag }, G));
    const t = await w.post(TOESTEMMING, Object.assign({ aan: true }, G));
    const z = await w.post(AFSPRAAK, Object.assign({ voor: ouder.kind.profielId, wat: DOKTER, datum: dag, tijd: '09:30', waar: 'Isala' }, G));
    const k = (await kaart()).data || {};
    const kind = (k.personen || []).find((p) => p.pid === ouder.kind.profielId) || {};
    return { klopt: zonder.status === 409 && t.status === 200 && z.status === 200 && kind.volgende && kind.volgende.wat === DOKTER && kind.volgende.datum === dag,
      ziet: 'zonder toestemming ' + zonder.status + ', toestemming ' + t.status + ', afspraak ' + z.status + ', volgende bij het kind: ' + (kind.volgende && kind.volgende.wat) };
  });

  await stap('voltooibaar', 'de hulpwijzer denkt mee met het gezin, en bewaart de vraag niet', async () => {
    const VRAAG = 'Mijn zoon slaapt slecht sinds de verhuizing ' + merk;
    const r = await w.post(HULP_AI, Object.assign({ kind: 'hulp', messages: [{ role: 'user', content: VRAAG }] }, G));
    return { klopt: r.status === 200 && typeof r.data.text === 'string' && r.data.text.length > 10 && w.vindInOpslag(VRAAG).length === 0,
      ziet: 'hulpwijzer ' + r.status + (r.data && r.data.demo ? ' (zonder model: de vaste terugval)' : '') + ', vraag in de opslag: ' + w.vindInOpslag(VRAAG).length };
  });

  /* Bevoegdheid. */
  await stap('voltooibaar', 'bevoegdheid: zonder account geen afspraken en geen betaling (401), en zonder gezinssessie geen kaart of hulpwijzer', async () => {
    const m = await w.post(CARE_MIJN, {});
    const p = await w.post(CARE_BETAAL, { ref: boeking && boeking.ref });
    const k = await haal(w, GEZONDHEID(ouder.gezin.code), null);
    const h = await w.post(HULP_AI, { kind: 'hulp', messages: [{ role: 'user', content: 'x' }] });
    /* De gezinsdeur zegt zonder code en token 403 of 404 ("dit gezin kennen we
       niet"), geen 401: zo antwoordt familieVan() in heel de Foundation. Wat
       telt is dat er niets uitkomt. */
    const leeg = (r) => r.status >= 401 && r.status <= 404 && !JSON.stringify(r.data || {}).includes('personen');
    return { klopt: m.status === 401 && p.status === 401 && leeg(k) && leeg(h) && !(h.data && h.data.text),
      ziet: 'afspraken ' + m.status + ', betalen ' + p.status + ', kaart ' + k.status + ', hulpwijzer ' + h.status };
  });

  await stap('voltooibaar', 'bevoegdheid: een ander lid annuleert de afspraak van de ouder niet, en een ander gezin leest zijn kaart niet', async () => {
    const x = await w.post(CARE_ANNULEER, { ref: boeking && boeking.ref }, vreemd.token);
    const nog = (await mijn()).some((y) => boeking && y.ref === boeking.ref);
    const k = await haal(w, GEZONDHEID(ouder.gezin.code), ander.gezin.token);
    const z = await w.post(AFSPRAAK, { code: ouder.gezin.code, token: ander.gezin.token, voor: ouder.kind.profielId, wat: 'Van een ander gezin', datum: dag });
    return { klopt: x.status === 404 && nog && k.status >= 401 && k.status <= 403 && z.status >= 401 && z.status <= 403 && !JSON.stringify(k.data || {}).includes(DOKTER),
      ziet: 'annuleren door een ander lid ' + x.status + ', kaart met het token van een ander gezin ' + k.status + ', schrijven ' + z.status };
  });

  await stap('voltooibaar', 'bevoegdheid: het kind boekt geen zorg en zet niets op de kaart van zijn ouder', async () => {
    const b = await w.post(CARE_BOEK, slot(2), ouder.kind.token);
    const z = await w.post(AFSPRAAK, { code: ouder.kind.code, token: ouder.kind.token, voor: ouder.gezin.profielId, wat: 'Door het kind', datum: dag });
    return { klopt: b.status === 401 && z.status === 403, ziet: 'boeken met het kindertoken ' + b.status + ', afspraak op de kaart van de ouder ' + z.status };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat de afspraak betaald en de doktersafspraak op de kaart', async () => {
    const b = (await mijn()).find((x) => boeking && x.ref === boeking.ref) || {};
    const kind = ((((await kaart()).data) || {}).personen || []).find((p) => p.pid === ouder.kind.profielId) || {};
    return { klopt: b.paid === true && b.status === 'geboekt' && kind.volgende && kind.volgende.wat === DOKTER,
      ziet: 'afspraak ' + b.status + ', volgende bij het kind ' + (kind.volgende && kind.volgende.wat) };
  });

  await stap('persistent', 'een read-only lezer vindt de boeking in de opslag; de doktersafspraak staat er nergens leesbaar in en komt toch terug', async () => {
    const r = w.vindInOpslag(boeking && boeking.ref);
    const kaal = w.opslag('store.db', "SELECT key FROM kv WHERE deleted = 0 AND val LIKE ?", '%' + DOKTER + '%');
    const ontsleuteld = w.vindInOpslag(DOKTER);
    const terug = JSON.stringify(((await kaart()).data) || {}).includes(DOKTER);
    return { klopt: r.length > 0 && kaal.length === 0 && ontsleuteld.length === 0 && terug,
      ziet: 'boeking in ' + r.length + ' vindplaats(en); doktersafspraak leesbaar in de opslag: ' + kaal.length + ' (ook na de opslagsleutel: ' + ontsleuteld.length + '), via de kaart terug: ' + terug };
  });

  await stap('persistent', 'na de herstart logt de ouder opnieuw in en ziet in een nieuwe sessie dezelfde afspraak', async () => {
    tok = await inloggen(w, ouder);
    toestel = await gebondenToestel(w, tok);
    const b = (await mijn()).find((x) => boeking && x.ref === boeking.ref) || {};
    const z = await geld.regels();
    return { klopt: b.paid === true && z.length === 1, ziet: 'nieuwe sessie: afspraak ' + b.status + ', RTG Pay ' + z.length + ' zorgregel' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op Betalen betaalt een keer, en de tweede tik zegt dat het al betaald is', async () => {
    const b = ((await w.post(CARE_BOEK, slot(2), tok)).data || {}).boeking || {};
    const voor = (await geld.regels()).length;
    const [x, y] = await w.dubbel(CARE_BETAAL, { ref: b.ref }, tok);
    const st = [x.status, y.status].sort().join();
    const na = (await mijn()).find((z) => z.ref === b.ref) || {};
    const erbij = (await geld.regels()).length - voor;
    return { klopt: st === '200,409' && na.paid === true && erbij === 1, ziet: 'tikken ' + x.status + '/' + y.status + ', ' + na.status + ', RTG Pay +' + erbij + ' zorgregel' };
  });

  await stap('herstelbaar', 'een dubbele tik op Annuleren annuleert een keer', async () => {
    const b = ((await w.post(CARE_BOEK, slot(3) && slot(3).tijd ? slot(3) : Object.assign(slot(0), { datum: new Date(Date.now() + 11 * 864e5).toISOString().slice(0, 10) }), tok)).data || {}).boeking || {};
    const [x, y] = await w.dubbel(CARE_ANNULEER, { ref: b.ref }, tok);
    const st = [x.status, y.status].sort().join();
    return { klopt: !!b.ref && st === '200,409' && !(await mijn()).some((z) => z.ref === b.ref), ziet: 'tikken ' + x.status + '/' + y.status };
  });

  await stap('herstelbaar', 'een afgebroken betaling en daarna opnieuw: betaald, en een keer', async () => {
    const b = ((await w.post(CARE_BOEK, Object.assign(slot(1), { datum: new Date(Date.now() + 12 * 864e5).toISOString().slice(0, 10) }), tok)).data || {}).boeking || {};
    const voor = (await geld.regels()).length;
    const half = await w.afgebroken(CARE_BETAAL, { ref: b.ref }, tok);
    const opnieuw = await w.post(CARE_BETAAL, { ref: b.ref }, tok);
    const na = (await mijn()).find((z) => z.ref === b.ref) || {};
    const erbij = (await geld.regels()).length - voor;
    return { klopt: (opnieuw.status === 200 || opnieuw.status === 409) && na.paid === true && erbij === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + (opnieuw.status === 409 ? ' (' + (opnieuw.data && opnieuw.data.error) + ')' : '') + ', ' + na.status + ', RTG Pay +' + erbij + ' zorgregel' };
  });

  await stap('herstelbaar', 'een crash direct na een betaling verliest hem niet', async () => {
    const b = ((await w.post(CARE_BOEK, Object.assign(slot(2), { datum: new Date(Date.now() + 13 * 864e5).toISOString().slice(0, 10) }), tok)).data || {}).boeking || {};
    const voor = (await geld.regels()).length;
    const p = await w.post(CARE_BETAAL, { ref: b.ref }, tok);
    await w.crash();
    const na = (await mijn()).find((z) => z.ref === b.ref) || {};
    const nog = await w.post(CARE_BETAAL, { ref: b.ref }, tok);
    const erbij = (await geld.regels()).length - voor;
    return { klopt: p.status === 200 && na.paid === true && nog.status === 409 && erbij === 1,
      ziet: 'betalen ' + p.status + ', na SIGKILL ' + na.status + ', nog eens betalen ' + nog.status + ', RTG Pay +' + erbij + ' zorgregel' };
  });
}

module.exports = {
  functie: 'link:foundationzorg',
  ingang: '/apps/foundation/zorg.html',
  persona: 'gezin',
  omgeving: Object.assign({ RTG_SIMULATIEBANK: '1' }, GEZINSWERELD),
  belofte: 'het gezin ziet zijn zorgafspraken (betalen, annuleren) en de gezondheidskaart van het gezin bij elkaar, en een hulpwijzer denkt mee zonder de tekst te bewaren -- een ander lid, een ander gezin of het kind kan er niets mee',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf; boeken (/api/care/boek) en de doktersafspraak zetten lopen langs de routes van de Care-app en de gezondheidskaart. Betalen loopt via RTG Pay tegen de simulatiebank (geen echte bank); de wallet wordt vooraf gevuld, en een geweigerde bijlading is reproduceerbaar uit de sleutel gekozen. De ouder heeft een RTG Pass: Care boekt niet met een gratis account. De hulpwijzer antwoordt zonder model met de vaste terugval. Intakes delen loopt hier niet mee. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
