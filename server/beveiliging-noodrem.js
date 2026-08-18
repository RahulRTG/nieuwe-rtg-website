/* DE NOODREM-LADDER -- de automatische kant van server/beveiliging.js.

   Afgesplitst op de 10 kB-grens, en op een echte naad. Het bestand hiernaast is
   een JOURNAAL: het neemt meldingen aan, voegt ze samen, vat ze samen en handelt
   ze af. Dit is iets anders: het KIJKT naar dat journaal en grijpt in. Die twee
   veranderen om verschillende redenen -- de ene als er een nieuw soort melding
   bij komt, de andere als we anders over aanvallen gaan denken -- en ze delen
   alleen de lijst meldingen.

   De drempels en de dooftijden staan hier en niet hiernaast: ze horen bij deze
   ladder en bij niets anders.

   isoleerBron komt als `isoleer` binnen en niet als waarde: hij wordt pas in
   opzet/diensten2.js aan De Wacht gehangen, dus wie hem hier vastpakt houdt een
   null vast.

   DE LADDER IN EEN ZIN PER TREDE: elke bron met een brute-force-alarm gaat
   individueel in de zelf-dovende quarantaine (lokaal eerst), vanaf drie bronnen
   gaat de registratie een uur dicht, en vanaf zes de inlogpaden tien minuten. De
   onderhouds-zekering (hele app op 503) springt NOOIT automatisch: een
   verdediging die van een brute force een totale uitval maakt, is een
   DoS-versterker. Dat is gemeten en niet bedacht -- zie de kop van
   test/noodrem-bron.test.js. */
'use strict';

const NOODREM_VENSTER_MS = 10 * 60000; // aanvalsvenster voor de automatische noodrem
const NOODREM_REGISTRATIE = 3;   // brute force vanaf zoveel bronnen -> registratie tijdelijk dicht
const NOODREM_INLOGPAUZE = 6;    // ... vanaf zoveel bronnen -> inlogpaden tijdelijk dicht
const NOODREM_REG_MS = 60 * 60000;   // de registratie dooft vanzelf na een uur
const NOODREM_LOGIN_MS = 10 * 60000; // de inlogpauze dooft vanzelf na tien minuten

module.exports = ({ lijst, zekeringen, autoStaat, save, meld, isoleer }) => {
  const isoleerBron = isoleer;
  /* DE NOODREM-LADDER: van lokaal en tijdelijk naar breed en tijdelijk, en
     nooit meer vanzelf naar "hele app op slot".

     De eerste versie trok bij zes bronnen de ONDERHOUDS-zekering: totale
     uitval, permanent tot de eigenaar hem resette. De mega-beproeving liet
     zien wat dat waard is -- de storm spoofte zes bronnen op de inlog en de
     hele app stond de rest van de run op 503. Een verdediging die van een
     brute force een totale uitval maakt, is een DoS-versterker; en flood.js
     zei het huisprincipe al: een reflex die blijft hangen is geen
     bescherming.

     De ladder, elke trede tijdgebonden en met de eigenaar op de hoogte:
       1. ELKE bron met een brute-force-alarm gaat individueel in quarantaine
          (de bestaande, zelf-dovende isoleer van De Wacht) -- lokaal eerst.
       2. Vanaf drie bronnen: de REGISTRATIE dicht, dooft na een uur.
       3. Vanaf zes bronnen: de INLOGPAUZE -- alleen de in- en
          uitschrijfpaden dicht, dooft na tien minuten. Wie al is ingelogd
          merkt niets: de schade-scope is de aanvals-scope.
     De onderhouds-zekering springt nooit meer automatisch; die is van de
     eigenaar.

     WAT ER GETELD WORDT ZIJN AANVALLERS EN GEEN DEUREN. Hier stond de meldingssleutel
     venster een brute-force-alarm gaven. Vanaf drie gaat de registratie-
     zekering eruit (geen nieuwe accounts), vanaf zes de onderhouds-zekering
     (hele app op slot, alleen de eigenaar erin).

     AANVALLERS, EN NIET DEUREN -- dat was de fout. Hier stond `.map(m => m.sleutel)`,
     en die sleutel is `brute-force|<bucket>`. Een bucket is fijnmazig met opzet:
     'auth:<ip>:<inlognaam>' (server/server.js). De inlognaam hoort daarin voor de
     snelheidsrem, want anders zet iemand het account van een ander op slot door
     het fout te raden -- maar hij hoort NIET in de telling van deze noodrem.

     Wat er daardoor gebeurde: een script vanaf EEN adres dat zes gebruikersnamen
     probeert leverde zes "bronnen" op, en het hele platform ging in onderhoud.
     Dat is credential stuffing, de meest gewone aanval die er is, en het
     antwoord erop was een zelf toegebrachte storing voor alle echte gebruikers.
     De aanvaller had geen enkel account nodig, alleen zes namen. Hetzelfde gold
     voor de tien route-families met hun eigen prefix ('sup:', 'join:', 'tech:'):
     een aanvaller die langs zes deuren liep telde als zes aanvallers.

     De maat is nu `meta.aanvaller` -- het adres dat klopte. Ontbreekt die (een
     aanroep die hem vergat), dan valt hij terug op de sleutel: dat is de oude,
     te schrikachtige stand, en server.js zegt het er hoorbaar bij.

     GEVONDEN MET EEN METING en niet met nadenken: de A/B van npm run beproeving
     liet rondes zien met 87.963 keer 503 en een server die na de storm helemaal
     niet meer openging, afgewisseld met rondes die schoon waren -- op dezelfde
     code. Het was een race om deze drempel. test/noodrem-bron.test.js legt hem
     vast zonder storm. */
  function noodrem() {
    if (!autoStaat().aan) return;
    const nu = Date.now();
    /* Het ADRES DAT KLOPT (meta.aanvaller), niet de deur waarop geklopt werd
       (meta.bron is de bucket, met de inlognaam erin) en niet de meldings-
       sleutel: de quarantaine van trede 1 moet een adres isoleren en geen
       etiket, en de telling eronder moet aanvallers tellen en geen deuren.
       meta.bron blijft de terugval voor een melding die nog geen aanvaller
       meegaf; server.js meldt zo'n aanroep hoorbaar. */
    const bronnen = new Set(lijst()
      .filter(m => m.type === 'brute-force' && (nu - m.atMs) < NOODREM_VENSTER_MS)
      .map(m => (m.meta && (m.meta.aanvaller || m.meta.bron)) || '').filter(Boolean));
    if (isoleerBron) {
      for (const bron of bronnen) { try { isoleerBron(bron, 'noodrem: brute force'); } catch (e) {} }
    }
    if (bronnen.size >= NOODREM_REGISTRATIE) spring('registratie', bronnen.size, NOODREM_REG_MS);
    if (bronnen.size >= NOODREM_INLOGPAUZE) spring('inlogpauze', bronnen.size, NOODREM_LOGIN_MS);
  }
  function spring(id, aantalBronnen, totMs) {
    const z = zekeringen()[id];
    if (!z || z.aan === false) return; // al gesprongen: niets te doen
    z.aan = false;
    z.reden = 'automatische noodrem: brute force vanaf ' + aantalBronnen + ' bronnen';
    z.sindsGesprongen = Date.now();
    z.tot = Date.now() + (totMs || NOODREM_LOGIN_MS);   // tijdgebonden: dooft vanzelf
    save();
    meld('auto-reactie', 'kritiek',
      'Automatische noodrem: de zekering "' + z.naam + '" is eruit gehaald (brute force vanaf ' +
      aantalBronnen + ' bronnen binnen tien minuten). Hij dooft vanzelf over ' +
      Math.round((totMs || NOODREM_LOGIN_MS) / 60000) + ' min; op de technische pagina kun je hem eerder resetten.',
      { bron: 'zekering:' + id });
  }

  return { noodrem };
};
