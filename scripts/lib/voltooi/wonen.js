/* ============================================================================
   VOLTOOIPROEF: WONEN (link:wonen, /apps/wonen.html) -- LivingOS.

   De belofte, in de woorden van server/kern/woningonderhoud.js: een lid meldt
   zelf wat er thuis stuk is, en een melding begint ALTIJD als `gemeld` -- zonder
   gekoppelde vakman doet RTG niet alsof iemand onderweg is. Een opgeloste
   melding blijft als historie staan; een geannuleerde ook.

   WAAROM ER GEEN TWEEDE PARTIJ IN ZIT, en dat is geen tekort van de proef maar
   van de functie: de kern bewaart vandaag alleen de controleerbare vraag;
   toewijzing en planning horen "later bij de echte dienstverlener". De ontvanger
   is daarom het lid zelf op een ander toestel. Een schakel die een vakman laat
   reageren zou hier een functie verzinnen.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');

const LIJST = '/api/home/onderhoud';
const MELD = '/api/home/onderhoud/meld';
const ANNULEER = '/api/home/onderhoud/annuleer';

const meldingen = (r) => (r && r.data && Array.isArray(r.data.meldingen)) ? r.data.meldingen : [];
const met = (r, titel) => meldingen(r).filter((m) => m.titel === titel);
const geen5xx = (r) => r && r.status > 0 && r.status < 500;
const merk = () => Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

async function loop(w, stap) {
  const lid = await nieuwLid(w, 'won');
  const A = lid.token;
  const KRAAN = 'Lekkende kraan ' + merk();
  let id = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een nieuw lid heeft geen meldingen', async () => {
    const r = await w.post(LIJST, {}, A);
    return { klopt: r.status === 200 && meldingen(r).length === 0, ziet: meldingen(r).length + ' meldingen' };
  });

  await stap('voltooibaar', 'een melding zonder plek wordt geweigerd, met de reden erbij', async () => {
    const r = await w.post(MELD, { titel: KRAAN }, A);
    return { klopt: r.status === 400 && /plek/i.test(String(r.data && r.data.error)) && met(await w.post(LIJST, {}, A), KRAAN).length === 0,
      ziet: r.status + ': ' + String(r.data && r.data.error) };
  });

  await stap('voltooibaar', 'het lid meldt wat er stuk is; de melding staat er als gemeld en niet als ingepland', async () => {
    const r = await w.post(MELD, { titel: KRAAN, plek: 'keuken', notitie: 'druppelt sinds gisteren', urgentie: 'hoog' }, A);
    const m = met(await w.post(LIJST, {}, A), KRAAN)[0];
    id = m && m.id;
    return { klopt: r.status === 200 && !!m && m.status === 'gemeld' && m.urgentie === 'hoog' && m.plek === 'keuken',
      ziet: m ? m.status + ', ' + m.urgentie + ', ' + m.plek : 'geen melding' };
  });

  await stap('voltooibaar', 'het lid ziet dezelfde melding op een ander toestel', async () => {
    const C = await inloggen(w, lid);
    const m = met(await w.post(LIJST, {}, C), KRAAN)[0];
    return { klopt: !!m && m.id === id && m.status === 'gemeld', ziet: m ? 'zelfde id, ' + m.status : 'niet gezien' };
  });

  await stap('voltooibaar', 'het lid annuleert; de melding blijft als historie staan', async () => {
    const r = await w.post(ANNULEER, { id }, A);
    const m = met(await w.post(LIJST, {}, A), KRAAN)[0];
    return { klopt: r.status === 200 && !!m && m.status === 'geannuleerd', ziet: 'annuleer ' + r.status + ', staat er als ' + (m && m.status) };
  });

  /* ---------------- persistent ---------------- */
  const CV = 'CV-ketel geeft storing ' + merk();
  await w.post(MELD, { titel: CV, plek: 'zolder', urgentie: 'normaal' }, A);
  const voor = JSON.stringify(meldingen(await w.post(LIJST, {}, A)));
  await w.herstart();

  await stap('persistent', 'na een nette herstart staan dezelfde meldingen er, met dezelfde stand en hetzelfde tijdstip', async () => {
    const na = JSON.stringify(meldingen(await w.post(LIJST, {}, A)));
    return { klopt: voor !== '[]' && na === voor, ziet: 'lijst ' + (na === voor ? 'gelijk' : 'ANDERS') + ' (' + JSON.parse(na).length + ' meldingen)' };
  });
  await stap('persistent', 'een nieuwe sessie leest dezelfde meldingen', async () => {
    const C = await inloggen(w, lid);
    const na = JSON.stringify(meldingen(await w.post(LIJST, {}, C)));
    return { klopt: na === voor, ziet: 'lijst ' + (na === voor ? 'gelijk' : 'ANDERS') };
  });
  await stap('persistent', 'de meldingen staan in de opslag zelf (store.db, gelezen buiten de server om)', async () => {
    const bak = w.collectie('woningOnderhoud') || {};
    const lijsten = Object.values(bak).filter((l) => Array.isArray(l) && l.some((m) => m && m.titel === CV));
    const geann = lijsten[0] ? lijsten[0].filter((m) => m.titel === KRAAN && m.status === 'geannuleerd').length : 0;
    return { klopt: lijsten.length === 1 && geann === 1, ziet: lijsten.length + ' lid met deze melding, geannuleerde melding ' + (geann ? 'ook bewaard' : 'WEG') };
  });

  /* ---------------- herstelbaar ---------------- */
  const DUBBEL = 'Deur klemt ' + merk();
  await stap('herstelbaar', 'dubbelklik: dezelfde melding twee keer is een melding, niet twee', async () => {
    const lijf = { titel: DUBBEL, plek: 'gang', urgentie: 'laag' };
    const [a, b] = await Promise.all([w.post(MELD, lijf, A), w.post(MELD, lijf, A)]);
    const n = met(await w.post(LIJST, {}, A), DUBBEL).length;
    return { klopt: geen5xx(a) && geen5xx(b) && n === 1, ziet: 'statussen ' + a.status + '/' + b.status + ', ' + n + ' melding(en)' };
  });

  const HALF = 'Raam sluit niet ' + merk();
  await stap('herstelbaar', 'een afgebroken verzoek en daarna opnieuw: precies een melding', async () => {
    const lijf = { titel: HALF, plek: 'slaapkamer', urgentie: 'normaal' };
    const half = await w.afgebroken(MELD, lijf, A);
    const opnieuw = await w.post(MELD, lijf, A);
    const n = met(await w.post(LIJST, {}, A), HALF).length;
    return { klopt: geen5xx(opnieuw) && n === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' melding(en)' };
  });

  const CRASH = 'Stopcontact zonder stroom ' + merk();
  await stap('herstelbaar', 'een crash direct na het melden: de melding staat er nog', async () => {
    const r = await w.post(MELD, { titel: CRASH, plek: 'woonkamer', urgentie: 'hoog' }, A);
    await w.crash();
    const m = met(await w.post(LIJST, {}, A), CRASH)[0];
    return { klopt: r.status === 200 && !!m && m.status === 'gemeld', ziet: 'meld ' + r.status + ', na SIGKILL ' + (m ? m.status : 'WEG') };
  });

  await stap('herstelbaar', 'een crash direct na het annuleren: geannuleerd blijft geannuleerd', async () => {
    const m0 = met(await w.post(LIJST, {}, A), CRASH)[0];
    const r = await w.post(ANNULEER, { id: m0 && m0.id }, A);
    await w.crash();
    const m = met(await w.post(LIJST, {}, A), CRASH)[0];
    return { klopt: r.status === 200 && !!m && m.status === 'geannuleerd', ziet: 'annuleer ' + r.status + ', na SIGKILL ' + (m && m.status) };
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
  const lid = await nieuwLid(w, 'kwon');
  const TITEL = 'Kraan kruisproef ' + merk();
  await w.post(MELD, { titel: TITEL, plek: 'keuken', urgentie: 'hoog' }, lid.token);
  const m = met(await w.post(LIJST, {}, lid.token), TITEL)[0];
  /* Het woningdossier van hetzelfde scherm (public/apps/wonen.js): een map en een
     document. Een ander die A's map hernoemt of een nieuwe versie over A's
     document zet, tast A's stand aan; dat leest de kruis terug. */
  const DOSSIER = 'Woningdossier kruisproef ' + merk();
  const STUK = 'energielabel-' + merk() + '.txt';
  const tekst = (t) => 'data:text/plain;base64,' + Buffer.from(t).toString('base64');
  const map = await w.post('/api/bestanden/map', { naam: DOSSIER }, lid.token);
  const mapId = map.data && map.data.id;
  const stuk = await w.post('/api/bestanden/upload', { naam: STUK, map: mapId, dataUrl: tekst('label A') }, lid.token);
  const stukId = stuk.data && stuk.data.id;
  return { lid, merktekens: [TITEL, DOSSIER, STUK], lezers: [{ pad: LIJST }, { pad: '/api/bestanden/mijn' }],
    handelingen: [{ pad: ANNULEER, object: true, lijf: { id: m && m.id } }, { pad: MELD, lijf: { titel: 'CV kruisproef ' + merk(), plek: 'zolder', urgentie: 'normaal' } },
      { pad: '/api/bestanden/map', object: true, lijf: { id: mapId, naam: DOSSIER + ' (bijgewerkt)' } },
      { pad: '/api/bestanden/upload', object: true, lijf: { id: stukId, dataUrl: tekst('label A, tweede versie') } }] };
}

module.exports = {
  functie: 'link:wonen',
  ingang: '/apps/wonen.html',
  persona: 'lid',
  belofte: 'een lid meldt zelf wat er thuis stuk is, ziet het als gemeld (nooit als ingepland zonder vakman), annuleert het, en de historie blijft staan -- ook na een herstart of een crash',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Er is geen tweede partij: toewijzing aan een vakman bestaat vandaag niet (kern/woningonderhoud.js), dus de ontvanger is het lid op een ander toestel. De bestanden en de woningkaart van hetzelfde scherm zijn niet beproefd. Er is geen Redis of PostgreSQL in de wereld.',
  loop,
  zaai
};
