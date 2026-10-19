/* ============================================================================
   VOLTOOIPROEF: ENTOURAGE (link:entourage, /apps/entourage.html).

   De belofte, in de woorden van kern/rechterhand/entourage.js: het vaste
   reisgezelschap van het lid, met band, voorkeuren, dieet en documenten. Elk
   document heeft een vervaldatum, er is EEN lijst die alles op datum zet met
   wat verlopen is bovenaan, en het gezelschap samenstellen geeft terug wat er
   nog ontbreekt (dieet onbekend, geen telefoon, document verlopen of bijna).
   ========================================================================== */
'use strict';
const { lifestyleLid, KANTOORWERELD } = require('../voltooiwereld');
const { bewaarblok } = require('../voltooiboek');

const LIJST = '/api/member/rechterhand/entourage';
const PERSOON = '/api/member/rechterhand/entourage/persoon';
const PERSOON_WEG = '/api/member/rechterhand/entourage/persoon/weg';
const DOC = '/api/member/rechterhand/entourage/doc';
const DOC_WEG = '/api/member/rechterhand/entourage/doc/weg';
const GEZELSCHAP = '/api/member/rechterhand/entourage/gezelschap';

const dag = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function loop(w, stap) {
  const merk = 'en' + Date.now().toString(36);
  const lid = await lifestyleLid(w, 'ent');
  const T = lid.token;
  const lijst = async (tok) => { const r = await w.post(LIJST, {}, tok || T); return r.status === 200 ? r.data : null; };
  const wie = async (naam) => ((await lijst()) || { gezelschap: [] }).gezelschap.find((p) => p.naam === naam);
  let partner = null, kind = null;

  await stap('voltooibaar', 'een partner met telefoon en dieet, en een kind zonder: beide in het gezelschap', async () => {
    const a = await w.post(PERSOON, { naam: 'Partner ' + merk, band: 'partner', telefoon: '0611', dieet: 'pescotarisch' }, T);
    const b = await w.post(PERSOON, { naam: 'Kind ' + merk, band: 'kind' }, T);
    partner = await wie('Partner ' + merk); kind = await wie('Kind ' + merk);
    const l = await lijst();
    return { klopt: a.status === 200 && b.status === 200 && l.aantal === 2 && !!partner && !!kind, ziet: l.aantal + ' personen' };
  });

  await stap('voltooibaar', 'een verlopen visum en een paspoort dat over een maand verloopt: verlopen staat bovenaan', async () => {
    const a = await w.post(DOC, { id: partner.id, soort: 'paspoort', tot: dag(30) }, T);
    const b = await w.post(DOC, { id: kind.id, soort: 'visum', tot: dag(-5) }, T);
    const l = await lijst();
    const eigen = l.attenties.filter((x) => x.naam.endsWith(merk));
    return { klopt: a.status === 200 && b.status === 200 && eigen.length === 2 && eigen[0].soort === 'visum' && eigen[0].verlopen === true && eigen[1].verlopen === false,
      ziet: eigen.map((x) => x.soort + (x.verlopen ? ' (verlopen)' : ' tot ' + x.tot)).join(', ') };
  });

  await stap('voltooibaar', 'een document zonder geldige datum wordt geweigerd met de reden', async () => {
    const r = await w.post(DOC, { id: partner.id, soort: 'rijbewijs', tot: 'volgend jaar' }, T);
    return { klopt: r.status === 400 && /Tot welke datum/.test(r.data.error), ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  await stap('voltooibaar', 'het gezelschap samenstellen zegt wat er ontbreekt, en zet de dieetwensen op een rij', async () => {
    const r = await w.post(GEZELSCHAP, { ids: [partner.id, kind.id] }, T);
    const punten = (r.data && r.data.punten || []).map((p) => p.naam.split(' ')[0] + ': ' + p.wat);
    const kindPunten = punten.filter((p) => p.startsWith('Kind'));
    return { klopt: r.status === 200 && kindPunten.some((p) => /visum is verlopen/.test(p)) && kindPunten.some((p) => /telefoonnummer/.test(p)) && kindPunten.some((p) => /dieet onbekend/.test(p))
      && punten.some((p) => /Partner: paspoort verloopt binnenkort/.test(p)) && (r.data.dieten || []).some((d) => d.dieet === 'pescotarisch'),
      ziet: punten.length + ' punten: ' + punten.join(' | ').slice(0, 160) };
  });

  await stap('voltooibaar', 'het verlopen visum weghalen haalt ook de attentie weg', async () => {
    const k = await wie('Kind ' + merk);
    const visum = k.documenten.find((d) => d.soort === 'visum');
    const x = await w.post(DOC_WEG, { id: kind.id, docId: visum.id }, T);
    const l = await lijst();
    return { klopt: x.status === 200 && !l.attenties.some((a) => a.naam === 'Kind ' + merk), ziet: 'attenties van het kind: ' + l.attenties.filter((a) => a.naam === 'Kind ' + merk).length };
  });

  await bewaarblok(w, stap, {
    T, lid, merk, wat: 'persoon',
    alle: async (tok) => { const l = await lijst(tok); return l ? l.gezelschap : null; },
    naamVan: (p) => p.naam,
    maak: (naam) => ({ pad: PERSOON, lijf: { naam, band: 'vriend', telefoon: '0622' } }),
    weg: (p) => ({ pad: PERSOON_WEG, lijf: { id: p.id } })
  });
}

module.exports = {
  functie: 'link:entourage',
  ingang: '/apps/entourage.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een Lifestyle-lid houdt zijn reisgezelschap bij: documenten met een vervaldatum, verlopen bovenaan, en bij het samenstellen van een gezelschap ziet hij wat er nog ontbreekt',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Inreisvereisten per land worden bewust niet beloofd (dat zegt het antwoord ook) en niet gemeten. De personen zijn geen accounts en krijgen niets te zien. De Lifestyle Pass komt van het eigenaarsaccount van de testomgeving (zie Reisboek). Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
