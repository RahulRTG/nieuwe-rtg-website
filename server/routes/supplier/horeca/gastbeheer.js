/* Horeca OS (deellaag): DE ZAAKKANT VAN DE GASTENDEUR.

   Alles wat de gast op zijn telefoon kan, moet de zaak kunnen INSTELLEN en
   TERUGDRAAIEN. Zonder deze drie knoppen is de gastkant iets wat over een zaak
   heen wordt gelegd in plaats van iets wat zij aanzet:

   1. DE QR PER TAFEL. Een token dat bij de tafel hoort en niet bij de rekening,
      zodat een gedrukte sticker jaren meegaat. Opnieuw uitgeven is een aparte
      handeling met een waarschuwing, want het maakt elke bestaande sticker van
      die tafel dood.
   2. UITVERKOCHT. De keuken zet een gerecht uit en het verdwijnt onmiddellijk
      van elke gastkaart, met de reden erbij ("door de keuken op uitverkocht
      gezet"). Dit stond nergens: de kaart kende wel prijzen maar geen
      beschikbaarheid, dus een gast kon iets bestellen wat er niet was.
   3. BEVESTIGEN. Een bestelling die volgens het beleid langs een mens moet,
      blijft staan tot een mens hem vrijgeeft -- of hem afwijst met een reden.
      Zolang dat niet gebeurd is, mag de keuken er niet aan beginnen. */
'use strict';

module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, logActivity, sseToSupplier, horeca } = kern;
  const { H, nu } = horeca;
  const sessie = require('../../../kern/gast/sessie')({ db: kern.db, save, crypto: kern.crypto, schoon, horeca });
  const beleid = require('../../../kern/gast/beleid')({ horeca });

  /* ---------- de QR van een tafel ---------- */
  app.post('/api/supplier/horeca/gast/qr', supplierAuth, (req, res) => {
    const b = req.body || {};
    /* Een QR hoort bij een TAFEL of bij een KAMER. Het verschil zit niet in de
       sticker maar in wat er daarna geldt: op een tafel mag altijd een rekening
       open, op een kamer alleen zolang daar een gastrekening staat. */
    const soort = b.kamer ? 'kamer' : 'tafel';
    const naam = soort === 'kamer' ? b.kamer : b.tafel;
    const uit = sessie.plekToken(req.supplier.code, naam, { soort, vernieuw: !!b.vernieuw });
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    if (uit.vernieuwd) logActivity(req.supplier.code, req.actor, 'gaf een nieuwe QR uit voor ' + uit.plek);
    res.json({ ok: true, soort, plek: uit.plek, tafel: soort === 'tafel' ? uit.plek : null,
      kamer: soort === 'kamer' ? uit.plek : null, token: uit.token,
      pad: '/apps/gast.html?t=' + uit.token,
      let: uit.vernieuwd
        ? 'Alle eerder gedrukte QR-codes van deze plek werken nu niet meer.'
        : (soort === 'kamer'
          ? 'Leg deze code op de kamer; hij werkt alleen zolang daar een gastrekening open staat.'
          : 'Druk deze code af voor op tafel; hij blijft geldig als de rekening sluit.') });
  });

  /* ---------- uitverkocht ---------- */
  app.post('/api/supplier/horeca/gast/uitverkocht', supplierAuth, (req, res) => {
    const h = H(req.supplier.code);
    if (!h.instel.uitverkocht) h.instel.uitverkocht = {};
    const itemId = schoon((req.body || {}).itemId, 40);
    if (!itemId) return res.status(400).json({ error: 'Welk gerecht?' });
    const uit = (req.body || {}).uit !== false;
    if (uit) h.instel.uitverkocht[itemId] = { at: nu(), door: req.actor.name };
    else delete h.instel.uitverkocht[itemId];
    save();
    sseToSupplier(req.supplier.code, 'sync', { scope: 'horeca' });
    res.json({ ok: true, itemId, uitverkocht: uit, lijst: Object.keys(h.instel.uitverkocht) });
  });

  /* ---------- het beleid ---------- */
  app.post('/api/supplier/horeca/gast/beleid', supplierAuth, (req, res) => {
    const b = (req.body || {}).zet ? beleid.zet(req.supplier.code, (req.body || {}).zet) : beleid.beleidVan(req.supplier.code);
    if ((req.body || {}).zet) { save(); logActivity(req.supplier.code, req.actor, 'wijzigde het gastbeleid'); }
    res.json({ ok: true, beleid: b, standaard: beleid.STANDAARD });
  });

  /* ---------- wachtende bestellingen ---------- */
  app.post('/api/supplier/horeca/gast/wachtrij', supplierAuth, (req, res) => {
    const h = H(req.supplier.code);
    const rijen = [];
    for (const r of Object.values(h.rekeningen)) {
      if (r.status !== 'open') continue;
      for (const regel of (r.regels || [])) {
        if (regel.bevestiging !== 'wacht') continue;
        rijen.push({ rekeningId: r.id, tafel: r.tafel, regelId: regel.id, naam: regel.naam,
          aantal: regel.aantal, allergie: regel.allergie || null, reden: regel.bevestigingCode,
          uitleg: regel.bevestigingUitleg, besteldAt: regel.at, door: regel.door });
      }
    }
    res.json({ ok: true, aantal: rijen.length, wachtrij: rijen });
  });

  app.post('/api/supplier/horeca/gast/bevestig', supplierAuth, (req, res) => {
    const h = H(req.supplier.code);
    const b = req.body || {};
    const r = h.rekeningen[String(b.rekeningId || '')];
    const regel = r && (r.regels || []).find(x => x.id === String(b.regelId || ''));
    if (!regel) return res.status(404).json({ error: 'Die regel staat niet op een open rekening.' });
    if (regel.bevestiging !== 'wacht') return res.status(409).json({ error: 'Deze regel wacht niet op bevestiging.' });
    const akkoord = b.akkoord !== false;
    if (!akkoord) {
      const reden = schoon(b.reden, 120);
      /* Afwijzen zonder reden bestaat niet: de gast krijgt te horen WAAROM zijn
         gerecht van de rekening ging, anders is het gewoon verdwenen. */
      if (!reden) return res.status(400).json({ error: 'Waarom wordt deze bestelling afgewezen? Dat leest de gast.' });
      regel.bevestiging = 'afgewezen'; regel.bevestigingUitleg = reden;
      r.regels = r.regels.filter(x => x.id !== regel.id);
      r.afgewezen = (r.afgewezen || []).concat([{ naam: regel.naam, aantal: regel.aantal, reden, at: nu(), door: req.actor.name }]).slice(-20);
    } else {
      regel.bevestiging = 'akkoord';
      regel.bevestigdDoor = req.actor.name;
      regel.bevestigdAt = nu();
    }
    save();
    logActivity(req.supplier.code, req.actor, (akkoord ? 'bevestigde' : 'wees af') + ': ' + regel.naam + ' op ' + (r.tafel || r.id));
    sseToSupplier(req.supplier.code, 'sync', { scope: 'horeca' });
    res.json({ ok: true, regelId: regel.id, bevestiging: regel.bevestiging });
  });
};
