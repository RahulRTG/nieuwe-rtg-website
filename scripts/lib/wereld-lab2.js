/* ============================================================================
   DE LIVINGLAB-WERELD -- een lab, een onderzoek, een apparaat, een labpas.

   HET PROBLEEM. Drieenzeventig routes onder /api/lab2/ staan onbewezen, en ze
   vallen uiteen in vier wortels die elk hun eigen zin hebben:

      38  "Dit onderzoek bestaat niet."     de studie
      17  "Dit lab bestaat niet."           het lab
       7  "Dit apparaat bestaat niet."      de apparatuur
       4  "Deze labpas kennen we niet."     de bewoner

   HET LAB IS ER AL, en dat is de eerste meting die telt: de seed zet
   `seedlabhaarlem` neer en die staat op actief. Er hoeft dus geen lab gemaakt
   te worden -- er moest alleen iemand naar VRAGEN. Dat is precies het soort
   ding dat je niet vindt door de code te lezen: /api/lab2/labs geeft hem
   gewoon terug.

   Wat de proef daarna zelf maakt is de studie, het apparaat en de labpas. De
   veldnamen komen uit de bron:

     studie   labId + titel + vraagstuk (minstens tien tekens, "beschrijf wat
              er werkelijk speelt") + een `soort` uit kader.js
     apparaat labId + een soort uit een gesloten lijst -- een onbekende soort
              wordt GEWEIGERD en niet stil opgeslagen
     labpas   labId + naam, en het antwoord draagt zowel een id als een `code`

   HET LAB WORDT NIET GEMAAKT MAAR GEKOZEN, en actief moet hij zijn: studieMaak
   weigert een inactief lab met 409. Staat er geen actief lab, dan komt dat MET
   REDEN terug in plaats van dat de wereld stil half klaar is.

   DE SESSIE. Deze routes dragen officeAuth en horen bij een kantoorsessie op
   naam (zie ./kantoorroutes.js); dat is dezelfde sleutel waarmee de proef ze
   straks beproeft.

   EEN VELDNAAM, DRIE BETEKENISSEN -- en dat is waarom een eerste versie van
   deze wereld maar drie routes opleverde terwijl elke stap slaagde. Heel het
   domein leest zijn sleutel als `id` (routes/livinglab/index.js, regel 38:
   `const id = req => String((req.body || {}).id || '')`), maar WAT dat id is,
   verschilt per deelgebied:

     /api/lab2/bewijs/conclusie  -> id is een STUDIE  ("Dit onderzoek bestaat niet")
     /api/lab2/app/lijst         -> id is een LAB     ("Dit lab bestaat niet")
     /api/lab2/app/bevoegd       -> id is een APPARAAT
     /api/lab2/mijn              -> id is een LABPAS

   Een enkel `id` in de wereld zou dus in twee van de vier gevallen het
   verkeerde ding aanwijzen. WELK deelgebied wat bedoelt staat hieronder als
   tabel, en die tabel is GEMETEN uit de weigeringen zelf en niet gelezen uit
   de code -- de route zegt met zoveel woorden welk ding zij mist. Klopt hij
   niet meer, dan komt er gewoon weer 404 en dat is de eerlijke uitkomst. */
'use strict';

async function zetLab2Klaar({ post, tokens }) {
  const stappen = [];
  const off = (tokens || {})['kantoor-op-naam'] || (tokens || {}).office;
  if (!off) {
    return { klaar: false, extra: {}, stappen,
      reden: 'zonder kantoorsessie op naam is er niemand die in een lab iets mag' };
  }

  const doe = async (naam, pad, lijf) => {
    let a = null;
    try { a = await post(pad, lijf, off); } catch (e) { a = null; }
    const ok = a && a.status >= 200 && a.status < 300;
    stappen.push({ naam, pad, status: a ? a.status : 0, ok,
      waarom: ok ? null : ((a && a.data && a.data.error) || 'geen antwoord') });
    return ok ? a.data : null;
  };

  const l = await doe('de labs opvragen', '/api/lab2/labs', {});
  const labs = (l && l.labs) || [];
  const lab = (labs.find(x => x.actief) || {}).id || null;
  if (!lab) {
    return { klaar: false, extra: {}, stappen,
      reden: labs.length
        ? 'er zijn ' + labs.length + ' labs maar geen enkele staat op actief; studieMaak weigert een inactief lab'
        : 'er is geen enkel lab; de seed hoort er een neer te zetten' };
  }
  /* Onder twee namen, want het huis noemt hem allebei: `labId` in de kern,
     `lab` in een deel van de routes. Raden zou hier een halve wereld geven. */
  const extra = { lab, labId: lab };

  const s = await doe('een onderzoek starten', '/api/lab2/studie/maak', {
    labId: lab, titel: 'RTG Proefonderzoek', soort: 'software',
    vraagstuk: 'Wat gebeurt er als de proef een onderzoek start in dit lab en het dossier volgt.',
    doel: 'de studieketen beproefbaar maken'
  });
  const studie = s && s.studie && s.studie.id;
  if (studie) { extra.studie = studie; extra.studieId = studie; }

  const ap = await doe('een apparaat', '/api/lab2/app/maak',
    { labId: lab, lab, naam: 'Proefapparaat', soort: 'sensor' });
  const apparaat = ap && (ap.apparaat || ap.app || {});
  if (apparaat && apparaat.id) { extra.apparaat = apparaat.id; extra.apparaatId = apparaat.id; }

  const pp = await doe('een labpas voor een bewoner', '/api/lab2/bewoner/paspoort-maak',
    { labId: lab, lab, naam: 'Proefbewoner' });
  const pas = pp && pp.paspoort;
  if (pas && pas.code) { extra.labpas = pas.code; extra.code = pas.code; }

  /* Klaar zodra het lab EN het onderzoek er zijn: dat is het leeuwendeel. Wat
     daarna niet lukte staat met reden in de stappen. */
  return { klaar: !!studie, extra, stappen, idVoor: (pad) => idVoor(extra, pad),
    reden: studie ? null : 'het onderzoek kwam er niet; zie stappen' };
}

/* Welk ding is `id` in dit deelgebied. Gemeten uit de weigeringen: elke route
   noemt zelf welk ding zij mist. Een deelgebied dat er niet in staat, krijgt
   geen `id` mee -- dan is 404 het eerlijke antwoord, en geen gok. */
const ID_BETEKENIS = {
  '/api/lab2/app': 'apparaat',
  '/api/lab2/bewijs': 'studie',
  '/api/lab2/bewoner': 'studie',
  '/api/lab2/coach': 'studie',
  '/api/lab2/ethiek': 'studie',
  '/api/lab2/impact': 'lab',
  '/api/lab2/lab': 'lab',
  '/api/lab2/mens': 'studie',
  '/api/lab2/mijn': 'labpas',
  '/api/lab2/opbrengst': 'lab',
  '/api/lab2/overzicht': 'lab',
  '/api/lab2/plan': 'studie',
  '/api/lab2/studie': 'studie',
  '/api/lab2/themas': 'lab',
  '/api/lab2/uit': 'studie',
  '/api/lab2/werk': 'studie'
};

/* De vorm zelf woont in ./idperdeel.js -- hij kwam vier keer terug en de fout
   die hij voorkomt is duur en onzichtbaar (zie de kop daar). De TABEL blijft
   hier, want welk deelgebied wat bedoelt is een meting aan DIT domein. */
const { idVoor: idPerDeel } = require('./idperdeel');
function idVoor(extra, pad) { return idPerDeel(ID_BETEKENIS, extra, pad); }

module.exports = { zetLab2Klaar, ID_BETEKENIS, idVoor };
