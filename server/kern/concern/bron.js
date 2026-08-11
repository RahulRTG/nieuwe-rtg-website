/* CONCERN (deelmodule): DE BRON. Wet 4 uit CONCERN.md, in code.

   > Juridische waarheid heeft altijd een bron en een geschiedenis.

   Dit bestand doet de eerste helft. Een juridisch gegeven dat hier langskomt
   zonder bron wordt GEWEIGERD -- niet aangevuld met een standaardbron, niet
   stil opgeslagen met bron `null`. Dat is precies de fout die dit huis net uit
   de genrelaag heeft gehaald: een ontbrekende waarde die stilletjes iets anders
   wordt, is een leugen die pas opvalt als het ertoe doet.

   VIER SOORTEN, EN NIET MEER. Ze staan op volgorde van hoe hard ze zijn:

     register   een geverifieerde registratie (KvK of lokaal equivalent)
     document   uit een geupload stuk gehaald EN door een mens bevestigd
     mens       de ondernemer heeft het zelf ingevuld
     afgeleid   uit andere gegevens gerekend, met de regel erbij

   `afgeleid` is de enige die de AI zelfstandig mag zetten, en alleen omdat hij
   niets beweert wat niet uit andere gegevens volgt: de UBO-regel (>25%) is een
   som, geen oordeel. Zie ./graaf.js.

   `document` is met opzet NIET wat de extractie oplevert. Een uitgelezen
   uittreksel levert een VOORSTEL (zie ./voorstel.js); pas als een mens het
   bevestigt wordt het een feit met bron `document`. Dat is wet 5: de
   complexiteit onder water, de bevestiging bij de mens.

   Wat hier NIET staat: een oordeel over of het gegeven juridisch klopt. RTG
   telt en structureert; "juridisch waterdicht" is een uitspraak die geen enkel
   systeem universeel kan doen. Zie de grenzen in CONCERN.md. */
'use strict';

/* De vier soorten, met hun hardheid. De hardheid is geen cijfer om mee te
   pronken maar om mee te KIEZEN: komt hetzelfde feit uit twee bronnen, dan wint
   de hardste, en dat moet ergens staan. */
const SOORTEN = {
  register: { hardheid: 4, label: 'Handelsregister',
    uitleg: 'Overgenomen uit een geverifieerde registratie.' },
  document: { hardheid: 3, label: 'Document',
    uitleg: 'Uit een document gehaald en door een mens bevestigd.' },
  mens: { hardheid: 2, label: 'Ingevuld',
    uitleg: 'Door de ondernemer zelf ingevuld.' },
  afgeleid: { hardheid: 1, label: 'Afgeleid',
    uitleg: 'Uit andere gegevens gerekend; de regel staat erbij.' }
};

const isSoort = (s) => Object.prototype.hasOwnProperty.call(SOORTEN, s);

/* Een bron opbouwen, of een fout. `detail` zegt WELK register, WELK document of
   WELKE regel -- zonder dat is de bron een woord en geen bron. Voor `mens` mag
   het leeg: dat iemand het zelf invulde is het hele detail.

   `wie` is de codenaam van degene die het zette. Nooit een echte naam: die
   staat in de identiteitskluis en hoort niet in een juridisch feitenspoor dat
   later geexporteerd kan worden. */
function bron(soort, detail, wie) {
  if (!isSoort(soort)) {
    return { error: 'Onbekende bronsoort.',
      uitleg: 'Een juridisch gegeven komt uit een register, een document, een mens of een berekening. Iets anders bestaat hier niet.' };
  }
  const d = typeof detail === 'string' ? detail.trim().slice(0, 200) : '';
  if (!d && soort !== 'mens') {
    return { error: 'Deze bron mist zijn herkomst.',
      uitleg: soort === 'afgeleid'
        ? 'Bij een afgeleid gegeven hoort de regel waarmee het gerekend is.'
        : 'Zeg om welk register of welk document het gaat; anders is de bron een woord en geen bron.' };
  }
  return { ok: true, bron: { soort, detail: d || null, wie: wie || null, hardheid: SOORTEN[soort].hardheid } };
}

/* Welke van twee bronnen wint. Gelijk spel gaat naar de NIEUWE: dat is een
   bewuste keuze en geen toeval -- iemand die vandaag hetzelfde feit opnieuw uit
   hetzelfde register haalt, heeft de verse waarheid. */
function sterkste(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return (b.hardheid >= a.hardheid) ? b : a;
}

/* Het leesbare beeld van een bron, voor een scherm. Draagt altijd de uitleg
   mee: een label zonder uitleg leest als een keurmerk. */
function bronBeeld(b) {
  if (!b || !isSoort(b.soort)) return null;
  const s = SOORTEN[b.soort];
  return { soort: b.soort, label: s.label, uitleg: s.uitleg, detail: b.detail || null, hardheid: s.hardheid };
}

module.exports = { SOORTEN, isSoort, bron, sterkste, bronBeeld };
