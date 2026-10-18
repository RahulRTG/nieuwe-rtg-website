/* ============================================================================
   VOLTOOIPROEF: MECENAAT (link:mecenaat, /apps/geld.html#mecenaat).

   De belofte, in de woorden van kern/rechterhand/mecenaat.js: de filantropie
   van het lid op orde. Per gift het doel, het thema, het bedrag, of het een
   toezegging of al betaald is, en of het via de RTFoundation loopt. Het
   overzicht toont wat is toegezegd, wat is betaald en welk deel via de
   RTFoundation gaat.

   WAT HIER NIET GEBEURT, en dat is de belofte zelf: er beweegt geen geld. Een
   gift op "betaald" zetten is een aantekening van het lid over iets wat hij
   buiten deze app deed (GELD.md: geld verlaat het huis nooit automatisch). De
   proef controleert dus de boekhouding van zijn toezeggingen, niet een betaling.
   ========================================================================== */
'use strict';
const { lifestyleLid, KANTOORWERELD } = require('../voltooiwereld');
const { bewaarblok } = require('../voltooiboek');

const DOSSIER = '/api/member/rechterhand/mecenaat';
const GIFT = '/api/member/rechterhand/mecenaat/gift';
const GIFT_WEG = '/api/member/rechterhand/mecenaat/gift/weg';
const BETAALD = '/api/member/rechterhand/mecenaat/betaald';

async function loop(w, stap) {
  const merk = 'mc' + Date.now().toString(36);
  const lid = await lifestyleLid(w, 'mec');
  const T = lid.token;
  const dossier = async (tok) => { const r = await w.post(DOSSIER, {}, tok || T); return r.status === 200 ? r.data : null; };
  let school = null;

  await stap('voltooibaar', 'twee toezeggingen, een via de RTFoundation: toegezegd en via-Foundation tellen apart', async () => {
    const a = await w.post(GIFT, { doel: 'School ' + merk, thema: 'onderwijs', bedrag: 5000, periode: 'jaar', foundation: true }, T);
    const b = await w.post(GIFT, { doel: 'Museum ' + merk, thema: 'kunst', bedrag: 2500, periode: 'eenmalig' }, T);
    school = a.data && a.data.gift;
    const d = await dossier();
    return { klopt: a.status === 200 && b.status === 200 && d.toegezegd === 7500 && d.betaald === 0 && d.viaFoundation === 5000 && d.perThema.onderwijs === 5000,
      ziet: 'toegezegd ' + d.toegezegd + ', betaald ' + d.betaald + ', via Foundation ' + d.viaFoundation };
  });

  await stap('voltooibaar', 'het lid tekent een gift af als betaald: het bedrag verhuist van toegezegd naar betaald, het totaal blijft', async () => {
    const r = await w.post(BETAALD, { id: school.id, betaald: true }, T);
    const d = await dossier();
    return { klopt: r.status === 200 && d.betaald === 5000 && d.toegezegd === 2500 && d.totaal === 7500, ziet: 'betaald ' + d.betaald + ', toegezegd ' + d.toegezegd + ', totaal ' + d.totaal };
  });

  await stap('voltooibaar', 'terugzetten op toegezegd kan ook (een vergissing), en een onbekende gift wordt geweigerd met de reden', async () => {
    const r = await w.post(BETAALD, { id: school.id, betaald: false }, T);
    const onbekend = await w.post(BETAALD, { id: 'bestaatniet', betaald: true }, T);
    const d = await dossier();
    return { klopt: r.status === 200 && d.betaald === 0 && d.toegezegd === 7500 && onbekend.status === 404 && /niet in uw dossier/.test(onbekend.data.error),
      ziet: 'terug: betaald ' + d.betaald + '; onbekend ' + onbekend.status + ' (' + (onbekend.data && onbekend.data.error) + ')' };
  });

  await stap('voltooibaar', 'een gift zonder doel wordt geweigerd; een gift weghalen haalt hem uit elk totaal', async () => {
    const leeg = await w.post(GIFT, { doel: '', bedrag: 10 }, T);
    const d0 = await dossier();
    const museum = d0.giften.find((g) => g.doel === 'Museum ' + merk);
    const x = await w.post(GIFT_WEG, { id: museum.id }, T);
    const d = await dossier();
    return { klopt: leeg.status === 400 && x.status === 200 && d.totaal === 5000 && !d.perThema.kunst && d.giften.length === 1,
      ziet: 'zonder doel ' + leeg.status + '; na weghalen totaal ' + d.totaal + ', ' + d.giften.length + ' gift' };
  });

  await bewaarblok(w, stap, {
    T, lid, merk, wat: 'gift',
    alle: async (tok) => { const d = await dossier(tok); return d ? d.giften : null; },
    naamVan: (g) => g.doel,
    maak: (naam) => ({ pad: GIFT, lijf: { doel: naam, thema: 'natuur', bedrag: 100 } }),
    weg: (g) => ({ pad: GIFT_WEG, lijf: { id: g.id } })
  });
}

module.exports = {
  functie: 'link:mecenaat',
  ingang: '/apps/geld.html#mecenaat',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een Lifestyle-lid houdt zijn filantropie bij: per gift het doel, het bedrag, toegezegd of betaald, en welk deel via de RTFoundation loopt',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Er beweegt geen geld: "betaald" is een aantekening van het lid, geen betaling, en de proef beweert niets over een overboeking. De Lifestyle Pass komt van het eigenaarsaccount van de testomgeving (zie Reisboek). Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
