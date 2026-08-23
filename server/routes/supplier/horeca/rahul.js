/* Horeca OS (deellaag): DE RECHTENLAAG VAN RAHUL en de actiebonnen.

   De regels staan in kern/horeca/rahul-register.js (wat mag) en
   kern/horeca/rahul-recht.js (de weg erlangs, plus de bon). Hier staat de deur
   en de uitvoerder per handeling.

   HET REGISTER IS OPENBAAR VOOR DE ZAAK. Een rechtenmodel dat je niet kunt
   lezen, is geen model maar een verrassing -- en dan gaat een manager gokken
   waarom iets niet gebeurt.

   DE UITVOERDERS STAAN HIER EN NIET IN DE KERN, en dat is opzet: de kern
   beslist WAT er mag, deze laag weet HOE het gebeurt. Een handeling zonder
   uitvoerder is geen fout; de bon is dan het besluit en niets meer -- en dat is
   precies wat een voorstel hoort te zijn zolang er geen deur voor is. */
'use strict';

module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, managerOnly, logActivity, sseToSupplier, horeca } = kern;
  const { H, nu, id, centen, totaal, openstaand } = horeca;
  const registerlaag = require('../../../kern/horeca/rahul-register');
  const recht = require('../../../kern/horeca/rahul-recht')({ horeca, save });

  /* De uitvoerders. Alleen handelingen die HIER staan, veranderen echt iets;
     de rest levert een bon en verder niets. */
  const UITVOERDERS = {
    /* Korting: dezelfde vorm als /korting hiernaast -- reden verplicht, en het
       bedrag komt in centen zodat de grens uit de zaakinstelling erop past. */
    'korting.toekennen': (h, g, wie) => {
      const rek = h.rekeningen[String((g || {}).rekeningId || '')];
      if (!rek) return { error: 'Deze rekening kennen we niet.' };
      if (rek.status !== 'open') return { error: 'Deze rekening is al ' + rek.status + '.' };
      const reden = schoon((g || {}).reden, 80);
      if (!reden) return { error: 'Een korting draagt altijd een reden.' };
      const bedrag = centen((g || {}).centen);
      if (!bedrag) return { error: 'Geef een bedrag in centen.' };
      rek.kortingen.push({ id: id(3), reden: reden + ' (via Rahul, bevestigd door ' + wie + ')',
        procent: null, centen: bedrag, at: nu(), door: wie });
      return { let: 'Korting van ' + (bedrag / 100).toFixed(2) + ' geboekt op ' + (rek.tafel || rek.id) + '.' };
    }
  };

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
    const h = H(req.supplier.code);
    if (req.body.centen === null || req.body.centen === '') {
      delete h.instel.rahulKortingGrensCenten;
      save();
      return res.json({ ok: true, kortingGrensCenten: null,
        let: 'Geen grens: vanaf nu vraagt elke korting van Rahul een mens.' });
    }
    const c = Math.round(Number(req.body.centen));
    if (!Number.isFinite(c) || c < 0 || c > 100000)
      return res.status(400).json({ error: 'Kies een bedrag in centen tussen 0 en 100.000.' });
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
        return f ? f(h, b.gegevens, wieVan(req)) : { let: 'Geen uitvoerder voor deze handeling; alleen vastgelegd.' };
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
    const h = H(req.supplier.code);
    const uit = recht.bevestig(h, (req.body || {}).bonId, wieVan(req), (bon) => {
      const f = UITVOERDERS[bon.handeling];
      return f ? f(h, bon.gegevens, wieVan(req)) : { let: 'Geen uitvoerder voor deze handeling; alleen vastgelegd.' };
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
