/* DE GOUDEN PLAK -- de twee zinnen die de keten van begin tot eind nalopen.

   Apart van ./rail-corpus-zinnen.js omdat het een ander soort regel is. Daar
   staan zinnen die laten zien hoe de machine WEEGT; hier staan de twee die hem
   tot het EIND uitvoeren, en allebei zijn ze met opzet bijzonder: de een draagt
   als enige een `doe`, de ander plant als enige op een verboden pad. Twee
   uitzonderingen tussen de gewone regels zetten maakt van elke gewone regel een
   vraag ("mag dit hier ook?"); apart is het duidelijk dat het er precies twee
   zijn. De naad kwam uit de omvangband van keuringsregel `omvang`.

   ZE ZIJN ALLEBEI NODIG. Alleen de positieve helft bewijst dat het KAN; alleen
   de negatieve bewijst dat het WEIGERT. Samen bewijzen ze dat het verschil door
   het BELEID wordt gemaakt en niet door het corpus -- en dat is precies wat een
   gouden plak hoort te laten zien.

   De uitslag wordt gecontroleerd door scripts/menstaalproef.js (`goudenPlak`)
   en staat als ratel in NORM.json (`goudenPlakGebreken`, richting omlaag). */
'use strict';

module.exports = {
  /* DE GOUDEN PLAK, NEGATIEVE HELFT -- en de enige regel die MET OPZET op een
     verboden pad plant. Zonder deze stap eindigt "parijs vrijdag" op een kaart
     en een vriendelijke zin, en is nergens vast te stellen DAT er voor een lid
     geen reis-capability bestaat: het spoor zou `CAPABILITY_SELECTED:
     OVERGESLAGEN` tonen, en dat leest als "die fase kwam niet aan de beurt" in
     plaats van "er was niets om te kiezen".

     Met deze planstap zegt de echte compileer() het in woorden ("Deze actie
     staat niet op de expliciete AI-allowlist voor member") en draagt het spoor
     `PLAN_COMPILED: PASS` met `uitvoerbaar: false`. Dat is de eerlijke uitkomst
     die de eigenaar heeft gevraagd: een expliciete bestaande status in plaats
     van stilte.

     `bewustVerboden` is geen uitzondering op de regel maar de verklaring ervan:
     test/stuurrail.test.js toets 10 houdt tegen dat een corpusregel PER ONGELUK
     op een verboden pad wijst, en een regel die het met een reden opschrijft is
     het tegenovergestelde van per ongeluk. Verdwijnt de reden, dan zakt de
     toets alsnog. */
  'parijs vrijdag': {
    bewustVerboden: 'er bestaat voor een lid geen reis-capability; deze regel BEWIJST dat ' +
      'in plaats van eromheen te lopen (de gouden plak, negatieve helft)',
    stappen: [
      { tools: [{ name: 'kaart', input: {} }] },
      { tools: [{ name: 'plan', input: { doel: 'een reis naar Parijs op vrijdag klaarzetten',
        stappen: [{ id: 's1', capability: '/api/reisbureau/boek', invoer: {}, afhankelijkVan: [] }] } }] }
    ],
    projectie: 'Parijs \u00b7 vrijdag\nDit kan ik niet voor je regelen: reizen boeken staat niet ' +
      'op wat ik namens jou mag doen. Wat ik wel kan is het klaarzetten in je agenda.' },
  /* DE GOUDEN PLAK, POSITIEVE HELFT -- en de enige regel in dit corpus die een
     `doe` draagt. De kopregel hierboven zegt dat er nooit een `doe` in staat,
     en dat was waar zolang het corpus alleen de WEGING moest laten zien. Maar
     een keten die nooit tot het eind wordt uitgevoerd, is tot het eind ook
     nooit bewezen: CAPABILITY_SELECTED en EXECUTED waren tot nu toe altijd
     OVERGESLAGEN, en dat is geen bewijs maar een leegte.

     ER WORDT HIERMEE NIETS IN GANG GEZET, en dat is geen belofte maar de
     uitkomst van de poort: /api/agenda/toevoegen staat op niveau `voorstel`,
     dus de server geeft 428 met een goedkeuring terug en er verandert niets aan
     de agenda. Bevestigen doet de mens, buiten dit gesprek om -- precies de
     grens die de hele laag bewaakt. In het contract staat dit geval daarom als
     enige op `sideEffectMax: klaarzetten` (menstaal.json, act-agenda-tandarts).

     `begrepen` is een ZIN en geen vlag: kern/rahul/twijfel.js weigert een
     `doe` waarvan niet in woorden staat wat er gebeurt en voor wie. Dat is
     tijdens het ijken van de menstaalproef een keer misgegaan en het is de
     goedkoopste manier om hier een uur te verliezen. */
  'zet de tandarts vrijdag om 14 00 in mijn agenda': {
    stappen: [
      { tools: [{ name: 'kaart', input: {} }] },
      { tools: [{ name: 'plan', input: { doel: 'de tandarts vrijdag om 14:00 in de agenda zetten',
        stappen: [{ id: 's1', capability: '/api/agenda/toevoegen', invoer: {}, afhankelijkVan: [] }] } }] },
      { tools: [{ name: 'doe', input: { pad: '/api/agenda/toevoegen',
        zeker: true, begrepen: 'de tandarts vrijdag om 14:00 in de agenda van dit lid zetten',
        body: { titel: 'Tandarts', datum: '2026-09-18', tijd: '14:00' } } }] }
    ],
    projectie: 'Tandarts \u00b7 vrijdag 14:00\nIk heb het klaargezet. Er verandert nog niets ' +
      'in je agenda: bevestigen doe je zelf.' }
};
