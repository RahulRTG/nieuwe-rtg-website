/* ============================================================================
   VOLTOOIPROEF: POST VAN RTG (link:post, /apps/mijn-post.html).

   De belofte, in de woorden van server/kern/identiteit/commercieel.js: alles
   staat UIT tot het lid het aanzet, zetten en intrekken komen met tijdstip en
   herkomst in een geschiedenis die aangroeit en nooit wordt herschreven, en
   afmelden is net zo makkelijk als aanmelden. Dat is geen voorkeur maar een
   wettelijke toestemming: bij een klacht is de vraag "wanneer zei hij ja, en
   waar" -- en een intrekking die een crash niet overleeft, is een aanbieding
   die zonder toestemming de deur uitgaat.

   WAT DEZE KETEN MET OPZET NIET BEWEERT. Er is geen tweede actor die de
   toestemming LEEST: `commercieel.mag()` heeft vandaag geen aanroeper (gezocht
   op 11 oktober 2026, graad vermoed -- lexicaal). Of een verzender zich aan de
   stand houdt is dus niet te meten, en dat staat in `grens` in plaats van dat
   er een schakel voor wordt verzonnen.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');

const STAND = '/api/mijn/post';
const ZET = '/api/mijn/post/zet';
const ALLES_UIT = '/api/mijn/post/alles-uit';
const GESCHIEDENIS = '/api/mijn/post/geschiedenis';
const BRON = 'voltooiproef';

const soort = (st, id) => st && st.data && (st.data.soorten || []).find((s) => s.id === id);
const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function loop(w, stap) {
  const lid = await nieuwLid(w, 'pst');
  const A = lid.token;
  let geschiedenisVoor = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een nieuw lid begint met alles uit: afwezigheid is geen toestemming', async () => {
    const st = await w.post(STAND, {}, A);
    const aan = st.data ? (st.data.soorten || []).filter((s) => s.aan).length : -1;
    return { klopt: st.status === 200 && aan === 0 && (st.data.soorten || []).length > 0 && (st.data.altijd || []).length > 0,
      ziet: (st.data && st.data.soorten || []).length + ' soorten, ' + aan + ' aan, ' + (st.data && st.data.altijd || []).length + ' die nooit uit kunnen' };
  });

  await stap('voltooibaar', 'het lid geeft toestemming voor aanbiedingen per e-mail en sms, met herkomst', async () => {
    const r = await w.post(ZET, { soort: 'aanbiedingen', kanalen: ['email', 'sms'], bron: BRON }, A);
    const s = soort(await w.post(STAND, {}, A), 'aanbiedingen');
    return { klopt: r.status === 200 && !!s && s.aan && s.kanalen.join(',') === 'email,sms' && s.gegevenVia === 'scherm:' + BRON && !!s.sinds,
      ziet: 'aan=' + (s && s.aan) + ', kanalen ' + (s && s.kanalen.join('+')) + ', via ' + (s && s.gegevenVia) };
  });

  await stap('voltooibaar', 'het lid beperkt het tot e-mail; de geschiedenis zegt gegeven en daarna gewijzigd', async () => {
    const r = await w.post(ZET, { soort: 'aanbiedingen', kanalen: ['email'], bron: BRON }, A);
    const g = await w.post(GESCHIEDENIS, {}, A);
    const h = g.data ? (g.data.geschiedenis || []).map((x) => x.handeling) : [];
    return { klopt: r.status === 200 && h.join(',') === 'gewijzigd,gegeven', ziet: 'geschiedenis: ' + h.join(', ') };
  });

  await stap('voltooibaar', 'afmelden in een handeling: alles uit, en de intrekking staat erbij', async () => {
    await w.post(ZET, { soort: 'productnieuws', kanalen: ['push'], bron: BRON }, A);
    const r = await w.post(ALLES_UIT, {}, A);
    const st = await w.post(STAND, {}, A);
    const aan = st.data ? (st.data.soorten || []).filter((s) => s.aan).length : -1;
    const g = await w.post(GESCHIEDENIS, {}, A);
    const ingetrokken = g.data ? (g.data.geschiedenis || []).filter((x) => x.handeling === 'ingetrokken').length : 0;
    return { klopt: r.status === 200 && r.data.uitgezet === 2 && aan === 0 && ingetrokken === 2,
      ziet: r.data && r.data.uitgezet + ' uitgezet, ' + aan + ' nog aan, ' + ingetrokken + ' intrekkingen in de geschiedenis' };
  });

  /* ---------------- persistent ---------------- */
  /* Een stand die niet de standaard is, want "alles uit na een herstart" bewijst
     niets: dat is ook wat er staat als er niets bewaard is. */
  await w.post(ZET, { soort: 'onderzoek', kanalen: ['email'], bron: BRON }, A);
  const voor = soort(await w.post(STAND, {}, A), 'onderzoek');
  geschiedenisVoor = JSON.stringify(((await w.post(GESCHIEDENIS, {}, A)).data || {}).geschiedenis || null);
  await w.herstart();

  await stap('persistent', 'na een nette herstart staat de gegeven toestemming er nog, met hetzelfde tijdstip en dezelfde herkomst', async () => {
    const na = soort(await w.post(STAND, {}, A), 'onderzoek');
    return { klopt: !!voor && !!na && na.aan && na.sinds === voor.sinds && na.gegevenVia === voor.gegevenVia,
      ziet: 'voor: ' + (voor && voor.sinds) + ' via ' + (voor && voor.gegevenVia) + '; na: ' + (na && na.sinds) + ' via ' + (na && na.gegevenVia) };
  });
  await stap('persistent', 'een nieuwe sessie (een andere browser) leest exact dezelfde geschiedenis', async () => {
    const C = await inloggen(w, lid);
    const na = JSON.stringify(((await w.post(GESCHIEDENIS, {}, C)).data || {}).geschiedenis || null);
    return { klopt: geschiedenisVoor !== 'null' && na === geschiedenisVoor, ziet: 'geschiedenis ' + (na === geschiedenisVoor ? 'byte voor byte gelijk' : 'ANDERS') + ' (' + JSON.parse(na || 'null').length + ' regels)' };
  });
  await stap('persistent', 'de toestemming staat in de opslag zelf (store.db, gelezen buiten de server om)', async () => {
    const bak = w.collectie('commercieel') || {};
    const rijen = Object.values(bak).filter((r) => r && r.standen && r.standen.onderzoek && r.standen.onderzoek.bron === 'scherm:' + BRON);
    return { klopt: rijen.length === 1 && rijen[0].standen.onderzoek.gegeven === voor.sinds,
      ziet: rijen.length + ' lid met deze toestemming in de kv-opslag, gegeven ' + (rijen[0] && rijen[0].standen.onderzoek.gegeven) };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbelklik: dezelfde keuze twee keer is een gebeurtenis, niet twee', async () => {
    const telVoor = (((await w.post(GESCHIEDENIS, {}, A)).data || {}).geschiedenis || []).length;
    const a = await w.post(ZET, { soort: 'partners', kanalen: ['email'], bron: BRON }, A);
    const b = await w.post(ZET, { soort: 'partners', kanalen: ['email'], bron: BRON }, A);
    const telNa = (((await w.post(GESCHIEDENIS, {}, A)).data || {}).geschiedenis || []).length;
    return { klopt: a.status === 200 && b.status === 200 && telNa === telVoor + 1, ziet: 'geschiedenis ' + telVoor + ' -> ' + telNa };
  });

  await stap('herstelbaar', 'een afgebroken verzoek en daarna opnieuw: de juiste stand, een regel in de geschiedenis', async () => {
    const telVoor = (((await w.post(GESCHIEDENIS, {}, A)).data || {}).geschiedenis || []).length;
    const half = await w.afgebroken(ZET, { soort: 'productnieuws', kanalen: ['sms'], bron: BRON }, A);
    const opnieuw = await w.post(ZET, { soort: 'productnieuws', kanalen: ['sms'], bron: BRON }, A);
    const s = soort(await w.post(STAND, {}, A), 'productnieuws');
    const telNa = (((await w.post(GESCHIEDENIS, {}, A)).data || {}).geschiedenis || []).length;
    return { klopt: geen5xx(opnieuw) && opnieuw.status === 200 && s && s.aan && s.kanalen.join(',') === 'sms' && telNa === telVoor + 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', geschiedenis ' + telVoor + ' -> ' + telNa };
  });

  await stap('herstelbaar', 'een crash direct na het afmelden: wat ingetrokken heette, blijft ingetrokken', async () => {
    const r = await w.post(ALLES_UIT, {}, A);
    await w.crash();
    const st = await w.post(STAND, {}, A);
    const aan = st.data ? (st.data.soorten || []).filter((s) => s.aan).length : -1;
    const g = (((await w.post(GESCHIEDENIS, {}, A)).data || {}).geschiedenis || []);
    return { klopt: r.status === 200 && r.data.uitgezet >= 1 && st.status === 200 && aan === 0 && g[0] && g[0].handeling === 'ingetrokken',
      ziet: 'afmelden ' + r.status + ' (' + (r.data && r.data.uitgezet) + ' uit), na SIGKILL en herstart ' + aan + ' aan, laatste regel ' + (g[0] && g[0].handeling) };
  });

  await stap('herstelbaar', 'een crash direct na het geven: wat gegeven heette, staat er nog', async () => {
    const r = await w.post(ZET, { soort: 'aanbiedingen', kanalen: ['push'], bron: BRON }, A);
    await w.crash();
    const s = soort(await w.post(STAND, {}, A), 'aanbiedingen');
    return { klopt: r.status === 200 && !!s && s.aan && s.kanalen.join(',') === 'push', ziet: 'geven ' + r.status + ', na SIGKILL: aan=' + (s && s.aan) + ' via ' + (s && s.kanalen.join('+')) };
  });

}

/* ---------------- de kruisproef (bewijs 6, scripts/lib/ledenkruis.js) ----------------
   Zaait iets dat ALLEEN van dit lid is, zodat "een ander zag niets" een uitslag
   is en geen leeg experiment. `merktekens` mogen in geen antwoord aan een ander
   staan; `lezers` moeten na alle pogingen van de anderen byte voor byte gelijk
   terugkomen; `handelingen` doen de anderen eerst, en daarna het lid zelf.
   `object: true` zegt dat een handeling een object van A raakt (een id uit zijn
   zaai): dan is een 2xx voor ieder ander een inbreuk. */
async function zaai(w) {
  const lid = await nieuwLid(w, 'kpst');
  const bron = 'kruis' + Date.now().toString(36);
  await w.post(ZET, { soort: 'aanbiedingen', kanalen: ['email', 'sms'], bron }, lid.token);
  return { lid, merktekens: ['scherm:' + bron], lezers: [{ pad: STAND }, { pad: GESCHIEDENIS }],
    handelingen: [{ pad: ZET, lijf: { soort: 'productnieuws', kanalen: ['push'], bron } }, { pad: ALLES_UIT, lijf: {} }] };
}

module.exports = {
  functie: 'link:post',
  ingang: '/apps/mijn-post.html',
  persona: 'lid',
  belofte: 'een lid geeft en trekt zelf toestemming in voor commerciele post, alles staat uit tot hij het aanzet, en de geschiedenis bewijst wanneer en waar -- ook na een herstart of een crash',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Er is geen tweede actor die de toestemming leest: commercieel.mag() heeft vandaag geen aanroeper, dus of een verzender zich aan de stand houdt is niet gemeten. Er is geen Redis of PostgreSQL in de wereld.',
  loop,
  zaai
};
