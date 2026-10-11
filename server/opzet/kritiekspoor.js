/* ============================================================================
   HET SPOOR VOOR DE HANDELING -- geen kritieke mutatie zonder aantoonbaar spoor
   (audit A-P1-05).

   WAAROM. Het handelingsspoor (lib/handelingsspoor.js) schrijft op 'finish' en
   slikt een fout in: een geslaagde geldhandeling kon dus zonder enige regel
   achterblijven, en `save()` keert terug zonder dat er iets STAAT. Voor een
   kritieke handeling is dat precies de valse bevestiging waar het
   inzagejournaal al tegen is gebouwd (inzagelog-vast.js: `noteerVast`).

   WAT HIER GEBEURT, op dezelfde vorm. Voordat een kritieke schrijfhandeling
   wordt uitgevoerd, legt deze poort DUURZAAM een regel vast
   (`stand: 'toegestaan'`, en nooit `uitgevoerd`: de regel zegt dat de handeling
   is VERLEEND). Bevestigt de opslag dat niet, dan gaat de handeling niet door
   (503). Het spoor van het resultaat blijft zoals het was, op 'finish'.

   WELKE HANDELINGEN. Dezelfde lijst als bij het bezitsbewijs (geld, privacy,
   herstelroutes, machtigingen; ../kern/identiteit/bezitspaden.js) plus de
   geldrails van het kantoor, de leverancier en de loonrun. Een lijst met een
   reden per regel; wat hier niet staat, loopt zoals voorheen.
   ========================================================================== */
'use strict';

const { PADEN } = require('../kern/identiteit/bezitspaden');

const SCHRIJFT = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const EXTRA = [
  { pad: '/api/office/bank/', reden: 'geld verlaat het huis via het kantoor' },
  { pad: '/api/supplier/pay/', reden: 'saldo van een zaak naar buiten' },
  { pad: '/api/office/payroll/run', reden: 'een loonrun verplaatst geld van een werkgever' }
];
const KRITIEK = PADEN.concat(EXTRA);

/* PostgreSQL-modus: naast het handelingsspoor komt een regel in het AUDITBOEK
   (server/kern/auditboek, onherschrijfbaar en extern verankerd). Zonder
   PostgreSQL is er geen auditboek en loopt alleen het handelingsspoor, zoals
   voorheen. De regel zegt `toegestaan` en nooit `uitgevoerd`. Lukt het
   vastleggen niet, dan gaat de handeling niet door (503) -- hetzelfde contract
   als hierboven, nu ook voor het boek. De actor komt uit de sessie. */
const REF = /^[A-Za-z0-9_.:-]{1,128}$/;
const actorVan = (wie, pad) => ({
  soort: pad.startsWith('/api/office/') ? 'kantoor' : pad.startsWith('/api/supplier/') ? 'zaak' : 'lid',
  ref: REF.test(wie) ? wie : 'h:' + require('crypto').createHash('sha256').update(String(wie)).digest('hex').slice(0, 24)
});
const boekRegel = (methode, pad, wie) => {
  const boek = require('../kern/auditboek');
  if (!boek.actief()) return null;
  return boek.deelbaar().noteer({ type: 'kritiek.toegestaan', uitkomst: 'toegestaan', actor: actorVan(wie, pad),
    context: { methode, pad: pad.split('?')[0].replace(/[^A-Za-z0-9_\/.-]/g, '_').slice(0, 255) } });
};
const kritiek = (pad) => KRITIEK.find(p => String(pad || '').startsWith(p.pad)) || null;

/* Eén keelgat per deur: de drie auth-poorten roepen `poort()` aan op het punt
   waar de actor uit de SESSIE vaststaat (nooit uit het verzoek). Is de laag niet
   aangesloten (`haak()` niet aangeroepen, bv. een los toetsstel), dan loopt alles
   zoals voorheen; voor wat niet op de lijst staat sowieso. */
let actief = null;
function haak({ handelingsspoor, vastleggen }) {
  if (!handelingsspoor || typeof vastleggen !== 'function') throw new Error('kritiekspoor heeft handelingsspoor en vastleggen nodig');
  actief = { handelingsspoor, vastleggen };
}
function poort(req, res, wie, volgende) {
  if (!actief || !SCHRIJFT.has(req.method)) return volgende();
  const pad = String(req.path || req.url || '');
  if (!kritiek(pad)) return volgende();
  const { handelingsspoor, vastleggen } = actief;
  Promise.resolve().then(() => vastleggen(() => {
    handelingsspoor.noteer({ wie: String(wie || 'anoniem'), methode: req.method, pad, status: 0, stand: 'toegestaan' });
  })).then(uit => uit ? uit : Promise.resolve(boekRegel(req.method, pad, String(wie || 'anoniem'))).then(() => null)).catch(() => ({ status: 503 })).then(uit => {
    if (uit) {
      return res.status(uit.status || 503).json({ error: 'Er is niets uitgevoerd: de handeling kon niet aantoonbaar worden vastgelegd. Probeer het zo opnieuw.',
        spoor: 'niet-vastgelegd' });
    }
    volgende();
  });
}
module.exports = { haak, poort, kritiek, KRITIEK, actorVan };
