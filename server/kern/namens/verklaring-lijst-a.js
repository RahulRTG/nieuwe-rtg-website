/* HET VERKLARINGSREGISTER, deel data (eerste helft: een MENS aan beide kanten).

   De uitleg over WAAROM dit register bestaat, wat de drie standen betekenen en
   waarom een grond verplicht is, staat in ./verklaring.js -- daar worden beide
   helften ook weer aan elkaar geplakt. Hier staat alleen data.

   AFGESPLITST OMDAT PRODUCTCODE ONDER DE 10 KB HOORT (keuringsregel 13), en de
   snede loopt langs een echte naad en niet op de byte: in deze drie staat aan
   BEIDE kanten een mens, en alle drie voeren ze `aanvaarden`. De vier in
   ./verklaring-lijst-b.js hebben aan de ontvangende kant een machine, een
   instantie, een incassant of een derde partij -- en daar wonen alle
   uitzonderingen en alle openstaande posten. Wie die twee door elkaar zet,
   leest de uitslag als toeval in plaats van als vorm. */
'use strict';

module.exports = {

  vertegenwoordiging: {
    wat: 'een mens handelt namens een mens',
    waar: 'server/kern/vertegenwoordiging/',
    werkwoorden: {
      verlenen: { stand: 'voert', waar: 'acties.js voorstel()' },
      aanvaarden: { stand: 'voert', waar: 'acties.js aanvaard()',
        aanvaarding: {
          wieGeeft: 'de cliënt, op zijn eigen sessiesleutel',
          wieOntvangt: 'de vertegenwoordiger, op codenaam',
          wieAanvaardt: 'de cliënt zelf; er is geen tweede pad en het kantoor kan er niet bij',
          welkeVersie: 'de machtiging met haar bevoegdheden, plafond en looptijd op dat moment',
          wanneer: 'het veld `aanvaard`, in ISO',
          welkBewijs: 'een regel in het spoor van de cliënt, duurzaam vastgelegd',
          bijIntrekking: 'de machtiging stopt; het spoor blijft staan -- intrekken stopt de toekomst, niet het verleden'
        } },
      versmallen: { stand: 'voert', waar: 'handelen.js grensZet(), raakt ook lopende machtigingen' },
      intrekken: { stand: 'voert', waar: 'acties.js intrek()' },
      verlopen: { stand: 'voert', waar: 'machtiging.js stand(), berekend uit de klok' },
      handelen: { stand: 'voert', waar: 'handelen.js handel() via magHandelen()' },
      spoor: { stand: 'voert', waar: 'acties.js spoor(), groeit aan en houdt ook een geweigerde poging vast' }
    }
  },

  bijstand: {
    wat: 'RTG handelt namens een zakelijke klant, op uitnodiging',
    waar: 'server/kern/command/bijstand*.js',
    werkwoorden: {
      verlenen: { stand: 'voert', waar: 'bijstand-rtg.js stelVoor()' },
      aanvaarden: { stand: 'voert', waar: 'bijstand-klant.js besluit() -- alleen de klantkant maakt een sessie aan',
        aanvaarding: {
          wieGeeft: 'RTG, met een voorstel op naam',
          wieOntvangt: 'de bijstandssessie van RTG, met één organisatie en één onderwerp',
          wieAanvaardt: 'de klant, en alleen ./bijstand-klant.js kent een functie die een sessie aanmaakt',
          welkeVersie: 'het voorstel met onderwerp, niveau en looptijd',
          wanneer: 'bij het besluit van de klant',
          welkBewijs: 'de sessie zelf plus het spoor; zonder besluit bestaat er geen sessie',
          bijIntrekking: 'sluit() beëindigt de sessie; het spoor van wat er gebeurde blijft'
        } },
      versmallen: { stand: 'voert', waar: 'bijstand-niveaus.js ruimteVan(), per niveau' },
      intrekken: { stand: 'voert', waar: 'bijstand-klant.js trekIn() en sluit()' },
      verlopen: { stand: 'voert', waar: 'duurVan() plus stand(), berekend' },
      handelen: { stand: 'voert', waar: 'betreed() en voerUit()' },
      spoor: { stand: 'voert', waar: 'spoor() en noteer()' }
    }
  },

  servicemachtiging: {
    wat: 'een medewerker werkt in het dossier van een melder',
    waar: 'server/kern/service/machtiging*.js',
    werkwoorden: {
      verlenen: { stand: 'voert', waar: 'machtiging.js verleen()' },
      aanvaarden: { stand: 'voert', waar: 'kern/service/bevestiging.js -- vraag() en bevestig()',
        opmerking: 'de meter ziet dit niet omdat de bevestiging in een EIGEN module woont en niet in ' +
          'kern/service/machtiging*.js. Dat is geen toeval maar de opzet: bevestiging.js bestaat juist ' +
          'omdat de vaste steuncode het niet werd, en het is een handeling van het LID terwijl de ' +
          'machtiging de kant van het team is. `bevestig()` levert de machtiging pas op nadat het lid ' +
          'heeft gedrukt -- een bevestiging zonder machtiging is een knop zonder gevolg, en een ' +
          'machtiging zonder bevestiging is precies wat die laag voorkomt.',
        aanvaarding: {
          wieGeeft: 'het lid dat de zaak meldde',
          wieOntvangt: 'het team, niet de persoon -- de machtiging hangt aan de zaak',
          wieAanvaardt: 'het lid zelf, in zijn eigen app: het ziet WIE er vraagt, VOOR WELKE ZAAK en WAT ' +
            'die persoon daarmee opent, en drukt dan. Geen code die wordt voorgelezen.',
          welkeVersie: 'de doorsnede met wat het team voor DEZE zaak nodig heeft; wat het lid bevestigt ' +
            'is hetzelfde als wat er daarna opengaat',
          wanneer: 'bij de bevestiging; de terugvalcode leeft vijf minuten en werkt één keer',
          welkBewijs: 'de zaaktijdlijn in kern/service/loop.js, plus de bevestiging zelf',
          bijIntrekking: 'de machtiging vervalt en de tijdlijn blijft staan: intrekken stopt de toekomst en niet het verleden'
        } },
      versmallen: { stand: 'voert', waar: 'verleen() rekent de doorsnede met wat het team nodig heeft',
        opmerking: 'de meter zet dit op ontbrekend: hij zoekt een naam die met `versmal` of `doorsnede` ' +
          'begint, en hier heet het werkwoord `verleen`. Lexicaal gemist, in de bron aanwezig.' },
      intrekken: { stand: 'voert', waar: 'machtiging.js intrek()' },
      verlopen: { stand: 'voert', waar: 'stand() leest de klok bij elke vraag' },
      handelen: { stand: 'voert', waar: 'magNu()' },
      spoor: { stand: 'voert', waar: 'kern/service/loop.js -- de zaaktijdlijn, buiten deze module',
        opmerking: 'de meter ziet dit niet omdat het spoor in een andere module woont. Dat is geen gat ' +
          'maar een bereikgrens van de meting; REPRESENTATIE.md par. 0.4 zegt dit met zoveel woorden.' }
    }
  }
};
