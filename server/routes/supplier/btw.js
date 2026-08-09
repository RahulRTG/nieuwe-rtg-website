/* Domein "supplier" (deelmodule): DE BTW-AANGIFTE van de zaak.

   Vier handelingen op de motor in kern/fiscaal/btwaangifte.js: opmaken uit het
   factuurregister, teruglezen, indienen vastleggen en corrigeren.

   TWEE GRENZEN DIE HIER NIET MOGEN VERVAGEN -- dezelfde twee als bij de
   loonaangifte van de werkgever (routes/payroll-os-zaak.js):

   1. DE ZAAK KOMT UIT HET TOKEN, niet uit het verzoek. Een zaakcode in het lijf
      zou betekenen dat elke manager de btw-aangifte van de buurman opvraagt --
      en die bevat zijn complete omzet per tarief.
   2. ALLEEN EEN MANAGER. Dit is de aangifte waar de zaak op wordt afgerekend;
      dat is dezelfde lat als de rest van het financiele bord (./financien.js).

   EN EEN VERSCHIL MET DE LOONAANGIFTE, met opzet. Daar dient het RTG-kantoor in
   en leest de werkgever alleen mee, want RTG voert die administratie. Hier is de
   ondernemer zelf de belastingplichtige: hij maakt op, hij controleert, hij
   dient in. Dat is ook wat het btw-draaiboek hem belooft
   (kern/automatisering.js): Rahul zet klaar en herinnert, en dient nooit voor
   iemand in. Er is hier dus bewust GEEN kantoorroute die dat overneemt. */
module.exports = (kern) => {
  const { app, btwAangifte, supplierAuth, schoon } = kern;
  if (!btwAangifte) return;

  const antwoord = (res, r) => (r && r.error) ? res.status(r.status || 400).json(r) : res.json(r);
  const managerOf = (req, res) => {
    if (!req.actor || !req.actor.manager) { res.status(403).json({ error: 'Alleen voor management.' }); return null; }
    return req.actor.name || 'manager';
  };

  /* Opmaken (of, zolang de periode loopt, bijwerken). `correctie: true` maakt de
     correctie op een al ingediende aangifte; de motor weigert allebei de
     verkeerde volgordes. */
  app.post('/api/supplier/btw/opmaken', supplierAuth, (req, res) => {
    const door = managerOf(req, res); if (!door) return;
    const b = req.body || {};
    antwoord(res, btwAangifte.maak(req.supplier, schoon(b.periode, 10), door, { correctie: b.correctie === true }));
  });

  /* Teruglezen: alleen de eigen zaak, uit het token. */
  app.post('/api/supplier/btw/aangiftes', supplierAuth, (req, res) => {
    const door = managerOf(req, res); if (!door) return;
    const b = req.body || {};
    res.json({ ok: true, aangiftes: btwAangifte.vanZaak(req.supplier.code, schoon(b.jaar, 4) || null) });
  });

  /* Een aangifte in detail. De eigendomscontrole staat hier en niet in de motor:
     die kent geen sessies. Een aangifte van een andere zaak bestaat voor deze
     zaak niet -- vandaar 404 en niet 403, want ook het BESTAAN ervan is
     omzetinformatie van een ander. */
  app.post('/api/supplier/btw/aangifte', supplierAuth, (req, res) => {
    const door = managerOf(req, res); if (!door) return;
    const a = btwAangifte.haal(String((req.body || {}).id || ''));
    if (!a || a.code !== String(req.supplier.code).toUpperCase())
      return res.status(404).json({ error: 'Deze aangifte kennen we niet.' });
    res.json({ ok: true, aangifte: a });
  });

  /* Indienen vastleggen. Het kenmerk is wat de Belastingdienst teruggaf; RTG
     verzendt niets. De motor weigert een periode die nog loopt, een aangifte die
     al is ingediend, en cijfers die sinds het opmaken zijn veranderd. */
  app.post('/api/supplier/btw/indienen', supplierAuth, (req, res) => {
    const door = managerOf(req, res); if (!door) return;
    const b = req.body || {};
    const a = btwAangifte.haal(String(b.id || ''));
    if (!a || a.code !== String(req.supplier.code).toUpperCase())
      return res.status(404).json({ error: 'Deze aangifte kennen we niet.' });
    antwoord(res, btwAangifte.dienIn(a.id, door, schoon(b.kenmerk, 40)));
  });
};
