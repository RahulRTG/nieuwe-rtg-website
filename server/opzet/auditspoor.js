/* ============================================================================
   HET API-SPOOR -- elke geslaagde schrijfhandeling laat een regel na die
   niemand ongemerkt kan wijzigen.

   DE KOLOM DIE HIER LEEG STOND. In BEWIJSMATRIX.json heeft elke route elf
   schakels, en AUDIT ("blijft er een spoor achter dat niemand kan wissen")
   stond op 4182 van de 4182 ONGEMETEN -- niet gezakt, want er werd niet eens
   gekeken. De opdracht die er al bij stond: "een hashketen over het auditlog;
   die bestaat nog niet als algemene voorziening".

   DAT KLOPTE MAAR VOOR DE HELFT. De hashketen bestaat wél -- server/kern/
   command/journaal.js draagt per regel de hash van de vorige en van zichzelf,
   en controleer() wijst de eerste breuk aan. Wat ontbrak was BEREIK: alleen
   RTG Command schreef erin. Een besluit in de boardroom liet een spoor na, een
   POST die een bedrijf oprichtte niet.

   Dus geen tweede journaal. Deze laag zet dezelfde module nog een keer op, met
   een eigen VAK (die mogelijkheid zit er al in), en schrijft daar elke
   geslaagde schrijfhandeling in weg. Twee redenen voor dat aparte vak:

   1. HET COMMAND-JOURNAAL BLIJFT LEESBAAR. Daar staan besluiten in, met een
      reden en een oude en nieuwe toestand. Als elke API-aanroep ertussen komt,
      is dat venster van 5000 regels binnen een dag vol met ruis en is de
      boardroom-tijdlijn onbruikbaar.
   2. TWEE KETENS BREKEN APART. Een breuk in het API-spoor zegt iets anders dan
      een breuk in het besluitjournaal, en dat verschil hoort zichtbaar te
      blijven.

   WAT ER IN EEN REGEL STAAT, EN VOORAL WAT NIET. Wie (een sleutel, nooit een
   naam), wat (methode en pad), wanneer, en met welke status. HET LIJF GAAT ER
   NIET IN. Dat is geen zuinigheid maar de kern van het privacy-ontwerp: een
   auditlog dat elk verzoeklijf bewaart, is een tweede kopie van de hele
   database, en dan is het auditlog zelf het datalek. Dezelfde regel als in
   server/inzagelog.js, dat om die reden wel het ID maar nooit de opgevraagde
   naam bewaart.

   WIE ER HANDELT KOMT NOOIT UIT HET LIJF. De actor komt uit de sessie die de
   route zelf heeft vastgesteld (req.session, req.supplier), en anders uit een
   geverifieerde sessie. Een spoor waarin de beller zijn eigen naam mag zetten,
   is geen spoor.

   WAT DIT NIET IS. De keten bewijst dat de regels ONDERLING kloppen: wie er een
   wijzigt of tussenuit knipt, breekt hem. Hij bewijst niet dat er niets vóór
   het venster is verdwenen (daarvoor telt `aantal` onafhankelijk door), en hij
   bewijst niets tegen iemand die de HELE keten opnieuw uitrekent. Daarvoor zou
   het kopzegel periodiek buiten de deur moeten worden vastgelegd; dat is een
   volgende stap en staat in TAKEN.md, niet in een belofte hier.
   ========================================================================== */
'use strict';

const crypto = require('crypto');
const { maakJournaal } = require('../kern/command/journaal');

const SCHRIJFT = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/* Wat er NIET in hoort. Het interne clustergesprek (poortwachter <-> servers,
   loopback, elke seconde) en de gezondheidsprikken zouden het venster vullen
   met verkeer dat niemand ooit terugzoekt. En de leesroute van het spoor zelf
   staat erbij zodat het spoor niet vol komt met "iemand keek in het spoor" --
   die vraag hoort in het inzagejournaal, niet hier. */
const OVERSLAAN = [/^\/api\/cluster\//, /^\/api\/health$/, /^\/api\/ready$/, /^\/api\/command\/apispoor$/];

function maakAuditspoor(deps) {
  const { db, save, sessionFor } = deps || {};
  const eigen = require('../kern/eigencollectie')({ db, domein: 'opzet/auditspoor', bezit: { apiSpoor: 'kaart' } });

  /* Het eigen vak. Dezelfde sleutels als het command-journaal, maar in een
     eigen doos, zodat de twee ketens elkaar niet in de weg zitten. */
  const vak = () => eigen.bak('apiSpoor');
  const journaal = maakJournaal({ db, save, crypto, vak });

  /* De actor, in volgorde van zekerheid. req.session en req.supplier zijn door
     de auth van de route zelf gezet -- dat is het hardste wat er is. Pas als
     die er geen van beide is, kijken we zelf naar de sessie achter het token;
     dat gebeurt NA het antwoord, dus het kost de bezoeker geen tijd. */
  function wie(req) {
    const s = req.session;
    if (s && s.key) return String(s.key);
    if (req.supplier && req.supplier.code) {
      const staf = req.actor && req.actor.staffId;
      return 'zaak-' + req.supplier.code + (staf ? '/' + staf : '');
    }
    if (req.eigenaar) return 'eigenaar';
    const kop = req.get('authorization') || '';
    const token = kop.startsWith('Bearer ') ? kop.slice(7) : null;
    const sess = token && sessionFor ? sessionFor(token) : null;
    if (sess && sess.role === 'office') return sess.lidKey ? String(sess.lidKey) : 'kantoor-gedeelde-code';
    if (sess && sess.role === 'supplier') return 'zaak-' + String(sess.code || '?');
    return 'anoniem';
  }

  function middleware() {
    return function auditspoor(req, res, next) {
      if (!SCHRIJFT.has(req.method)) return next();
      const pad = String(req.path || '').slice(0, 200);
      for (const p of OVERSLAAN) if (p.test(pad)) return next();
      /* NA het antwoord noteren, om twee redenen: de route heeft dan zijn
         sessie gezet (dus we weten wie), en de bezoeker wacht niet op onze
         schrijfactie. Alleen een geslaagde handeling; een geweigerde poging
         hoort in het verzoeklog en niet in een handelingenspoor -- anders staat
         een gescande deurklink straks tussen de echte besluiten. */
      res.on('finish', () => {
        try {
          if (res.statusCode < 200 || res.statusCode >= 300) return;
          journaal.noteer({
            actor: wie(req),
            actie: req.method + ' ' + pad,
            niveau: 'api',
            uitslag: String(res.statusCode),
            reden: 'schrijfhandeling via de API'
          });
        } catch (e) { /* een spoor mag nooit een verzoek meenemen dat al geslaagd is */ }
      });
      next();
    };
  }

  return { middleware, journaal, stand: () => ({ aantal: journaal.aantal(), keten: journaal.controleer() }) };
}

module.exports = { maakAuditspoor, SCHRIJFT, OVERSLAAN };
