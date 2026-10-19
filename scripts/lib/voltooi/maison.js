/* ============================================================================
   VOLTOOIPROEF: MAISON (link:maison, /apps/maison.html).

   De belofte, in de woorden van kern/rechterhand/maison.js: huishouden en staf.
   Het huishoudelijk personeel met rol en contact, de lopende taken (met wie en
   wanneer, af te vinken), en een logboek van wat er speelt in en om huis.
   Het lid is een Lifestyle-lid langs het menselijke besluit van het kantoor
   (../voltooiwereld.js lifestyleLid; zie het scenario van Reisboek).
   ========================================================================== */
'use strict';
const { lifestyleLid, KANTOORWERELD } = require('../voltooiwereld');
const { bewaarblok } = require('../voltooiboek');

const HUIS = '/api/member/rechterhand/maison';
const STAF = '/api/member/rechterhand/maison/staf';
const STAF_WEG = '/api/member/rechterhand/maison/staf/weg';
const TAAK = '/api/member/rechterhand/maison/taak';
const KLAAR = '/api/member/rechterhand/maison/taak/klaar';
const TAAK_WEG = '/api/member/rechterhand/maison/taak/weg';
const LOG = '/api/member/rechterhand/maison/log';

const dag = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function loop(w, stap) {
  const merk = 'ms' + Date.now().toString(36);
  const lid = await lifestyleLid(w, 'mai');
  const T = lid.token;
  const huis = async (tok) => { const r = await w.post(HUIS, {}, tok || T); return r.status === 200 ? r.data : null; };
  let tuinman = null;

  await stap('voltooibaar', 'het lid neemt een tuinman en een huishoudster op in zijn staf', async () => {
    const a = await w.post(STAF, { naam: 'Tuinman ' + merk, rol: 'tuin', telefoon: '0612345678' }, T);
    const b = await w.post(STAF, { naam: 'Huishouden ' + merk, rol: 'huishouden' }, T);
    const h = await huis();
    tuinman = h && h.staf.find((s) => s.naam === 'Tuinman ' + merk);
    return { klopt: a.status === 200 && b.status === 200 && h.staf.length === 2 && !!tuinman && tuinman.rol === 'tuin', ziet: h ? h.staf.map((s) => s.naam.split(' ')[0] + ' (' + s.rol + ')').join(', ') : '-' };
  });

  await stap('voltooibaar', 'twee taken, een voor de tuinman; de lijst noemt hem bij naam en telt twee open', async () => {
    const t1 = await w.post(TAAK, { wat: 'Hagen snoeien ' + merk, voor: tuinman.id, dag: dag(3) }, T);
    const t2 = await w.post(TAAK, { wat: 'Zilver poetsen ' + merk, dag: dag(1) }, T);
    const h = await huis();
    const snoei = h.taken.find((t) => t.wat === 'Hagen snoeien ' + merk);
    return { klopt: t1.status === 200 && t2.status === 200 && h.openTaken === 2 && !!snoei && snoei.voorNaam === 'Tuinman ' + merk && h.taken[0].wat.startsWith('Zilver'),
      ziet: h.openTaken + ' open, eerst: ' + h.taken[0].wat.split(' ')[0] + ', snoeien voor ' + (snoei && snoei.voorNaam) };
  });

  await stap('voltooibaar', 'een taak afvinken: hij zakt naar onderen en telt niet meer als open; terugzetten kan ook', async () => {
    const h0 = await huis();
    const zilver = h0.taken.find((t) => t.wat.startsWith('Zilver'));
    const k = await w.post(KLAAR, { id: zilver.id, klaar: true }, T);
    const h = await huis();
    const terug = await w.post(KLAAR, { id: zilver.id, klaar: false }, T);
    const h2 = await huis();
    return { klopt: k.status === 200 && h.openTaken === 1 && h.taken[h.taken.length - 1].id === zilver.id && terug.status === 200 && h2.openTaken === 2,
      ziet: 'afgevinkt: ' + h.openTaken + ' open, laatste ' + h.taken[h.taken.length - 1].wat.split(' ')[0] + '; teruggezet: ' + h2.openTaken + ' open' };
  });

  await stap('voltooibaar', 'de tuinman vertrekt: zijn taak blijft staan maar hangt aan niemand meer', async () => {
    const x = await w.post(STAF_WEG, { id: tuinman.id }, T);
    const h = await huis();
    const snoei = h.taken.find((t) => t.wat === 'Hagen snoeien ' + merk);
    return { klopt: x.status === 200 && h.staf.length === 1 && !!snoei && snoei.voor === '' && snoei.voorNaam === '', ziet: h.staf.length + ' in de staf, snoeien voor "' + (snoei && snoei.voorNaam) + '"' };
  });

  await stap('voltooibaar', 'een regel in het logboek staat bovenaan; een lege regel wordt geweigerd met de reden', async () => {
    const l = await w.post(LOG, { tekst: 'Schilder geweest ' + merk }, T);
    const leeg = await w.post(LOG, { tekst: '   ' }, T);
    const h = await huis();
    return { klopt: l.status === 200 && h.logboek[0].tekst === 'Schilder geweest ' + merk && leeg.status === 400 && /noteren/.test(leeg.data.error),
      ziet: 'logboek[0]: ' + h.logboek[0].tekst.split(' ').slice(0, 2).join(' ') + '; leeg: ' + leeg.status };
  });

  await bewaarblok(w, stap, {
    T, lid, merk, wat: 'taak',
    alle: async (tok) => { const h = await huis(tok); return h ? h.taken : null; },
    naamVan: (t) => t.wat,
    maak: (naam) => ({ pad: TAAK, lijf: { wat: naam, dag: dag(5) } }),
    weg: (t) => ({ pad: TAAK_WEG, lijf: { id: t.id } })
  });
}

module.exports = {
  functie: 'link:maison',
  ingang: '/apps/maison.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een Lifestyle-lid bestuurt zijn huishouden: de staf met rol en contact, taken voor wie en wanneer, af te vinken, en een logboek van wat er in huis speelt',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. De staf zijn geen accounts: een taak voor de tuinman is een notitie van het lid, geen opdracht die de tuinman ontvangt. De Lifestyle Pass komt van het eigenaarsaccount van de testomgeving (zie Reisboek). Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
