/* HET ISOLATIEFILTER -- bevoegd zijn is niet hetzelfde als beschikbaar zijn.

   HET GAT DAT DIT VULT. kern/stuur/beleid.js is closed by default en dat is
   sterk: een pad is pas AI-bedienbaar nadat een mens het bewust heeft
   opgenomen. Maar die lijst is VAST. Zodra een lid in isolatie staat, mag het
   AI-stuur nog steeds precies dezelfde 176 paden kiezen als daarvoor -- de
   beschermstand grijpt pas bij de HTTP-aanroep in, en dan heeft het model de
   handeling al voorgesteld en heeft de gebruiker hem al bevestigd. Een
   weigering aan het eind van die keten is een slechte weigering: hij komt na de
   belofte.

   DE REGEL: WAT DE BESCHERMSTAND ZOU TEGENHOUDEN, STAAT NIET IN DE LIJST
   WAARUIT DE AI KIEST. Dat is dezelfde vorm als de bewijspoort in ./beleid.js,
   die een geschorste capability uit `toegestanePaden` laat vallen. Er komt hier
   dus geen tweede bevoegdheidsmodel bij; er komt een versmalling bij op een
   lijst die al is goedgekeurd.

   HET IS EEN VERSMALLING EN NOOIT EEN VERBREDING, en dat is structureel: de
   uitkomst is per constructie een deelverzameling van wat er binnenkwam. Wie
   hier ooit iets toevoegt, heeft van een beveiligingsfilter een tweede
   allowlist gemaakt -- en dan kan een stand die strenger heet, iets openzetten.

   DE VERSMALLING DRAAGT ALTIJD EEN REDEN. EXECUTIE.md blok 0: de gevaarlijkste
   faalvorm van deze laag is een versmalling die het gevraagde vermogen VERBERGT.
   Dit filter geeft daarom niet alleen de overgebleven paden terug maar ook wat
   er uit ging en waarom, zodat het stuur kan zeggen "dit kan ik nu niet, omdat
   uw account in isolatie staat" in plaats van te doen alsof het niet bestaat. */
'use strict';

/* MET WELKE METHODE EEN PAD WORDT BEOORDEELD, EN WAAROM DAT NIET ALTIJD POST IS.
   De eerste versie beoordeelde alles als POST, en die versneed 42 paden van een
   lid in de beschermstand -- waaronder /api/bank/afschrift en /api/bank/advies.
   Dat zijn LEZERS. In dit huis lopen de meeste lezers over POST (3728 tegenover
   35 GET; zie de kop van kern/beschermstand.js), dus "het is een POST" zegt hier
   niets over wat er gebeurt. De beschermstand belooft met zoveel woorden dat het
   lezen doorloopt; een filter dat een lid zijn eigen afschrift ontneemt, breekt
   die belofte en maakt van de beschermstand alsnog isolatie met een vriendelijke
   naam.

   HET STUUR WEET HET AL, en daarom komt het antwoord daarvandaan in plaats van
   uit een tweede lijst: ./beleid.js deelt elk AI-pad in als `lezen`, `klein` of
   `voorstel`. Wat op de lezen-lijst staat, wordt als GET gewogen. Dat is geen
   aanname over de route maar een oordeel dat een mens al heeft geveld toen hij
   het pad opnam -- en als dat oordeel fout is, is dat een fout in de allowlist
   en niet hier. */
const METHODE = 'POST';

function maakIsolatiefilter({ isolatie, beleid }) {

  function methodeVoor(pad, wereld) {
    if (!beleid || !wereld) return METHODE;
    try { return beleid.beleidVoor(pad, wereld).niveau === 'lezen' ? 'GET' : METHODE; }
    catch (e) { return METHODE; }   /* bij twijfel het strengste; dat is de goede kant om fout te gaan */
  }

  /* Geeft { paden, weggevallen } terug. Nooit meer paden dan er binnenkwamen. */
  function versmal(paden, context, wereld) {
    const binnen = Array.isArray(paden) ? paden : [];
    if (!isolatie || !context) {
      return { paden: binnen, weggevallen: [], actief: false,
        waarom: 'geen isolatiecontext meegegeven; er valt niets te versmallen' };
    }
    const stand = isolatie.effectieveStand(context.standen || {});
    const geldt = stand.beschermd === true || stand.trede === 'isolatie' || stand.tredeOnbepaald === true;
    if (!geldt) {
      return { paden: binnen, weggevallen: [], actief: false, stand,
        waarom: 'geen enkele drager staat in een stand die iets sluit' };
    }

    const blijft = [];
    const weg = [];
    for (const pad of binnen) {
      const b = isolatie.besluit({ pad, methode: methodeVoor(pad, wereld), context });
      if (b.toegestaan) { blijft.push(pad); continue; }
      weg.push({ pad, reden: b.reden, regel: b.regel || null, uitleg: b.uitleg,
        dragers: (b.dragers || []).map(d => d.drager) });
    }
    return { paden: blijft, weggevallen: weg, actief: true, stand,
      waarom: weg.length
        ? weg.length + ' pad(en) vielen weg omdat een drager in een stand staat die ze sluit'
        : 'de stand geldt, maar raakt geen van deze paden' };
  }

  /* De zin die het stuur aan een mens laat zien. Nooit "dat kan ik niet" zonder
     erbij te zeggen waardoor -- een grijze knop zonder uitleg leert mensen dat
     het systeem willekeurig is (GRAMMATICA.md). */
  function uitleg(weggevallen) {
    if (!weggevallen || !weggevallen.length) return null;
    const dragers = [...new Set(weggevallen.flatMap(w => w.dragers))];
    return 'Dit kan nu niet: er staat een beveiligingsstand aan op ' +
      (dragers.length ? dragers.join(' en ') : 'deze omgeving') +
      '. Wat er dichtstaat: ' + [...new Set(weggevallen.map(w => w.regel).filter(Boolean))].join(', ') + '.';
  }

  return { versmal, uitleg, methodeVoor, METHODE };
}

module.exports = { maakIsolatiefilter };
