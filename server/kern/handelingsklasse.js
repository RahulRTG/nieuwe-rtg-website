/* ============================================================================
   WAT VOOR HANDELING IS DIT? -- risico en omkeerbaarheid, met een bron per waarde.

   WAAROM DIT ER IS. `server/opzet/envelop.js` draagt WIE er handelt en
   `server/opzet/handeling.js` WAT er verandert. Twee velden bleven daklooss:
   `risicoklasse` en `omkeerbaarheid` (TAKEN.md 4.71). De kop van de envelop legt
   uit waarom ze daar niet horen: een poortwachter kent ze niet, want ze ontstaan
   pas als de handeling bekend is. Deze module is die derde helft, en hij hangt
   dus aan de HANDELING en niet aan de envelop.

   DE REGEL DIE HIER ALLES BEPAALT: ER WORDT NIETS GERADEN. Een verzonnen
   risicoklasse is gevaarlijker dan geen -- dat staat al twee ronden in TAKEN.md
   en het blijft staan. Elke waarde die deze module teruggeeft draagt daarom drie
   dingen: de klasse, de BRON waaruit hij volgt, en de BEWIJSGRAAD van die bron
   (de ladder van BESTUUR.md: onbekend, vermoed, gemeten, bewezen).

   EN `onbekend` IS EEN EERSTEKLAS UITSLAG. Geen enkele bron gevonden betekent
   `onbekend` MET een reden, en nooit stil een middenklasse. Wie dat omdraait
   krijgt een systeem dat over duizenden routes een oordeel uitspreekt dat
   niemand heeft geveld.

   ------------------------------------------------------------------------
   DE TWEE KANTEN WONEN APART, in ./handelingsklasse/. Risico komt uit de bodem
   onder de frictie en de AI-allowlist; omkeerbaarheid uit de herstelproef. Twee
   vragen, twee bronnen, twee bestanden -- en de motivering staat bij de code die
   hem draagt in plaats van in een kop die alles moet uitleggen.

   ------------------------------------------------------------------------
   WAT DEZE MODULE NIET DOET

   - Hij houdt niets tegen. Dit is een classificatie, geen poort. De poorten
     staan in bodem.js, beleid.js en kern/pay/poort.js en blijven daar; twee
     plekken die hetzelfde tegenhouden lopen uiteen (LAT.md regel 4).
   - Hij zegt niets over `intent`. Een intentie spreekt een MENS uit, en dit
     huis heeft geen plek waar dat voor een gewone route gebeurt. Afleiden is
     raden; dat veld blijft dakloos met die reden, en scripts/envelopvelden.js
     dwingt af dat de reden er staat.
   - Hij leest geen gebruiker, geen lijf en geen bedrag. De klasse hangt aan de
     ROUTE en niet aan het geval: een bedrag van tien euro langs de sepa-rail is
     dezelfde handeling als een van tienduizend.
   ========================================================================== */
'use strict';

const { GRADEN } = require('./identiteit/sessievelden');
const { maakRisico, RISICO, ONBEKEND } = require('./handelingsklasse/risico');
const { maakOmkeerbaar, leesHerstel, HERSTEL } = require('./handelingsklasse/omkeerbaar');

/* De classificatie. `deps` is injecteerbaar zodat een toets hem kan voeden
   zonder de echte registers -- en zodat een ontbrekend register een REDEN
   oplevert en geen stille middenklasse. */
function maakHandelingsklasse(deps) {
  const d = deps || {};
  /* `!== undefined` en niet `||`: een MEEGEGEVEN null betekent "deze bron is er
     niet", en dat is iets anders dan "niet meegegeven, pak de echte". Met `||`
     viel een expliciete null terug op de echte bron, en dan is de toets die
     bewijst dat een ontbrekend register `onbekend` oplevert niet te schrijven --
     hij meet dan stil de echte registers. */
  const val = (waarde, echt) => (waarde !== undefined ? waarde : echt());
  const bodem = val(d.bodem, () => { try { return require('./frictie/bodem'); } catch (e) { return null; } });
  const beleid = val(d.beleid, () => { try { return require('./stuur/beleid'); } catch (e) { return null; } });
  const herstel = val(d.herstel, () => leesHerstel(d.wortel));

  const { risicoVan } = maakRisico(bodem, beleid);
  const { omkeerbaarVan } = maakOmkeerbaar(herstel);

  /* De hele uitslag voor een handeling. Nooit gooien: deze laag hangt in het
     antwoordpad van elk verzoek, en een classificatie die een verzoek kan laten
     omvallen is erger dan geen classificatie. */
  function klasseVoor(methode, pad) {
    try {
      const risico = risicoVan(pad);
      const omkeerbaar = omkeerbaarVan(pad);
      return { methode: String(methode || '').toUpperCase() || null, pad: String(pad || '') || null,
        risicoklasse: risico.klasse, risicoBron: risico.bron, risicoGraad: risico.graad,
        risicoReden: risico.reden,
        omkeerbaarheid: omkeerbaar.klasse, omkeerbaarBron: omkeerbaar.bron,
        omkeerbaarGraad: omkeerbaar.graad, omkeerbaarReden: omkeerbaar.reden };
    } catch (e) {
      return { methode: null, pad: String(pad || '') || null,
        risicoklasse: ONBEKEND, risicoGraad: 'onbekend', risicoBron: null,
        risicoReden: 'de classificatie viel om: ' + String((e && e.message) || e).slice(0, 120),
        omkeerbaarheid: ONBEKEND, omkeerbaarGraad: 'onbekend', omkeerbaarBron: null,
        omkeerbaarReden: 'niet vastgesteld, want de classificatie viel om' };
    }
  }

  return { klasseVoor, risicoVan, omkeerbaarVan, beproefdePaden: () => (herstel ? herstel.size : null) };
}

module.exports = { maakHandelingsklasse, RISICO, HERSTEL, ONBEKEND, GRADEN, leesHerstel };
