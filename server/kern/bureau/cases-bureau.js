/* Het Privekantoor, deelbestand "cases-bureau": de kantoor-kant van de zaken.

   Apart van ./cases.js omdat het een ander publiek bedient: hier zit de concierge
   in het RTG-kantoor, niet het lid. En omdat juist HIER de twee grendels zitten
   die de merkregel dragen, en die verdienen een bestand waarin ze niet
   wegvallen tussen de lid-routes:

     1. een BESLOTEN zaak (gezondheid, nalatenschap) komt hier niet binnen. Niet
        gefilterd op het scherm maar bij de bron: wat het bureau nooit krijgt,
        kan het bureau nooit lekken.
     2. 'geregeld' zetten kan alleen hier, en alleen nadat het lid akkoord gaf.
        Een boeking is pas bevestigd als een MENS hem bevestigd heeft; dat is
        geen zin in een systeemprompt maar een functie die de AI-kant en de
        lid-kant niet kunnen aanroepen.

   Gemount via ./cases.js, dat de gedeelde staat (lees, stap, openCase) meegeeft. */
'use strict';

module.exports = (ctx) => {
  const { db, save, liveCodename, notify, lees, stap, openCase, KANTOOR_STATUSSEN, SOORTEN, bezitZet } = ctx;
  const levens = require('../levensdossier')({ db }).voor('bureau');

  function bureauDesk() {
    const uit = [];
    for (const [key, l] of Object.entries(levens.alleLezend())) {
      for (const c of (l.cases || [])) {
        if (!openCase(c) || c.besloten) continue;
        uit.push({ key, codenaam: liveCodename ? liveCodename(key) : '', id: c.id, titel: c.titel,
          wat: c.wat, soort: c.soort, domein: c.domein, status: c.status, at: c.at,
          bedragCenten: c.bedragCenten, team: c.team,
          wachtOpLid: c.beslissing.nodig,
          laatste: (c.tijdlijn[c.tijdlijn.length - 1] || {}).notitie || '' });
      }
    }
    // het langst wachtende verzoek bovenaan; een wachtrij hoort op volgorde
    uit.sort((a, b) => String(a.at).localeCompare(String(b.at)));
    return { status: 200, zaken: uit, statussen: KANTOOR_STATUSSEN, soorten: SOORTEN };
  }

  function bureauVoortgang(key, id, status, notitie) {
    const c = levens.leesVeld(key, 'cases').find(x => x.id === id);
    if (!c) return { status: 404, error: 'Deze zaak is er niet meer.' };
    if (c.besloten) return { status: 403, error: 'Deze zaak is besloten en niet vanaf het bureau te behandelen.' };
    if (!KANTOOR_STATUSSEN.includes(status)) return { status: 400, error: 'Onbekende status.' };
    if (c.beslissing.nodig) return { status: 400, error: 'Dit lid heeft nog geen akkoord gegeven.' };
    stap(c, status, notitie, 'kantoor');

    /* DE STAART VAN EEN INKOOP. Zodra een aankoop geregeld is, schrijft hij
       zichzelf in het Bezittingenregister -- de app die daarover gaat, via zijn
       eigen functie, want een tweede plek waar bezittingen ontstaan is precies
       wat hier niet mag. Vanaf dat moment loopt het voorwerp mee in de graaf en
       vraagt de Control Tower er vanzelf een verzekering en een taxatie bij.

       Dat is de verbinding waar het om gaat: "ik heb X nodig" eindigt niet bij
       de levering maar bij een voorwerp dat verzekerd, getaxeerd en teruggevonden
       kan worden. Faalt het schrijven, dan blijft `gedaan` false en zegt het
       scherm dat er nog iets in het register moet -- stil doorlopen zou een
       aankoop onzichtbaar maken. */
    if (status === 'geregeld' && c.registreren && !c.registreren.gedaan && bezitZet) {
      const r = bezitZet(key, { naam: c.registreren.naam, soort: c.registreren.soort,
        waarde: c.registreren.waarde });
      if (r && r.ok) {
        c.registreren.gedaan = true;
        c.registreren.bezitId = r.bezit && r.bezit.id;
        stap(c, status, 'In uw register gezet als "' + c.registreren.naam + '". Wij vragen u nog om de verzekering.', 'systeem');
      }
    }
    if (notify) {
      try { notify(key, { title: 'Uw Privékantoor', body: '"' + c.titel + '" is nu: ' + status + '.', scope: 'lifestyle' }); }
      catch (e) { /* een melding die niet aankomt mag de statusstap niet omgooien */ }
    }
    save();
    return { status: 200, ok: true };
  }

  return { bureauDesk, bureauVoortgang };
};
