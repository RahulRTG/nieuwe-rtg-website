/* RTG VRIJHEID -- de deuren naar Mijn tijd (VRIJHEID.md).

   Twee kanten, en de persoon komt ALTIJD uit de sessie en nooit uit het
   lichaam: wie vraagt, vraagt voor zichzelf, en wie beoordeelt, tekent op
   eigen naam (een persoonlijke login, geen bedrijfsaccount).

     /api/staff/tijd*      de medewerker: zijn tijd, zijn verjaardag, zijn
                           verzoeken
     /api/supplier/tijd*   de leidinggevende: wat op een mens wacht, de
                           bezetting en de feestdagen

   Elke mutatie gaat door `vastleggen` (lib/duurzaam.js): pas als de opslag hem
   bevestigt, heet hij gelukt. Lezen gaat er niet doorheen en schept niets.

   Wat hier met opzet NIET staat: routes om een aanbod "eerder naar huis" te
   aanvaarden. Zonder verantwoordelijkheden per dienst (geen domein legt ze
   vast) is de werkstand altijd UNKNOWN en komt er nooit een aanbod -- een deur
   naar iets dat niet kan bestaan, is een doodlopend spoor. */
'use strict';

const SOORTEN = ['VRIJE_DAG', 'EERDER_WEG', 'LATER_BEGINNEN'];
const vandaag = () => new Date().toISOString().slice(0, 10);

module.exports = (kern) => {
  const { app, supplierAuth, managerOnly, vrijheid, rtghuis } = kern;
  const V = () => vrijheid;
  const zelf = (req) => (req.actor && req.actor.staffId != null) ? String(req.actor.staffId) : null;
  const antwoord = (res, r) => r && r.error ? res.status(r.status || 400).json(r) : res.json(r);

  /* Een mutatie, duurzaam: het werk draait binnen vastleggen, en een
     opslagfout wordt een 503 in plaats van een stille "gelukt". */
  async function duurzaam(res, werk) {
    let r;
    const mis = await V().vastleggen(() => { r = werk(); });
    if (mis) return res.status(mis.status || 503).json(mis);
    return antwoord(res, r);
  }

  /* ---- de medewerker ---- */
  app.post('/api/staff/tijd', supplierAuth, (req, res) => {
    const p = zelf(req);
    if (!p) return res.status(403).json({ error: 'Mijn tijd opent met een persoonlijke login.' });
    const code = req.supplier.code;
    const beleid = V().beleidVoor(code);
    const jaar = Number(vandaag().slice(0, 4));
    const inst = V().instellingen.lees(code);
    const t = V().teambeeld(code);
    res.json({
      ok: true,
      tijd: V().motor.mijnTijd(code, p, { beleid, rechten: null, jaar }),
      verjaardag: (inst.verjaardagen[p] || {}).mmdd || null,
      ikInDienst: !!(t.mensen.find(m => m.id === p) || {}).inDienst,
      /* Wat het systeem niet weet, staat erbij -- ook voor de medewerker. */
      ontbreekt: t.ontbreekt.map(o => o.reden),
      beleidOpen: beleid.open()
    });
  });

  app.post('/api/staff/tijd/verjaardag', supplierAuth, (req, res) => {
    const p = zelf(req);
    if (!p) return res.status(403).json({ error: 'Uw verjaardag geeft u op met uw eigen login.' });
    const mmdd = req.body && req.body.mmdd ? String(req.body.mmdd) : null;
    return duurzaam(res, () => V().instellingen.zetVerjaardag(req.supplier.code, p, mmdd, p));
  });

  app.post('/api/staff/tijd/verzoek', supplierAuth, (req, res) => {
    const p = zelf(req);
    if (!p) return res.status(403).json({ error: 'Een verzoek doet u met uw eigen login.' });
    const b = req.body || {};
    if (!SOORTEN.includes(b.soort)) return res.status(400).json({ error: 'soort is een van ' + SOORTEN.join(', ') + '.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.datum || ''))) return res.status(400).json({ error: 'datum als JJJJ-MM-DD.' });
    const klok = (x) => x == null || /^([01]\d|2[0-3]):[0-5]\d$/.test(String(x));
    if (!klok(b.vanaf) || !klok(b.tot)) return res.status(400).json({ error: 'vanaf en tot als UU:MM.' });
    const code = req.supplier.code;
    const verzoek = { soort: b.soort, categorie: String(b.categorie || ''), persoon: p, datum: b.datum,
      ...(b.vanaf ? { vanaf: b.vanaf } : {}), ...(b.tot ? { tot: b.tot } : {}),
      ...(b.categorie === 'SPECIAL_LEAVE' && b.reden ? { reden: String(b.reden).slice(0, 500) } : {}) };
    const t = V().teambeeld(code);
    return duurzaam(res, () => V().motor.vraag(code, t, verzoek,
      { door: p, beleid: V().beleidVoor(code), rechten: null, vandaag: vandaag(), sleutel: b.sleutel ? String(b.sleutel).slice(0, 80) : undefined }));
  });

  app.post('/api/staff/tijd/intrekken', supplierAuth, (req, res) => {
    const p = zelf(req);
    if (!p) return res.status(403).json({ error: 'Intrekken doet u met uw eigen login.' });
    return duurzaam(res, () => V().motor.trekIn(req.supplier.code, String((req.body || {}).id || ''), p));
  });

  app.post('/api/staff/tijd/uitleg', supplierAuth, (req, res) => {
    const p = zelf(req);
    if (!p) return res.status(403).json({ error: 'Met uw eigen login.' });
    antwoord(res, V().motor.verzoekUitleg(req.supplier.code, String((req.body || {}).id || ''), p));
  });

  /* ---- de leidinggevende ---- */
  /* Het overzicht vraagt een PERSOONLIJKE login, net als het besluit: bij
     bijzonder verlof kan de reden erin staan, en die leest alleen wie
     beoordeelt -- niet een gedeeld bedrijfsaccount. */
  app.post('/api/supplier/tijd/overzicht', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const door = zelf(req);
    if (!door) return res.status(403).json({ error: 'Het overzicht opent met uw persoonlijke login.' });
    const code = req.supplier.code;
    const t = V().teambeeld(code);
    const inst = V().instellingen.lees(code);
    const m = V().motor;
    res.json({ ok: true,
      wachtend: m.wachtend(code).map(id => m.managerBeeld(code, t, id, door)).filter(x => !x.error),
      eisen: inst.eisen, feestdagen: inst.feestdagen,
      ontbreekt: t.ontbreekt.map(o => o.reden),
      gezondheid: m.gezondheid(code),
      kamers: rtghuis && rtghuis.isRtgZaak(code) ? rtghuis.kamerIds() : null,
      beleidOpen: V().beleidVoor(code).open() });
  });

  app.post('/api/supplier/tijd/beoordeel', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const door = zelf(req);
    if (!door) return res.status(403).json({ error: 'Een besluit over iemands tijd tekent u op eigen naam, met uw persoonlijke login.' });
    const b = req.body || {};
    const code = req.supplier.code;
    const t = V().teambeeld(code);
    return duurzaam(res, () => V().motor.beoordeelMens(code, t, String(b.id || ''),
      { door, besluit: b.besluit, reden: b.reden ? String(b.reden).slice(0, 500) : '' }));
  });

  app.post('/api/supplier/tijd/bezetting', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    return duurzaam(res, () => V().instellingen.zetEisen(req.supplier.code, (req.body || {}).eisen,
      { door: zelf(req) || 'zaak', leidinggevende: true }));
  });

  app.post('/api/supplier/tijd/feestdagen', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    return duurzaam(res, () => V().instellingen.zetFeestdagen(req.supplier.code, (req.body || {}).feestdagen, { leidinggevende: true }));
  });
};
