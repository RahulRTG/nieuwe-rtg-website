/* ============================================================================
   VOLTOOIPROEF: MIJN STAD (link:stad, /apps/stad.html).

   De belofte, in de woorden van het scherm en kern/stad/bewoner.js: "Iets
   kapot of vol gezien? Meld het." De melding wordt METEEN een klus op de
   werklijst van de veldploeg; meldt de ploeg hem klaar, dan ziet de bewoner
   "opgelost". En de privacyzin die het scherm toont: "je melding hangt aan je
   codenaam en is alleen voor jou en de veldploeg zichtbaar".

   TWEE ACTOREN. Het lid meldt; het kantoor (de veldploeg leest /api/office/
   stad/werk) meldt klaar. Een tweede lid ziet de melding niet bij zich, en een
   gratis account zonder gezien paspoort mag kijken maar niet melden.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, KANTOORWERELD } = require('../voltooiwereld');

const BEWONER = '/api/stad/bewoner';
const MELD = '/api/stad/melding';
const WERK = '/api/office/stad/werk';
const KLAAR = '/api/office/stad/werk/klaar';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function loop(w, stap) {
  const merk = Date.now().toString(36).slice(-5);
  const A = await nieuwLid(w, 'sta');
  const B = await nieuwLid(w, 'stb');
  let T = A.token;
  const kantoor = async () => (await w.post('/api/office/login', { code: KANTOORWERELD.OFFICE_CODE })).data.token;
  let K = await kantoor();
  const beeld = async (tok) => ((await w.post(BEWONER, {}, tok || T)).data) || {};
  const mijn = async (tok) => ((await beeld(tok)).mijnMeldingen || []);
  const metTekst = (lijst, t) => lijst.filter((m) => m.tekst === t);
  const klussen = async () => ((((await w.post(WERK, {}, K)).data) || {}).klussen || []);
  let zones = [], melding = null;
  const tekst = 'lantaarn bij de brug ' + merk + ' doet het niet';

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'het lid ziet hoe de stad erbij staat: scenario, standen per domein en de zones om te melden', async () => {
    const b = await beeld();
    zones = b.zones || [];
    return { klopt: !!b.scenario && (b.domeinen || []).length >= 3 && zones.length >= 2 && !!b.soorten.licht && /codenaam/.test(b.privacy),
      ziet: b.scenario && b.scenario.label + ', ' + (b.domeinen || []).length + ' domeinen, ' + zones.length + ' zones' };
  });

  await stap('voltooibaar', 'een melding op een zone die niet bestaat, wordt geweigerd met de bestaande zones erbij', async () => {
    const r = await w.post(MELD, { zone: 'Nergenshuizen', soort: 'licht', tekst: 'ergens kapot' }, T);
    return { klopt: r.status === 400 && /bestaande zone/.test(r.data.error), ziet: r.status + ' (' + (r.data && r.data.error || '').slice(0, 70) + ')' };
  });

  await stap('voltooibaar', 'het lid meldt een kapotte lantaarn; de melding staat bij hem als open', async () => {
    const r = await w.post(MELD, { zone: zones[0], soort: 'licht', tekst }, T);
    melding = r.data && r.data.melding;
    const m = metTekst(await mijn(), tekst);
    return { klopt: r.status === 200 && !!melding && m.length === 1 && m[0].status === 'open',
      ziet: r.status + ', ' + (melding && melding.ref) + ', bij het lid: ' + (m[0] && m[0].status) };
  });

  await stap('voltooibaar', 'de melding staat meteen als klus op de werklijst van de veldploeg, met een werkorder en zonder codenaam van de melder', async () => {
    const k = (await klussen()).find((x) => x.sleutel === 'melding:' + melding.id);
    const codenaam = (((await w.post('/api/member/connections', {}, T)).data) || {}).codename;
    return { klopt: !!k && !!k.werkorder && k.omschrijving.includes(merk) && !JSON.stringify(k).includes(codenaam),
      ziet: k ? k.werkorder + ': ' + k.omschrijving.slice(0, 80) : 'NIET OP DE WERKLIJST' };
  });

  await stap('bevoegd', 'een ander lid ziet de melding niet bij zich, en kan hem niet klaarmelden', async () => {
    const b = metTekst(await mijn(B.token), tekst);
    const k = await w.post(KLAAR, { sleutel: 'melding:' + melding.id }, B.token);
    const nog = metTekst(await mijn(), tekst);
    return { klopt: b.length === 0 && k.status === 401 && nog[0] && nog[0].status === 'open',
      ziet: 'B ziet ' + b.length + ', klaarmelden door B ' + k.status + ' (' + (k.data && k.data.error) + '), bij A nog ' + (nog[0] && nog[0].status) };
  });

  await stap('voltooibaar', 'een gratis account zonder gezien paspoort mag kijken maar niet melden, en hoort hoe het wel kan', async () => {
    const G = await nieuwLid(w, 'stg', 'guest');
    const kijk = await w.post(BEWONER, {}, G.token);
    const r = await w.post(MELD, { zone: zones[0], soort: 'afval', tekst: 'container vol ' + merk }, G.token);
    return { klopt: kijk.status === 200 && r.status === 403 && /paspoort/.test(r.data.error),
      ziet: 'kijken ' + kijk.status + ', melden ' + r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  await stap('voltooibaar', 'de veldploeg meldt de klus klaar; het lid ziet zijn melding als opgelost', async () => {
    const k = await w.post(KLAAR, { sleutel: 'melding:' + melding.id, notitie: 'lamp vervangen' }, K);
    const m = metTekst(await mijn(), tekst);
    return { klopt: k.status === 200 && k.data.zaakGesloten === melding.ref && m[0] && m[0].status === 'klaar',
      ziet: 'klaar ' + k.status + ' (zaak gesloten ' + (k.data && k.data.zaakGesloten) + '), bij het lid: ' + (m[0] && m[0].status) };
  });

  /* ---------------- persistent ---------------- */
  const tweede = 'container vol bij de markt ' + merk;
  const m2 = (await w.post(MELD, { zone: zones[1], soort: 'afval', tekst: tweede }, T)).data;
  const voor = JSON.stringify(await mijn());
  await w.herstart();

  await stap('persistent', 'na een nette herstart staan beide meldingen er nog, met hun stand', async () => {
    const na = JSON.stringify(await mijn());
    return { klopt: !!(m2 && m2.melding) && voor.length > 2 && na === voor, ziet: na === voor ? 'gelijk (' + JSON.parse(na).length + ' meldingen)' : 'ANDERS: ' + na.slice(0, 100) };
  });

  await stap('persistent', 'een nieuwe sessie van het lid ziet dezelfde meldingen, en de open klus staat nog op de werklijst', async () => {
    T = await inloggen(w, A);
    K = await kantoor();
    const na = JSON.stringify(await mijn());
    const k = (await klussen()).find((x) => x.sleutel === 'melding:' + m2.melding.id);
    return { klopt: na === voor && !!k, ziet: (na === voor ? 'gelijk' : 'ANDERS') + ', klus ' + (k ? k.werkorder : 'WEG') };
  });

  await stap('persistent', 'de melding staat in de opslag zelf, aan de codenaam en niet aan een naam of e-mailadres', async () => {
    const plek = w.vindInOpslag(tekst).filter((p) => p.sleutel !== 'audit');
    const naam = w.vindInOpslag(A.email).filter((p) => plek.some((q) => q.sleutel === p.sleutel && q.tabel === p.tabel));
    return { klopt: plek.length >= 1 && naam.length === 0,
      ziet: 'melding in ' + plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') + '; e-mailadres in dezelfde collectie: ' + naam.length };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op "Meld": een melding, niet twee', async () => {
    const t = 'water op straat ' + merk;
    const [a, b] = await w.dubbel(MELD, { zone: zones[0], soort: 'water', tekst: t }, T);
    const n = metTekst(await mijn(), t).length;
    return { klopt: geen5xx(a) && geen5xx(b) && (a.status === 200 || b.status === 200) && n === 1,
      ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' melding(en)' };
  });

  await stap('herstelbaar', 'een afgebroken melding en opnieuw: precies een melding', async () => {
    const t = 'geluidsoverlast ' + merk;
    const half = await w.afgebroken(MELD, { zone: zones[1], soort: 'geluid', tekst: t }, T);
    const opnieuw = await w.post(MELD, { zone: zones[1], soort: 'geluid', tekst: t }, T);
    const n = metTekst(await mijn(), t).length;
    return { klopt: geen5xx(opnieuw) && n === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status +
        (opnieuw.data && opnieuw.data.samengevoegd ? ' (samengevoegd)' : '') + ', ' + n + ' melding' };
  });

  await stap('herstelbaar', 'een crash direct na het klaarmelden: de bewoner ziet opgelost, en de klus komt niet terug op de lijst', async () => {
    const k = await w.post(KLAAR, { sleutel: 'melding:' + m2.melding.id }, K);
    await w.crash();
    K = await kantoor();
    const m = metTekst(await mijn(), tweede);
    const nog = (await klussen()).find((x) => x.sleutel === 'melding:' + m2.melding.id);
    return { klopt: k.status === 200 && m[0] && m[0].status === 'klaar' && !nog,
      ziet: 'klaar ' + k.status + ', na SIGKILL bij het lid ' + (m[0] && m[0].status) + ', op de werklijst ' + (nog ? 'NOG' : 'niet meer') };
  });
}

module.exports = {
  functie: 'link:stad',
  ingang: '/apps/stad.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een bewoner ziet hoe de stad erbij staat en meldt iets dat kapot of vol is; de melding staat meteen op de werklijst van de veldploeg, hij volgt hem op codenaam, en ziet "opgelost" als de ploeg klaar is -- ook na een herstart, een dubbele tik, een afgebroken verzoek en een crash',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf; het live seintje over /api/stream is niet gelopen. De veldploeg is hier de gedeelde kantoorcode, geen veld-app. Samenvoegen van meldingen van verschillende bewoners over hetzelfde object is niet apart beproefd. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
