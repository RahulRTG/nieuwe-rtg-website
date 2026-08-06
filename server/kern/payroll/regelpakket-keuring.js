/* Payroll OS: DE KEURING VAN EEN REGELPAKKET.

   Afgesplitst van ./regelpakket.js, dat over de 10 KB ging. De snede loopt
   langs een echte grens: hiernaast staat hoe je een pakket BEWAART en TERUGVINDT
   (jaargangen, versies, welke gold er op die datum), hier staat wanneer iets
   een geldig pakket IS.

   DE KEURING IS GEEN FORMALITEIT. Een loonmotor die met verzonnen tarieven
   groen draait is gevaarlijker dan een die nog niet draait: het verschil merk
   je pas bij de aangifte, of bij de werknemer. Wat hier doorheen komt, mag
   straks een definitieve loonrun dragen.

   Levert een LIJST BEZWAREN en nooit een boolean: wie een pakket afkeurt hoort
   te kunnen zeggen waarom, anders staat de beheerder met een rood kruis en geen
   richting. */
'use strict';

const loonheffing = require('./loonheffing');
const valuta = require('./valuta');

/* De velden die een pakket moet dragen om bruikbaar te zijn. Bewust met NAMEN
   en niet "alles wat er in staat": een ontbrekend tarief hoort een keuringsfout
   te zijn, geen stille nul. */
const VEREIST = [
  'minimumUurloon',      // per leeftijdsgroep, in centen
  'loonheffing',         // de tabel(len)
  'premies',             // werknemersverzekeringen (werkgeverslasten)
  'zvw',                 // inkomensafhankelijke bijdrage Zvw
  'vakantiegeld'         // opbouwpercentage
];

/* Grenzen waarbinnen een tarief aannemelijk is. Niet om precies te zijn maar om
   het onmogelijke tegen te houden: een loonheffing van 370% of een minimumloon
   van 3 cent is geen tarief maar een fout in de bron of in het inlezen. */
const AANNEMELIJK = {
  /* De ondergrens stond op 500 cent, en dat was fout -- gevonden doordat de
     keuring de eigen meegeleverde jaargang afwees. Het minimumJEUGDloon ligt
     veel lager: een vijftienjarige zit rond de 30% van het volwassen tarief,
     dus rond de 450 cent. Een grens die echte tarieven tegenhoudt is geen
     controle maar een blokkade, en dan zet de eerste de beste hem uit.

     200 cent laat elk werkelijk jeugdloon door en houdt nog steeds tegen wat
     een fout in de bron of in het inlezen is (een tarief van 3 cent, of een
     bedrag dat per ongeluk in euro's in plaats van centen staat). */
  minimumUurloonCenten: [200, 10000],
  percentage: [0, 0.75]
};


const isDatum = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

  /* ---------- keuren ---------- */
/* Levert een lijst bezwaren. Leeg = goed. Nooit een boolean: wie een pakket
   afkeurt hoort te kunnen zeggen waarom, anders staat de beheerder met een
   rood kruis en geen richting. */
function keur(pakket) {
  const bez = [];
  if (!pakket || typeof pakket !== 'object') return ['Geen pakket ontvangen.'];
  if (!/^[A-Z]{2}$/.test(String(pakket.land || ''))) bez.push('Land ontbreekt of is geen landcode van twee letters.');
  if (!isDatum(pakket.geldigVan)) bez.push('geldigVan ontbreekt of is geen datum (JJJJ-MM-DD).');
  if (pakket.geldigTot && !isDatum(pakket.geldigTot)) bez.push('geldigTot is geen datum (JJJJ-MM-DD).');
  if (pakket.geldigTot && pakket.geldigTot < pakket.geldigVan) bez.push('geldigTot ligt voor geldigVan.');
  if (!pakket.versie || typeof pakket.versie !== 'string') bez.push('versie ontbreekt.');
  /* DE VALUTA HOORT BIJ HET PAKKET en niet bij het land. Een land kan van munt
     wisselen (Kroatie ging in 2023 naar de euro) en dan hoort een oude
     loonrun nog steeds in de oude munt te staan. De jaargang van toen weet
     dat; een landtabel van vandaag niet.

     Ontbreekt hij, dan is EUR de terugval -- maar dat wordt hier NIET stil
     ingevuld: het pakket komt binnen zonder valuta en de motor zegt er dan
     bij dat er is aangenomen. Zie ./valuta.js voor waarom dit geen opsmuk is:
     de yen heeft geen onderverdeling, dus honderdsten zijn daar een factor
     honderd mis. */
  if (pakket.valuta != null) for (const b of valuta.keurValuta(pakket.valuta)) bez.push(b);

  const r = pakket.regels;
  if (!r || typeof r !== 'object') { bez.push('regels ontbreken.'); return bez; }
  for (const veld of VEREIST) if (r[veld] == null) bez.push('regel "' + veld + '" ontbreekt.');

  // aannemelijkheid: alleen wat er is, en alleen wat een getal hoort te zijn
  const [minL, maxL] = AANNEMELIJK.minimumUurloonCenten;
  if (r.minimumUurloon && typeof r.minimumUurloon === 'object') {
    for (const groep of Object.keys(r.minimumUurloon)) {
      const c = r.minimumUurloon[groep];
      if (typeof c !== 'number' || !Number.isFinite(c)) bez.push('minimumUurloon.' + groep + ' is geen getal.');
      else if (c < minL || c > maxL) bez.push('minimumUurloon.' + groep + ' (' + c + ' cent) is niet aannemelijk.');
    }
  }
  /* De loonheffingstabel keurt zichzelf (./loonheffing.js): schijven die niet
     oplopen, een korting met een onmogelijk deel, een laatste schijf met een
     bovengrens. Die kennis hoort bij de tabel en niet hier -- anders staat er
     op twee plekken wat een geldige tabel is, en dan lopen ze uit elkaar. */
  if (r.loonheffing != null) for (const b of loonheffing.keurTabel(r.loonheffing)) bez.push(b);

  const [minP, maxP] = AANNEMELIJK.percentage;
  for (const veld of ['vakantiegeld', 'zvw']) {
    const p = r[veld];
    if (p == null) continue;
    if (typeof p !== 'number' || !Number.isFinite(p)) bez.push(veld + ' is geen getal.');
    else if (p < minP || p > maxP) bez.push(veld + ' (' + p + ') is niet aannemelijk als deel van 1.');
  }
  return bez;
}

module.exports = { keur, VEREIST, AANNEMELIJK };
