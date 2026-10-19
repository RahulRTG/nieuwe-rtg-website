/* ============================================================================
   VOLTOOIPROEF: RTF IN DE BUURT (link:rtfbuurt, /apps/foundation/os-publiek.html).

   De belofte van het scherm: wie in een stad woont, ziet welke RTF-afdeling er
   open is, wat er loopt, waar hij binnen kan lopen (met de vrije plekken) en
   welke landelijke campagne er is -- en niets meer dan wat je ook op een
   poster in het buurthuis zou hangen: geen budget, geen namen van
   begeleiders, geen getal over hulpvragen, en geen teller van wat er is
   opgehaald (kern/rtfos/publiek.js).

   DE WERELD. Het landelijke bestuur opent Zwolle, zet een project actief (langs
   de vierogen, ../voltooigezin.js), opent een buurtmaaltijd en een campagne met
   een sluitende verdeelsleutel. Deventer blijft in verkenning: die hoort niet
   zichtbaar te zijn. De lezer is de ouder van een gezin.

   ALLEEN LEZEN, EN DAT BEPAALT HERSTELBAAR. Het scherm schrijft niets; een
   dubbele tik, een afgebroken verzoek en een crash moeten hier hetzelfde beeld
   opleveren en de opslag niet raken.

   EEN ACCOUNT OOK OM TE LEZEN (besluit 19 oktober 2026, Toegang 66f413ff).
   De buurtroutes vragen een sessie die het huis kent: de ouder leest met zijn
   gratis account; zonder sessie is het 401. De openbare landing met de
   paspagina's is de enige leesuitzondering.
   ========================================================================== */
'use strict';
const { GEZINSWERELD, accountGezin, openStad, actiefProject } = require('../voltooigezin');

const STEDEN = '/api/rtfos/publiek/steden';
const STAD = '/api/rtfos/publiek/stad';
const CAMPAGNES = '/api/rtfos/publiek/campagnes';

async function loop(w, stap) {
  const merk = Date.now().toString(36);
  const zwolle = await openStad(w, 'Zwolle');
  const K = zwolle.kantoor;
  const deventer = ((await w.post('/api/rtfos/stad/maak', { naam: 'Deventer' }, K)).data || {}).stad;
  const project = await actiefProject(w, zwolle, 'Taalcafe De Wilg ' + merk, 'taal');
  await w.post('/api/rtfos/stad/module', { id: zwolle.id, vlag: 'events', aan: true }, K);
  const morgen = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const act = ((await w.post('/api/rtfos/activiteit/maak', { stad: zwolle.id, soort: 'buurtmaaltijd', naam: 'Buurtmaaltijd ' + merk,
    capaciteit: 12, wanneer: morgen, tijd: '18:00', locatie: 'Buurthuis De Wilg' }, K)).data || {}).activiteit;
  const open = await w.post('/api/rtfos/activiteit/open', { id: act && act.id }, K);
  if (open.status !== 200) throw new Error('de activiteit openen lukte niet (' + open.status + ': ' + (open.data && open.data.error) + ')');
  const camp = ((await w.post('/api/rtfos/campagne/maak', { naam: 'Warme winter ' + merk, doel: 'Dekens en soep voor wie het koud heeft.' }, K)).data || {}).campagne;
  await w.post('/api/rtfos/campagne/sleutel', { id: camp && camp.id, delen: [{ stad: zwolle.id, procent: 100, reden: 'eerste afdeling' }] }, K);
  const live = await w.post('/api/rtfos/campagne/status', { id: camp && camp.id, status: 'live' }, K);
  if (live.status !== 200) throw new Error('de campagne live zetten lukte niet (' + live.status + ')');
  const ouder = await accountGezin(w, 'buurt');
  const beeld = async () => {
    const s = (await w.post(STEDEN, {}, ouder.token)).data || {};
    const z = (await w.post(STAD, { id: zwolle.id }, ouder.token)).data || {};
    const c = (await w.post(CAMPAGNES, {}, ouder.token)).data || {};
    return JSON.stringify({ s: s.steden, z: [z.projecten, z.activiteiten], c: c.campagnes });
  };
  let eerste = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'de ouder ziet RTF Zwolle open met het soort werk dat er loopt, en Deventer (nog in verkenning) niet', async () => {
    const s = ((await w.post(STEDEN, {}, ouder.token)).data || {}).steden || [];
    const z = s.find((x) => x.id === zwolle.id) || {};
    return { klopt: !!z.id && (z.soorten || []).includes('taal') && !s.some((x) => deventer && x.id === deventer.id),
      ziet: s.length + ' stad(en): ' + s.map((x) => x.naam + ' (' + (x.soorten || []).join(', ') + ')').join('; ') };
  });

  await stap('voltooibaar', 'Zwolle toont het lopende project en de buurtmaaltijd met twaalf vrije plekken en zijn tijd en plek', async () => {
    const z = (await w.post(STAD, { id: zwolle.id }, ouder.token)).data || {};
    const p = (z.projecten || []).find((x) => x.naam === project.naam);
    const a = (z.activiteiten || []).find((x) => x.naam === 'Buurtmaaltijd ' + merk) || {};
    return { klopt: !!p && a.plekVrij === 12 && a.vol === false && a.wanneer === morgen && a.tijd === '18:00' && !!(z.meedoen && z.meedoen.hulp),
      ziet: (z.projecten || []).length + ' project, maaltijd op ' + a.wanneer + ' ' + a.tijd + ' met ' + a.plekVrij + ' plekken vrij' };
  });

  await stap('voltooibaar', 'de landelijke campagne staat erbij met de stad waar hij heen gaat, en zonder teller van wat er is opgehaald', async () => {
    const c = ((await w.post(CAMPAGNES, {}, ouder.token)).data || {}).campagnes || [];
    const x = c.find((y) => y.naam === 'Warme winter ' + merk) || {};
    const tekst = JSON.stringify(x);
    return { klopt: (x.steden || []).join() === 'Zwolle' && !/centen|opgehaald|bedrag|euro|totaal/i.test(tekst),
      ziet: c.length + ' campagne, naar ' + (x.steden || []).join(', ') + ', velden ' + Object.keys(x).join('/') };
  });

  await stap('voltooibaar', 'een stad in verkenning opent niet: de buurt hoort dat hij nog niet open is', async () => {
    const d = await w.post(STAD, { id: deventer && deventer.id }, ouder.token);
    return { klopt: d.status === 404 && /nog niet open/.test((d.data && d.data.error) || ''), ziet: d.status + ' (' + (d.data && d.data.error) + ')' };
  });

  /* Bevoegdheid. */
  await stap('voltooibaar', 'bevoegdheid: zonder account geeft de buurtpagina niets (401)', async () => {
    const s = await w.post(STEDEN, {}), z = await w.post(STAD, { id: zwolle.id }), c = await w.post(CAMPAGNES, {});
    return { klopt: [s.status, z.status, c.status].every((x) => x === 401),
      ziet: 'steden ' + s.status + ', stad ' + z.status + ', campagnes ' + c.status };
  });

  await stap('voltooibaar', 'bevoegdheid: de buurt ziet geen budget, geen projectleider, geen begeleiders en geen inschrijvingen', async () => {
    const z = JSON.stringify((await w.post(STAD, { id: zwolle.id }, ouder.token)).data || {});
    return { klopt: !/budget|leider|begeleider|inschrijving|deelnemers|kosten|user-\d/i.test(z),
      ziet: 'stadsantwoord van ' + z.length + ' tekens zonder interne velden' + (/budget|leider|begeleider|inschrijving|deelnemers|kosten|user-\d/i.test(z) ? ' -- NIET: ' + z.match(/budget|leider|begeleider|inschrijving|deelnemers|kosten|user-\d/i)[0] : '') };
  });

  await stap('voltooibaar', 'bevoegdheid: wat het kantoor stopt, verdwijnt meteen uit de buurt -- de buurt ziet nooit meer dan de stand van het kantoor', async () => {
    const tweede = await actiefProject(w, zwolle, 'Moestuin ' + merk, 'taal');
    const voor = (((await w.post(STAD, { id: zwolle.id }, ouder.token)).data || {}).projecten || []).some((x) => x.naam === tweede.naam);
    const st = await w.post('/api/rtfos/project/status', { id: tweede.id, status: 'gestopt' }, K);
    const na = (((await w.post(STAD, { id: zwolle.id }, ouder.token)).data || {}).projecten || []).some((x) => x.naam === tweede.naam);
    return { klopt: voor && st.status === 200 && !na, ziet: 'voor ' + voor + ', stoppen ' + st.status + ', daarna zichtbaar ' + na };
  });

  /* ---------------- persistent ---------------- */
  eerste = await beeld();
  await w.herstart();
  await stap('persistent', 'na een nette herstart ziet de buurt precies hetzelfde beeld', async () => {
    const na = await beeld();
    return { klopt: na === eerste && na.includes('Taalcafe De Wilg ' + merk), ziet: 'beeld ' + (na === eerste ? 'gelijk' : 'ANDERS') + ' (' + na.length + ' tekens)' };
  });

  await stap('persistent', 'een read-only lezer vindt het project, de maaltijd en de campagne in de opslag van RTF', async () => {
    const p = w.vindInOpslag('Taalcafe De Wilg ' + merk), a = w.vindInOpslag('Buurtmaaltijd ' + merk), c = w.vindInOpslag('Warme winter ' + merk);
    return { klopt: p.length > 0 && a.length > 0 && c.length > 0, ziet: 'project ' + p.length + ', maaltijd ' + a.length + ', campagne ' + c.length + ' vindplaats(en)' };
  });

  await stap('persistent', 'een andere ouder, met een eigen gezin en sessie, ziet hetzelfde beeld', async () => {
    const ander = await accountGezin(w, 'buurtander');
    const z = (await w.post(STAD, { id: zwolle.id }, ander.token)).data || {};
    return { klopt: (z.projecten || []).some((x) => x.naam === project.naam) && (z.activiteiten || []).length === 1,
      ziet: (z.projecten || []).length + ' project, ' + (z.activiteiten || []).length + ' activiteit' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op een stad geeft twee keer hetzelfde antwoord en schrijft niets', async () => {
    const voor = JSON.stringify(w.collectie('rtfos'));
    const [a, b] = await w.dubbel(STAD, { id: zwolle.id }, ouder.token);
    const na = JSON.stringify(w.collectie('rtfos'));
    return { klopt: a.status === 200 && b.status === 200 && JSON.stringify(a.data) === JSON.stringify(b.data) && voor === na,
      ziet: 'tikken ' + a.status + '/' + b.status + ', antwoorden ' + (JSON.stringify(a.data) === JSON.stringify(b.data) ? 'gelijk' : 'anders') + ', opslag ' + (voor === na ? 'onaangeroerd' : 'GERAAKT') };
  });

  await stap('herstelbaar', 'een afgebroken stadsverzoek en daarna opnieuw: hetzelfde beeld', async () => {
    const half = await w.afgebroken(STAD, { id: zwolle.id }, ouder.token);
    const na = await beeld();
    return { klopt: na === eerste, ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), beeld ' + (na === eerste ? 'gelijk' : 'ANDERS') };
  });

  await stap('herstelbaar', 'na een crash ziet de buurt hetzelfde beeld, met de vrije plekken ongewijzigd', async () => {
    await w.crash();
    const na = await beeld();
    const a = ((((await w.post(STAD, { id: zwolle.id }, ouder.token)).data) || {}).activiteiten || [])[0] || {};
    return { klopt: na === eerste && a.plekVrij === 12, ziet: 'na SIGKILL beeld ' + (na === eerste ? 'gelijk' : 'ANDERS') + ', ' + a.plekVrij + ' plekken vrij' };
  });
}

module.exports = {
  functie: 'link:rtfbuurt',
  ingang: '/apps/foundation/os-publiek.html',
  persona: 'gezin',
  omgeving: GEZINSWERELD,
  belofte: 'wie in een stad woont ziet welke RTF-afdeling open is, wat er loopt, waar hij binnen kan lopen met de vrije plekken en welke campagne er is -- en niets wat niet op een poster in het buurthuis zou hangen',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Het scherm leest alleen; herstelbaar is hier dat een dubbele tik, een afgebroken verzoek en een crash hetzelfde beeld geven en niets schrijven. De stad, het project, de maaltijd en de campagne maakt het landelijke bestuur langs het kantoor. De buurtroutes vragen een (gratis) account of een gezinsprofiel. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
