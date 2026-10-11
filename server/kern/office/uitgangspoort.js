/* RTG Office: de uitgangspoort voor classificatie (OFFICE.md par. 4, grens 4,
   en par. 9 fase 1).

   "Classificatie reist mee naar elke uitgang: delen, offline, AI, zoekindex en
   export. Een uitgang die haar niet leest, is een lek." Tot hier las elke
   uitgang haar zelf, met een eigen `classificatie === 'strikt'` op vier plekken
   (delen.js, gezinsdeling.js, rechten.js en de AI-tak), en de export las haar
   helemaal niet: die gebeurde in de browser. Dat is precies het lek in zijn
   structurele vorm -- een vijfde uitgang kon erbij komen zonder dat iets het
   merkte.

   Daarom staat hier EEN lijst uitgangen en EEN functie die per document en per
   uitgang zegt wat er gebeurt. Een uitgang die hier niet staat, bestaat niet:
   `poort()` gooit, in plaats van stil "mag" te zeggen.
   test/office-uitgangspoort.test.js zakt zodra ergens buiten dit bestand de
   classificatie van een Office-document wordt gelezen -- zo moet een nieuwe
   uitgang zich hier melden.

   WAT DIT BESTAND NIET BESLIST. Het voegt geen beleid toe. De stand per uitgang
   is wat het huis al besloten had: strikt is dicht voor delen, gezinsdeling,
   meelezen en een taalmodel (OFFICE.md par. 7, P3: "strikt blokkeert delen en
   het model"). Voor de EXPORT is nooit besloten dat strikt hem blokkeert -- wie
   het document mag openen, ziet de inhoud al -- dus daar REIST DE MARKERING
   MEE in het bestand en komt er een regel in het documentspoor. Of strikt de
   export ook moet sluiten, is een besluit van de eigenaar en geen bouwtaak
   (B4: agents verzinnen geen beleidsbesluiten). */
'use strict';

const CLASSIFICATIES = ['intern', 'vertrouwelijk', 'strikt'];
// de namen zoals het scherm ze al toont (apps/office/adaptief-staat.js)
const LABELS = { intern: 'Intern', vertrouwelijk: 'Vertrouwelijk', strikt: 'Strikt' };

/* Per uitgang: wat strikt daar doet, en waarom. 'dicht' weigert, 'markering'
   laat door met de classificatie in wat er naar buiten gaat. */
const UITGANGEN = Object.freeze({
  delen: { strikt: 'dicht', wat: 'delen op codenaam (lezen of meeschrijven)' },
  gezin: { strikt: 'dicht', wat: 'delen met de eigen gezinskring' },
  meelezen: { strikt: 'dicht', wat: 'openen door iemand anders dan de eigenaar, ook bij oude opslag met een deling naast strikt' },
  model: { strikt: 'dicht', wat: 'documenttekst naar een taalmodel (lokaal of extern: server/ai.js valt bij storing door naar extern)' },
  export: { strikt: 'markering', wat: 'een bestand downloaden (HTML, CSV, XLSX, DOCX, TXT)' },
  spiegel: { strikt: 'markering', wat: 'de titel van een eigen document in de lijst van Bestanden' }
});

const WEIGER = {
  delen: 'Een strikt document kan niet worden gedeeld. Pas eerst de classificatie aan.',
  gezin: 'Een strikt document kan niet worden gedeeld. Pas eerst de classificatie aan.',
  meelezen: 'Dit document is niet met u gedeeld.',
  model: 'Dit document is strikt geclassificeerd en gaat niet naar een taalmodel. ' +
    'Samenvatten, inkorten, actiepunten, formule en kritisch lezen werken wel: die blijven in RTG.'
};

/* De classificatie van een document. Een document zonder geldige waarde is
   'intern' -- dat is wat docs.js bij het maken zet en wat de lijst al toonde. */
function classificatieVan(d) {
  const c = d && d.beheer && d.beheer.classificatie;
  return CLASSIFICATIES.includes(c) ? c : 'intern';
}

/* Het oordeel voor EEN uitgang. Altijd met de classificatie en haar label erbij,
   ook als hij doorlaat, zodat de uitgang hem kan meenemen. */
function poort(d, uitgang) {
  const regel = UITGANGEN[uitgang];
  if (!regel) throw new Error('kern/office/uitgangspoort: onbekende uitgang "' + uitgang +
    '" -- zet hem in UITGANGEN met wat strikt daar doet');
  const classificatie = classificatieVan(d);
  const label = LABELS[classificatie];
  if (classificatie === 'strikt' && regel.strikt === 'dicht') {
    return { mag: false, classificatie, label, code: 'CLASSIFICATIE_STRIKT', reden: WEIGER[uitgang] };
  }
  return { mag: true, classificatie, label };
}

module.exports = { CLASSIFICATIES, LABELS, UITGANGEN, classificatieVan, poort };
