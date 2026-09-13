/* Media OS (deelmodule): DISCOVERY -- een lid kan een aanwezigheid VINDEN.

   HET GAT DAT DIT DICHT (13 september 2026). Schakel 2 van
   scripts/momentproef.js stond open met een uitgeschreven reden: er was geen
   enkele route die aanwezigheden opsomt of doorzoekt. `aanwezigMet` vraagt een
   id dat de fan al moet kennen en `aanwezigMijn` toont alleen wat hij AL volgt
   -- dus een fan kon een festival alleen volgen als iemand hem het id had
   doorgegeven. Volgen was bereikbaar en vinden niet.

   EN DIT MAAKT GEEN PUBLIEKE KANT. Dat is de grens, en hij staat niet voor
   niets in routes/festival/gast.js: "er is in dit huis geen publieke kant, en
   een line-up is het eerste dat er een van zou maken". Deze zoeker hangt daarom
   aan de LEDENdeur (`auth` op de route) en kent geen anonieme ingang. Wat hij
   toont is bovendien niets nieuws: een aanwezigheid ontstaat doordat iemand
   PUBLIEK optreedt, en het beeld draagt alleen de naam, de drager en wat er
   wordt uitgezonden.

   EIGEN BESTAND en niet onderin ./aanwezigheid.js, om dezelfde reden als
   ./tijdlijn.js: die module gaat over de aanwezigheid en de volgrelatie, dit
   over ZOEKEN. Samen duwden ze haar bovendien over de 10 kB-grens.

   DRIE DINGEN DIE HIJ MET OPZET NIET DOET, en alle drie komen ze uit STAGE.md
   par. 5:

   1. GEEN VOLGERSTELLING. Niet in de uitvoer en niet als sorteersleutel. Een
      lijst op populariteit is een ranglijst, en de meeteenheid van deze laag is
      de gebeurtenis en nooit de mens. Er wordt op NAAM gesorteerd -- saai,
      stabiel, en het zegt niets over iemands publiek.
   2. GEEN AANBEVELING. Hij beantwoordt wat je vraagt en stelt niets voor. Een
      "misschien ken je"-lijst is precies de trechter die LIFE.md par. 4
      tegenhoudt.
   3. GEEN MENSEN ZOEKEN OP EEN ECHTE NAAM. De drager is een codenaam of een
      zaakcode; er komt geen naam uit de kluis langs. */
'use strict';

const LIMIET = 50;

module.exports = ({ aanwezig, SOORTEN }) => {
  const soorten = Array.isArray(SOORTEN) ? SOORTEN : [];

  function zoek(key, vraag, soort) {
    const alles = aanwezig.aanwezigAlle();
    const q = String(vraag == null ? '' : vraag).trim().toLowerCase().slice(0, 60);
    const s = soorten.includes(soort) ? soort : null;
    const raak = alles
      .filter(a => !s || a.soorten.includes(s))
      .filter(a => !q || String(a.naam || '').toLowerCase().includes(q))
      /* Jezelf hoef je niet te vinden: volgen zou toch 400 geven ("Dit bent u
         zelf"), en een treffer waar je niets mee kunt is een dood spoor. */
      .filter(a => !(a.drager.soort === 'lid' && a.drager.code === key))
      .sort((x, y) => String(x.naam).localeCompare(String(y.naam)));
    return {
      aanwezigheden: raak.slice(0, LIMIET)
        .map(a => Object.assign({}, aanwezig.aanwezigBeeld(a), { volgIk: aanwezig.aanwezigVolgtHij(key, a.id) })),
      gevonden: raak.length,
      /* Even groot erbij, want een afgekapte lijst die dat niet zegt leest als
         een volledige lijst. */
      afgekapt: raak.length > LIMIET ? LIMIET : null,
      watDitNietDoet: 'Er staat geen volgorde op populariteit en geen aanbeveling: gesorteerd op naam, en alleen wat u vroeg.'
    };
  }

  return { aanwezigZoek: zoek };
};
