/* Het Privekantoor, deelbestand "graaf-platform": wat het platform al van u weet.

   ALLE ANDERE BRONNEN LEZEN WAT HET LID ZELF HEEFT INGETYPT. Dat was de grootste
   zwakte van dit kantoor: leeg dossier, leeg kantoor. Wie zijn paspoorten, zijn
   installaties en zijn polissen niet invoert, kreeg een Control Tower die
   opgewekt "alles onder controle" meldde omdat er nul datums in stonden -- en
   dat is niet geruststellend maar onwetend.

   Terwijl RTG dit lid al kent. Hij boekt hier tafels, hotels en activiteiten, en
   hij houdt hier zijn agenda bij. Die twee stromen kosten hem geen enkele extra
   handeling en staan al in de database. Dit bestand haalt ze de graaf in, zodat
   het kantoor op dag EEN iets te zeggen heeft.

   TWEE DINGEN DIE DIT NIET IS:

   Geen kopie. Zelfde regel als de rest: dit is een projectie. Een boeking blijft
   van de boekingenlaag, de agenda blijft van kern/agenda.js. Wij lezen alleen, en
   wij schrijven nergens iets terug.

   Geen verzinsel. `md.invoices` is bewust NIET aangesloten, hoe verleidelijk ook.
   De vervaldatum van een factuur staat daar als proza -- "Vervalt 1 augustus
   2026" -- en dat is geen datum die een machine mag lezen. Zou ik die tekst gaan
   ontleden, dan hangt er in de tower een termijn die op een taalregel rust; bij
   de eerste Engelse factuur staat hij op de verkeerde dag of valt hij stil weg.
   Zodra een factuur een echt datumveld heeft, hoort hij hier thuis en niet
   eerder.

   DE PRIJS VAN DE BOEKINGEN, en die staat hier omdat hij echt is: db.data.boekingen
   is EEN platte lijst voor het hele platform, dus hem per lid uitfilteren is een
   doorloop over alles wat er ooit is geboekt. Bij vijftigduizend boekingen kost
   dat een paar milliseconden per schermbezoek. Dat is te doen -- en het is
   gemeten, niet aangenomen (zie test/bureau.test.js) -- maar het is wel de reden
   dat er alleen naar de TOEKOMST wordt gekeken en dat er een dak op het aantal
   knopen staat. Krijgt de boekingenlaag ooit een index per lid, dan hoort die
   hier gebruikt te worden.

   Gemount via ./bronnen.js. */
'use strict';

const H = require('./hulp');
const { PERSOONLIJK, VERTROUWELIJK, isDatum, vandaag, lijst } = H;
/* De agenda ligt onder 'lid:<key>' en niet onder de kale sleutel. Die regel komt
   uit kern/agenda.js zelf en wordt hier NIET overgeschreven: zou hij hier als
   'lid:' + key staan, dan leest deze bron na de eerste wijziging van dat
   voorvoegsel een lege lijst en verdwijnt de agenda stil uit het kantoor. */
const { agendaLidSleutel } = require('../agenda');

/* Statussen waarbij een boeking geen aandacht meer vraagt. Een afgewezen tafel
   van volgende week hoort niet in uw week te staan. */
const DOOD = new Set(['afgewezen', 'geannuleerd', 'afgerond', 'afgerekend', 'vervallen']);

// hoeveel knopen dit bestand maximaal maakt; zie de kop
const DAK_BOEKINGEN = 200;
const DAK_AGENDA = 200;

/* EEN DAK DAT ZWIJGT IS EEN LEUGEN. Wie tweehonderd agenda-items vooruit heeft
   staan krijgt er hier tweehonderd, en zou zonder deze melding denken dat dat
   alles was -- op een scherm dat "alles onder controle" durft te zeggen is dat
   precies de verkeerde stilte. De bron geeft daarom een merkteken af dat
   ./graaf.js oppikt en ./nu.js op het scherm zet, langs dezelfde weg als een
   bron die omvalt. */
const afgekapt = (bron, dak) => ({ __afgekapt: { bron, dak } });

// 'YYYY-MM-DD' of 'YYYY-MM-DD HH:MM' -> de kale datum, of leeg
const dagVan = w => {
  const d = String(w || '').slice(0, 10);
  return isDatum(d) ? d : '';
};

const PLATFORM = [
  /* ---- Boekingen: tafels, hotels, activiteiten die nog moeten komen ---- */
  { kamer: 'gelegenheden', knopen(l, K, ctx) {
    const db = ctx && ctx.db, key = ctx && ctx.key;
    if (!db || !key) return [];
    const alle = lijst(db.data && db.data.boekingen);
    const t = vandaag();
    const uit = [];
    for (const b of alle) {
      if (b.customerKey !== key) continue;
      if (DOOD.has(b.status)) continue;
      const dag = dagVan(b.wanneer);
      if (!dag || dag < t) continue;
      const dienst = (b.service && b.service.name) || 'boeking';
      uit.push(K({ id: 'boeking:' + (b.ref || b.id), soort: 'boeking',
        naam: dienst + (b.supplierName ? ' · ' + b.supplierName : ''),
        kamer: 'gelegenheden', bron: 'Boekingen', gevoelig: PERSOONLIJK,
        /* De partner weet hier al van -- hij is de andere kant van deze boeking.
           Voor het concierge-bureau achterhouden wat de leverancier zelf op zijn
           scherm heeft staan, beschermt niemand. */
        deel: 'kantoor',
        vervalt: dag, vervaltWat: 'boeking' }));
      if (uit.length >= DAK_BOEKINGEN) { uit.push(afgekapt('Boekingen', DAK_BOEKINGEN)); break; }
    }
    return uit;
  } },

  /* ---- De eigen agenda van het lid ----
     Die staat al per sleutel (db.data.agendas[key]), dus hier geen doorloop over
     het platform.

     VERTROUWELIJK en niet verder dan de Rechterhand: in een eigen agenda kan
     letterlijk alles staan, ook een afspraak die het lid nooit aan een
     concierge zou vertellen. Wij weten niet WAT erin staat, en dat is precies de
     reden om hem niet door te geven. */
  { kamer: 'prive', knopen(l, K, ctx) {
    const db = ctx && ctx.db, key = ctx && ctx.key;
    if (!db || !key) return [];
    const mijn = lijst(db.data && db.data.agendas && db.data.agendas[agendaLidSleutel(key)]);
    const t = vandaag();
    const uit = [];
    for (const i of mijn) {
      if (i.gedaan) continue;
      if (!isDatum(i.datum) || i.datum < t) continue;
      uit.push(K({ id: 'agenda:' + i.id, soort: 'afspraak', naam: i.titel,
        kamer: 'prive', bron: 'Agenda', gevoelig: VERTROUWELIJK, deel: 'rechterhand',
        vervalt: i.datum, vervaltWat: 'afspraak' }));
      if (uit.length >= DAK_AGENDA) { uit.push(afgekapt('Agenda', DAK_AGENDA)); break; }
    }
    return uit;
  } }
];

module.exports = PLATFORM;
