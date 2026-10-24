/* ============================================================================
   VOLTOOIPROEF: MIJN BESTELLINGEN (link:mijnmall, /apps/mijnmall.html) -- de
   vraagkant van de Mall.

   De belofte, in de woorden van kern/mall/aanvragen.js: "wat niemand aanbiedt,
   kun je vragen". Een lid zet een aanvraag uit; alleen zaken met het juiste vak
   in het juiste werkgebied zien hem; een zaak reageert met een toelichting en
   een prijs; het lid kiest; de gekozen zaak neemt hem in behandeling en rondt
   af met een antwoord dat het lid terugvindt. "Een aanvraag is geen boeking of
   betaling" -- en dat zegt het antwoord bij het kiezen ook.

   DRIE ACTOREN: het lid, de zaak met het juiste vak (een restaurant op Ibiza
   bij een vraag over eten op Ibiza) en een zaak met een ander vak die de vraag
   NIET mag zien. Beide zaken zijn synthetische leveranciers uit de seed van de
   testomgeving, met een medewerker die inlogt langs de echte zaakdeur.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, KANTOORWERELD } = require('../voltooiwereld');

const PLAATS = '/api/mall/aanvraag';
const MIJN = '/api/mall/aanvragen/mijn';
const KIES = '/api/mall/aanvraag/kies';
const WIJZIG = '/api/mall/aanvraag/wijzig';
const ZAAK_LIJST = '/api/supplier/mall/aanvragen';
const ZAAK_BEHANDEL = '/api/supplier/mall/aanvraag/behandel';
const ZAAK_REAGEER = '/api/supplier/mall/aanvraag/reageer';

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
  const merk = 'mm' + Date.now().toString(36);
  const lid = await nieuwLid(w, 'mml');
  const T = lid.token;
  const RESTAURANT = 'KIKUNOI', BAR = 'PONTO';
  let Z = null, a = null;
  const mijn = async (tok) => ((((await w.post(MIJN, {}, tok || T)).data) || {}).aanvragen || []).find((x) => x.id === a.id);
  const bijZaak = async (tok) => ((((await w.post(ZAAK_LIJST, {}, tok || Z)).data) || {}).aanvragen || []).find((x) => x.id === a.id);
  const lijf = { wat: 'Prive-kok voor een diner aan huis ' + merk, verdieping: 'eten', plek: 'Ibiza', budget: 600, sleutel: 'sl-' + merk };

  await stap('voltooibaar', 'het lid zet een vraag uit; hij staat bij hem als "wacht op reacties"', async () => {
    const r = await w.post(PLAATS, lijf, T);
    a = r.data && r.data.aanvraag;
    const m = a && await mijn();
    return { klopt: r.status === 200 && !!m && m.status === 'open' && m.van === 'u', ziet: 'plaatsen ' + r.status + ', ' + (m && m.statusLabel) };
  });

  await stap('bevoegd', 'het restaurant op Ibiza ziet de vraag op codenaam; een bar ziet hem niet en mag niet reageren', async () => {
    Z = await zaakSessie(w, RESTAURANT);
    const z = await bijZaak();
    const B = await zaakSessie(w, BAR);
    const b = await bijZaak(B);
    const poging = await w.post(ZAAK_REAGEER, { id: a.id, tekst: 'Wij doen dat ook', prijs: 100, versie: 1 }, B);
    return { klopt: !!z && z.van !== 'u' && !JSON.stringify(z).includes('Voltooilid') && !b && poging.status === 403,
      ziet: 'restaurant ziet de vraag van ' + (z && z.van) + '; bar ziet hem ' + (b ? 'WEL' : 'niet') + ', reageren ' + poging.status };
  });

  await stap('voltooibaar', 'het restaurant reageert met een toelichting en een prijs; het lid ziet de reactie', async () => {
    const z = await bijZaak();
    const r = await w.post(ZAAK_REAGEER, { id: a.id, tekst: 'Chef aan huis, vier gangen', prijs: 550, versie: z.versie }, Z);
    const m = await mijn();
    const re = m && m.reacties.find((x) => x.code === RESTAURANT);
    return { klopt: r.status === 200 && !!re && re.prijs === 550 && m.aantalReacties === 1, ziet: 'reageren ' + r.status + ', lid ziet: ' + (re ? re.zaak + ', ' + re.prijs : 'NIETS') };
  });

  await stap('voltooibaar', 'het lid kiest het restaurant; het antwoord zegt dat er niets geboekt of betaald is', async () => {
    const m0 = await mijn();
    const r = await w.post(KIES, { id: a.id, code: RESTAURANT, versie: m0.versie }, T);
    const m = await mijn();
    return { klopt: r.status === 200 && m.status === 'gegund' && /niets geboekt of betaald/.test(r.data.opmerking || '') && m.eigenaar,
      ziet: 'kiezen ' + r.status + ', ' + m.statusLabel + ', "' + (r.data && r.data.opmerking) + '"' };
  });

  await stap('voltooibaar', 'het restaurant neemt hem in behandeling en rondt af; het lid vindt het antwoord terug', async () => {
    const z0 = await bijZaak();
    const r1 = await w.post(ZAAK_BEHANDEL, { id: a.id, actie: 'aanvaard', versie: z0.versie }, Z);
    const z1 = await bijZaak();
    const r2 = await w.post(ZAAK_BEHANDEL, { id: a.id, actie: 'afronden', tekst: 'Chef bevestigd voor zaterdag ' + merk, versie: z1.versie }, Z);
    const m = await mijn();
    return { klopt: r1.status === 200 && r2.status === 200 && m.status === 'afgerond' && !!m.resultaat && m.resultaat.tekst.includes(merk),
      ziet: 'aanvaard ' + r1.status + ', afronden ' + r2.status + ', lid: ' + m.statusLabel };
  });

  await stap('voltooibaar', 'een handeling op een verouderde versie wordt geweigerd met de reden', async () => {
    const r = await w.post(WIJZIG, { id: a.id, versie: 1, wat: 'Toch iets anders ' + merk, verdieping: 'eten', plek: 'Ibiza' }, T);
    return { klopt: r.status === 409 && /gewijzigd|niet meer beschikbaar/.test(r.data.error), ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  /* ---------------- persistent ---------------- */
  const voor = JSON.stringify(await mijn());
  await w.herstart();
  Z = await zaakSessie(w, RESTAURANT);
  await stap('persistent', 'na een nette herstart is de aanvraag bij het lid gelijk, met het antwoord', async () => {
    const na = JSON.stringify(await mijn());
    return { klopt: voor.length > 2 && na === voor, ziet: na === voor ? 'gelijk' : 'ANDERS' };
  });
  await stap('persistent', 'het restaurant ziet na de herstart nog zijn afgeronde werk, en het lid in een nieuwe sessie', async () => {
    const z = await bijZaak();
    const m = await mijn(await inloggen(w, lid));
    return { klopt: !!z && z.status === 'afgerond' && !!m && m.status === 'afgerond', ziet: 'zaak: ' + (z && z.status) + ', nieuwe sessie: ' + (m && m.status) };
  });
  await stap('persistent', 'de aanvraag staat in de opslag zelf', async () => {
    const plek = w.vindInOpslag(a.id);
    return { klopt: plek.length >= 1, ziet: 'aanvraag in ' + plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op plaatsen (met de verzendsleutel van het scherm): een aanvraag, niet twee', async () => {
    const l2 = Object.assign({}, lijf, { wat: 'Fietsenmaker op Ibiza ' + merk, verdieping: 'eten', sleutel: 'sl2-' + merk });
    const [x, y] = await w.dubbel(PLAATS, l2, T);
    const n = ((((await w.post(MIJN, {}, T)).data) || {}).aanvragen || []).filter((v) => v.wat === l2.wat).length;
    return { klopt: x.status === 200 && geen5xx(y) && n === 1, ziet: 'antwoorden ' + x.status + '/' + y.status + ', ' + n + ' aanvraag' };
  });
  await stap('herstelbaar', 'een afgebroken plaatsing en opnieuw (zelfde sleutel): precies een aanvraag', async () => {
    const l3 = Object.assign({}, lijf, { wat: 'Wijnproeverij aan huis ' + merk, sleutel: 'sl3-' + merk });
    const half = await w.afgebroken(PLAATS, l3, T);
    const opnieuw = await w.post(PLAATS, l3, T);
    const n = ((((await w.post(MIJN, {}, T)).data) || {}).aanvragen || []).filter((v) => v.wat === l3.wat).length;
    return { klopt: opnieuw.status === 200 && n === 1, ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' aanvraag' };
  });
  await stap('herstelbaar', 'een crash direct na een reactie van de zaak: het lid ziet de reactie na de herstart', async () => {
    const lijst = ((((await w.post(MIJN, {}, T)).data) || {}).aanvragen || []);
    const v = lijst.find((x) => x.wat === 'Wijnproeverij aan huis ' + merk);
    const z = ((((await w.post(ZAAK_LIJST, {}, Z)).data) || {}).aanvragen || []).find((x) => x.id === v.id);
    const r = await w.post(ZAAK_REAGEER, { id: v.id, tekst: 'Sommelier beschikbaar', prijs: 300, versie: z && z.versie }, Z);
    await w.crash();
    const na = ((((await w.post(MIJN, {}, T)).data) || {}).aanvragen || []).find((x) => x.id === v.id);
    return { klopt: r.status === 200 && !!na && na.reacties.some((x) => x.code === RESTAURANT && x.prijs === 300), ziet: 'reageren ' + r.status + ', na SIGKILL ' + (na ? na.reacties.length : 0) + ' reactie' };
  });
  await stap('herstelbaar', 'een crash direct na het kiezen: gegund blijft gegund, en dezelfde keuze nog eens doet niets dubbel', async () => {
    Z = await zaakSessie(w, RESTAURANT);
    const v = ((((await w.post(MIJN, {}, T)).data) || {}).aanvragen || []).find((x) => x.wat === 'Wijnproeverij aan huis ' + merk);
    const lijfKies = { id: v.id, code: RESTAURANT, versie: v.versie };
    const r = await w.post(KIES, lijfKies, T);
    await w.crash();
    const herhaling = await w.post(KIES, lijfKies, T);
    const na = ((((await w.post(MIJN, {}, T)).data) || {}).aanvragen || []).find((x) => x.id === v.id);
    return { klopt: r.status === 200 && geen5xx(herhaling) && !!na && na.status === 'gegund' && na.reacties.filter((x) => x.gekozen).length === 1,
      ziet: 'kiezen ' + r.status + ', na SIGKILL ' + (na && na.status) + ', herhaling ' + herhaling.status };
  });
}

module.exports = {
  functie: 'link:mijnmall',
  ingang: '/apps/mijnmall.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een lid vraagt wat niemand aanbiedt, alleen zaken met het juiste vak in het juiste gebied zien het, het lid kiest een reactie en vindt het antwoord van de gekozen zaak terug -- zonder dat er iets geboekt of betaald is',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Beide zaken zijn synthetische leveranciers uit de seed van de testomgeving. De bestellingen, lijsten en bewaarde items op dit scherm zijn niet gelopen; ook het verlopen na dertig dagen niet (dat vraagt een klok die vooruit kan). Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
