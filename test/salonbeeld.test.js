/* EEN BEELD DAT ERGENS ANDERS NOG HANGT, MAG NIET MEEVERDWIJNEN.

   WAT ER MISGING. De Salon houdt hooguit MAX_POSTS berichten; wat eruit valt,
   valt eruit. kap() gaf de mediaverwijzingen van die posts door aan wis(), en
   die gooide ze allemaal weg. Maar dezelfde afbeelding kan elders nog hangen --
   een zaak die haar Salon-foto ook als paginafoto gebruikt, een profiel, een
   clip. Viel de post uit het venster, dan verdween de foto van die zaak.

   Zonder dat iemand iets verwijderde. Zonder melding. Zonder spoor. Het beeld
   was er gewoon niet meer, en de pagina wees naar een bestand dat niet bestond.

   DE REPARATIE: eerst kijken of de verwijzing nog ergens in de opslag staat. Dat
   gaat op de hele opslag in een keer, want de refs zijn lange unieke reeksen --
   betrouwbaarder dan een lijst van "alle plekken waar een beeld kan hangen", die
   gegarandeerd achterloopt op de code.

   EN BIJ TWIJFEL BEWAREN. Kan de opruimer niet kijken (geen db meegekregen, of
   de opslag laat zich niet serialiseren), dan wist hij NIETS. Een opruimer die
   te weinig opruimt kost schijfruimte; een die te veel opruimt kost het werk van
   een ander. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const maakMediaOpruim = require('../server/kern/mediaopruim');

// een nagemaakte media-laag: hij onthoudt alleen WAT er gewist zou worden
function nepMedia() {
  const gewist = [];
  return {
    gewist,
    isRef: (v) => typeof v === 'string' && v.startsWith('media:'),
    verwijder: (ref) => { gewist.push(ref); }
  };
}

test('een beeld dat nog op een pagina staat, blijft staan als de post verdwijnt', () => {
  const media = nepMedia();
  const db = { data: {
    posts: [],                                   // de post is net uit het venster gevallen
    suppliers: [{ code: 'KIKUNOI', foto: 'media:abc123' }]   // maar de zaak gebruikt hem nog
  } };
  const opruim = maakMediaOpruim(media, db);
  opruim.wis(['media:abc123']);
  assert.deepEqual(media.gewist, [],
    'dit beeld hangt nog bij een zaak; het weggooien haalt haar paginafoto weg zonder dat iemand iets verwijderde');
});

test('een beeld dat echt nergens meer staat, gaat wel weg', () => {
  const media = nepMedia();
  const db = { data: { posts: [], suppliers: [{ code: 'KIKUNOI', foto: 'media:iets-anders' }] } };
  const opruim = maakMediaOpruim(media, db);
  opruim.wis(['media:wees999']);
  assert.deepEqual(media.gewist, ['media:wees999'],
    'een weesbeeld hoort wel opgeruimd te worden; anders groeit de opslag eeuwig door');
});

test('zonder zicht op de opslag wist de opruimer niets', () => {
  const media = nepMedia();
  const opruim = maakMediaOpruim(media);   // geen db: hij kan niet kijken
  opruim.wis(['media:abc123']);
  assert.deepEqual(media.gewist, [],
    'kan hij niet kijken, dan hoort hij te bewaren; te weinig opruimen kost schijf, te veel kost het werk van een ander');
});
