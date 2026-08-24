/* RTG Eten aan de partnerkant. Een operationeel werkblad boven dezelfde
   horecarekeningen die de gast, kassa en keuken al gebruiken. */
'use strict';

module.exports = (kern) => {
  const { app, supplierAuth, managerOnly, save, schoon, sseToSupplier, logActivity } = kern;
  const horeca = require('../../kern/horeca')(kern);
  const beeld = require('../../kern/eten/orderbeeld');
  const partnerwerk = require('../../kern/eten/partnerwerk')(kern, horeca);

  const doos = code => horeca.H(code);

  app.post('/api/supplier/eten/werkblad', supplierAuth, (req, res) => {
    res.json(partnerwerk.werkbladVan(req.supplier, req.body || {}, req.actor));
  });

  app.post('/api/supplier/eten/capaciteit', supplierAuth, (req, res) => {
    const h = doos(req.supplier.code), b = req.body || {};
    h.etenCapaciteit = h.etenCapaciteit || {};
    const c = h.etenCapaciteit;
    if (b.wijzig === true) {
      if (!managerOnly(req, res)) return;
      if (b.open != null) c.open = !!b.open;
      if (b.auto != null) c.auto = !!b.auto;
      if (b.extraMinuten != null) c.extraMinuten = Math.max(0, Math.min(120, parseInt(b.extraMinuten, 10) || 0));
      if (b.limietMinuten != null) c.limietMinuten = Math.max(10, Math.min(180, parseInt(b.limietMinuten, 10) || 35));
      if (b.kokken != null) h.instel.kokken = Math.max(1, Math.min(60, parseInt(b.kokken, 10) || 1));
      if (b.afhalenPromoten != null) c.afhalenPromoten = !!b.afhalenPromoten;
      if (Array.isArray(b.gepauzeerdeItems)) c.gepauzeerdeItems = b.gepauzeerdeItems.slice(0, 100)
        .map(String).filter(id => (req.supplier.menu || []).some(m => String(m.id) === id));
      save(); logActivity(req.supplier.code, req.actor, 'werkte de capaciteit van RTG Eten bij');
      if (sseToSupplier) sseToSupplier(req.supplier.code, 'sync', { scope:'eten' });
    }
    res.json({ ok:true, capaciteit:partnerwerk.capaciteitVan(req.supplier) });
  });

  app.post('/api/supplier/eten/instellingen', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const s = req.supplier, b = req.body || {};
    s.kortingscodes = Array.isArray(s.kortingscodes) ? s.kortingscodes : [];
    const code = String(schoon(b.code, 30) || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (b.actie === 'bewaar-korting') {
      if (code.length < 3) return res.status(400).json({ error:'Een kortingscode heeft minimaal drie letters of cijfers.' });
      const procent = Math.max(0, Math.min(100, Number(b.procent) || 0));
      const centen = Math.max(0, Math.min(100000, parseInt(b.centen, 10) || 0));
      if (!procent && !centen) return res.status(400).json({ error:'Geef een percentage of vast kortingsbedrag.' });
      const regel = { code, procent:procent || 0, centen:procent ? 0 : centen, actief:b.actief !== false };
      const i = s.kortingscodes.findIndex(k => String(k.code).toUpperCase() === code);
      if (i >= 0) s.kortingscodes[i] = regel; else s.kortingscodes.push(regel);
      s.kortingscodes = s.kortingscodes.slice(-30);
    } else if (b.actie === 'verwijder-korting') {
      s.kortingscodes = s.kortingscodes.filter(k => String(k.code).toUpperCase() !== code);
    } else return res.status(400).json({ error:'Onbekende instelling.' });
    save(); logActivity(s.code, req.actor, 'werkte een kortingscode van RTG Eten bij');
    res.json({ ok:true, kortingscodes:s.kortingscodes });
  });

  function rekeningVan(req, res) {
    const r = doos(req.supplier.code).rekeningen[String((req.body || {}).rekeningId || '')];
    if (!r || !beeld.OPEN_KANALEN.includes(r.kanaal)) { res.status(404).json({ error:'Deze RTG Eten-order is niet gevonden.' }); return null; }
    return r;
  }
  function audit(rek, req, wat, van, naar) {
    rek.audit = Array.isArray(rek.audit) ? rek.audit : [];
    rek.audit.push({ at:horeca.nu(), actor:req.actor.name, bron:'partner-eten', apparaat:null, wat, van, naar, reden:null });
    rek.audit = rek.audit.slice(-400);
  }

  app.post('/api/supplier/eten/status', supplierAuth, (req, res) => {
    const rek = rekeningVan(req, res); if (!rek) return;
    const naar = String((req.body || {}).status || '');
    const toegestaan = ['geaccepteerd','in-bereiding','klaar','overgedragen','onderweg','geleverd'];
    if (!toegestaan.includes(naar)) return res.status(400).json({ error:'Onbekende RTG Eten-status.' });
    const regels = (rek.regels || []).filter(r => !r.bezorgkosten);
    const voor = beeld.projecteerRekening({ zaakcode:req.supplier.code, zaak:req.supplier,
      rekening:rek, horecaDoos:doos(req.supplier.code) });
    if (naar === 'geaccepteerd') {
      if (regels.some(r => r.bevestiging === 'wacht')) return res.status(409).json({ error:'Deze bestelling vraagt eerst de persoonlijke allergie- of beleidscontrole.' });
      if (rek.betaalVoorkeur === 'online' && voor.statussen.betaling !== 'betaald')
        return res.status(409).json({ error:'Wacht op de definitieve betaalbevestiging voordat de keuken start.' });
      rek.geaccepteerdAt = rek.geaccepteerdAt || horeca.nu();
    }
    if (naar === 'in-bereiding') {
      if (voor.statussen.acceptatie !== 'geaccepteerd') return res.status(409).json({ error:'Accepteer de bestelling eerst.' });
      for (const r of regels) {
      if (!r.vrijAt) r.vrijAt = horeca.nu();
      if (r.stand === 'besteld') { r.stand = 'gestart'; r.startAt = r.startAt || horeca.nu(); }
      }
    }
    if (naar === 'klaar') {
      if (voor.statussen.productie !== 'in-bereiding' && voor.statussen.productie !== 'bijna-klaar')
        return res.status(409).json({ error:'Start de bereiding eerst.' });
      for (const r of regels) if (r.stand !== 'uitgegeven') { r.stand = 'klaar'; r.klaarAt = r.klaarAt || horeca.nu(); }
    }
    rek.fulfillment = rek.fulfillment || {};
    if (naar === 'overgedragen') {
      if (!regels.length || !regels.every(r => ['klaar','uitgegeven'].includes(r.stand))) return res.status(409).json({ error:'Markeer eerst alle gerechten als klaar.' });
      for (const r of regels) { r.stand = 'uitgegeven'; r.uitAt = r.uitAt || horeca.nu(); }
      rek.fulfillment.status = rek.kanaal === 'afhaal' ? 'opgehaald' : 'overgedragen';
      rek.fulfillment.overgedragenAt = horeca.nu();
      if (rek.afhaal) rek.afhaal.stand = 'opgehaald';
      if (rek.bezorg) rek.bezorg.stand = 'overgedragen';
    }
    if (naar === 'onderweg') {
      if (rek.kanaal !== 'bezorging') return res.status(409).json({ error:'Een afhaalbestelling gaat niet onderweg.' });
      if (rek.fulfillment.status !== 'overgedragen') return res.status(409).json({ error:'Controleer eerst verpakking en overdracht.' });
      rek.fulfillment.status = 'onderweg'; rek.fulfillment.onderwegAt = horeca.nu(); rek.bezorg.stand = 'onderweg';
    }
    if (naar === 'geleverd') {
      if (rek.kanaal === 'afhaal') return res.status(409).json({ error:'Een afhaalbestelling rond je af met overdragen.' });
      if (rek.kanaal === 'bezorging' && rek.fulfillment.status !== 'onderweg') return res.status(409).json({ error:'De bestelling moet eerst onderweg zijn.' });
      rek.fulfillment.status = rek.kanaal === 'afhaal' ? 'opgehaald' : 'geleverd';
      rek.fulfillment.geleverdAt = horeca.nu();
      if (rek.bezorg) rek.bezorg.stand = 'geleverd';
    }
    audit(rek, req, 'status', null, naar); save();
    logActivity(req.supplier.code, req.actor, 'zette RTG Eten-order ' + rek.id + ' op ' + naar);
    if (sseToSupplier) sseToSupplier(req.supplier.code, 'sync', { scope:'eten' });
    const o = beeld.projecteerRekening({ zaakcode:req.supplier.code, zaak:req.supplier,
      rekening:rek, horecaDoos:doos(req.supplier.code) });
    res.json({ ok:true, order:beeld.zonderIntern(o) });
  });
};
