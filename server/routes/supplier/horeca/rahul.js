/* Horeca OS (deellaag): DE RECHTENLAAG VAN RAHUL en de actiebonnen.

   De regels staan in kern/horeca/rahul-register.js (wat mag) en
   kern/horeca/rahul-recht.js (de weg erlangs, plus de bon). Hier staat de deur
   en de uitvoerder per handeling.

   HET REGISTER IS OPENBAAR VOOR DE ZAAK. Een rechtenmodel dat je niet kunt
   lezen, is geen model maar een verrassing -- en dan gaat een manager gokken
   waarom iets niet gebeurt.

   DE UITVOERDERS STAAN IN ./rahul-doen.js en niet in de kern, en dat is opzet:
   de kern beslist WAT er mag, die laag weet HOE het gebeurt. Een handeling
   zonder uitvoerder is geen fout; de bon is dan het besluit en niets meer -- en
   dat is precies wat een voorstel hoort te zijn zolang er geen deur voor is.
   Zie de kop daar voor de twee die er met opzet géén krijgen. */
'use strict';

module.exports = (kern) => {
  const { app, save, supplierAuth, managerOnly, logActivity, sseToSupplier, horeca } = kern;
  const { H, Hlees } = horeca;
  const registerlaag = require('../../../kern/horeca/rahul-register');
  const recht = require('../../../kern/horeca/rahul-recht')({ horeca, save });
  const UITVOERDERS = require('./rahul-doen')(kern);

  const wieVan = (req) => req.actor.name;

  /* ---------- het register lezen ---------- */
  app.post('/api/supplier/horeca/rahul/register', supplierAuth, (req, res) => {
    const h = H(req.supplier.code);
    res.json({ ok: true, handelingen: registerlaag.register(), lagen: registerlaag.LAGEN,
      kortingGrensCenten: recht.kortingGrensCenten(h),
      uitvoerbaar: Object.keys(UITVOERDERS),
      let: 'Wat hier niet staat, valt automatisch onder "mensbevestigt". Een handeling ' +
        'die niemand heeft beoordeeld, hoort niet zelfstandig te gebeuren.' });
  });

  /* ---------- de kortingsgrens zetten (manager) ---------- */
  app.post('/api/supplier/horeca/rahul/grens', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    /* EERST KEUREN, DAN PAS DE DOOS OPHALEN. De getter H zet de horecadoos van
       een zaak neer zodra iemand ernaar vraagt, en hij stond hier boven de
       bedragcontrole: een zaak die nog nooit iets met horeca deed hield aan een
       afgekeurd bedrag (400) een verse lege doos over. Zie kern/horeca.js bij
       Hlees voor waarom dat onderscheid bestaat. Wissen keurt niets aan de
       invoer, dus daar is de vraag zelf de keuring. */
    const wissen = req.body.centen === null || req.body.centen === '';
    let c = 0;
    if (!wissen) {
      c = Math.round(Number(req.body.centen));
      if (!Number.isFinite(c) || c < 0 || c > 100000)
        return res.status(400).json({ error: 'Kies een bedrag in centen tussen 0 en 100.000.' });
    }
    const h = H(req.supplier.code);
    if (wissen) {
      delete h.instel.rahulKortingGrensCenten;
      save();
      return res.json({ ok: true, kortingGrensCenten: null,
        let: 'Geen grens: vanaf nu vraagt elke korting van Rahul een mens.' });
    }
    h.instel.rahulKortingGrensCenten = c;
    save();
    logActivity(req.supplier.code, req.actor, 'zette de kortingsgrens van Rahul op € ' + (c / 100).toFixed(2));
    res.json({ ok: true, kortingGrensCenten: c });
  });

  /* ---------- Rahul stelt iets voor of voert iets uit ---------- */
  app.post('/api/supplier/horeca/rahul/doe', supplierAuth, (req, res) => {
    const h = H(req.supplier.code);
    const b = req.body || {};
    const uit = recht.doe(h, {
      handeling: b.handeling, door: wieVan(req), gegevens: b.gegevens, waarom: b.waarom,
      doen: () => {
        const f = UITVOERDERS[String(b.handeling || '').toLowerCase()];
        return f ? f(h, b.gegevens, wieVan(req), req.supplier)
          : { let: 'Geen uitvoerder voor deze handeling; alleen vastgelegd.' };
      }
    });
    sseToSupplier(req.supplier.code, 'sync', { scope: 'horeca' });
    res.json(uit);
  });

  /* ---------- een mens bevestigt ----------
     Bevestigen is manager-werk. Niet omdat een bediening het niet zou snappen,
     maar omdat de vier handelingen die hier wachten (allergie, betaling,
     voorraadverschil, korting) allemaal geld of veiligheid raken. */
  app.post('/api/supplier/horeca/rahul/bevestig', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    /* De getter H maakt de doos van een zaak aan zodra iemand ernaar vraagt, ook
       als er daarna een 404 volgt omdat de bon niet bestaat. Eerst kijken met
       Hlees dus -- is er niets, dan is er ook geen bon en gaat het verzoek terug
       zonder spoor. Zie kern/horeca.js bij Hlees; daar staat waarom dat
       onderscheid bestaat.

       En rechtstreeks lezen, want ook de bonnenlezer van de rechtenlaag
       schrijft: die zet de bonnenlijst neer als het veld er nog niet is. Op een
       BESTAANDE zaak geeft Hlees de echte doos terug, dus dan landt die lege
       lijst er alsnog in -- en dan blijft een 404 alsnog een spoor nalaten.
       Kijken doet hier dus niets meer dan kijken. */
    const bonId = String((req.body || {}).bonId || '');
    const h = Hlees(req.supplier.code);
    const bonnen = Array.isArray(h && h.rahulBonnen) ? h.rahulBonnen : [];
    if (!bonnen.some((b) => String(b.id) === bonId)) {
      return res.status(404).json({ error: 'Deze actiebon kennen we niet.' });
    }
    /* Vanaf hier is `h` aantoonbaar de ECHTE doos van deze zaak -- er zit immers
       een bon in, en Hlees geeft de doos van H terug zodra die bestaat. Hier
       stond daarom een tweede aanroep van H; die maakte niets meer aan, maar hij
       LAS als "maak zo nodig aan" vlak boven een uitgang die alsnog 4xx kan
       geven, en zo raakt de volgende lezer het onderscheid weer kwijt. */
    const uit = recht.bevestig(h, (req.body || {}).bonId, wieVan(req), (bon) => {
      const f = UITVOERDERS[bon.handeling];
      return f ? f(h, bon.gegevens, wieVan(req), req.supplier)
        : { let: 'Geen uitvoerder voor deze handeling; alleen vastgelegd.' };
    });
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    logActivity(req.supplier.code, req.actor, 'bevestigde een voorstel van Rahul: ' + uit.bon.wat);
    sseToSupplier(req.supplier.code, 'sync', { scope: 'horeca' });
    res.json(uit);
  });

  /* ---------- de bonnen lezen ---------- */
  app.post('/api/supplier/horeca/rahul/bonnen', supplierAuth, (req, res) => {
    const h = H(req.supplier.code);
    const bonnen = recht.bonnen(h, (req.body || {}).hoeveel);
    res.json({ ok: true, aantal: bonnen.length, bonnen,
      wacht: bonnen.filter(b => b.stand === 'wacht').length,
      geweigerd: bonnen.filter(b => b.stand === 'geweigerd').length,
      let: 'Elke handeling van Rahul staat hier, ook een geweigerde. Bonnen worden ' +
        'niet gewist: alleen de oudste wijkt als het er te veel worden.' });
  });
};
