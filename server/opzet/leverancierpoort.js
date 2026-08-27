/* DE LEVERANCIERSPOORT: wie er binnenkomt, waar hij heen mag seinen, en wat er
   van de MENS achter de balie wordt gevraagd.

   Acht dingen die bij elkaar horen: de twee SSE-wegen (naar een zaak, naar het
   kantoor), de melding aan een zaak, de index die een code in O(1) op een zaak
   terugvoert, de opzoeking zelf, de poort waar ELKE supplier-route doorheen
   moet, de persoonseis die daaraan hangt, en het activiteitenjournaal.

   WAAROM DIT EEN EIGEN BESTAND IS. server/server.js staat op 121 kilobyte. Hij
   mag groot zijn -- hij is de ophanglijst van het hele huis en staat daarom in
   de MAG-lijst van scripts/check.js -- maar met een belofte erbij: "wordt per
   ronde verder verdund". Dit is die ronde.

   EN DEZE ACHT ZIJN NIET WILLEKEURIG. supplierAuth is een POORT, en een poort
   die in een bestand van tweeduizend regels woont kun je niet in een keer
   nakijken -- terwijl dat precies is wat je met een poort wilt doen. De
   persoonseis eronder houdt hele beroepsgroepen tegen (kinderopvang,
   beveiliging, hulpdiensten) en geldt uitdrukkelijk OOK voor de manager.

   WAT ER BINNENKOMT, EN WAAROM DRIE ERVAN BIJZONDER ZIJN.

   `bus` en `kern` komen als GETTER binnen. De dienstenlaag (./diensten.js)
   levert de bus maar krijgt findSupplier en de twee SSE-wegen van hieruit mee,
   dus die twee kunnen niet allebei eerst zijn; en `kern` wordt pas onderaan
   server.js gebouwd. Alles hieronder draait pas bij een VERZOEK, en dan staan
   ze er allang. Een vaste verwijzing zou hier voor altijd undefined zijn --
   dezelfde late binding als commDm en dyncodeGeef in server.js. De Proxy op
   kern is daarbij geen kunstje maar het bestaande idioom: ./domeingrens.js doet
   hetzelfde, en om dezelfde reden ("een kopie bevriest dat"). Met die twee
   schilletjes zijn de acht functies WOORD VOOR WOORD overgenomen.

   `grootSupplierSync` gaat als parameter mee en stond in server.js als vrije
   naam in het bereik -- precies het soort binding dat bij een verhuizing STIL
   stukgaat, want findSupplier valt er alleen op terug als de zaak NIET in de
   kleine kast staat. Hij is gevonden doordat deze poort een eigen toets kreeg,
   niet door hem te lezen. Zie test/leverancierpoort.test.js.
   ========================================================================== */
'use strict';

module.exports = ({ db, save, crypto, rtgKlok, sessionFor, DEMO,
  grootSupplierSync, busGeef, kernGeef }) => {
  const bus = { publish: (a, b) => busGeef().publish(a, b) };
  const kern = new Proxy({}, { get: (_, naam) => kernGeef()[naam] });

  // SSE-routering naar een specifieke leverancier of naar de backoffice
  function sseToSupplier(code, event, data) {
    bus.publish('sse', { doel: 'sup', match: code, event, data, envelop: { classificatie: 'intern' } });
  }
  function sseToOffice(event, data) {
    bus.publish('sse', { doel: 'office', event, data, envelop: { classificatie: 'intern' } });
  }

  function notifySupplier(code, note) {
    const n = { id: crypto.randomBytes(4).toString('hex'), read: false, at: rtgKlok.datum().toISOString(), ...note };
    db.data.supplierNotifications[code] = (db.data.supplierNotifications[code] || []);
    db.data.supplierNotifications[code].unshift(n);
    db.data.supplierNotifications[code] = db.data.supplierNotifications[code].slice(0, 40);
    save();
    sseToSupplier(code, 'notify', n);
    return n;
  }

  /* Leverancier opzoeken op code. Met miljoenen zaken in de kast is een lineaire
     scan (Array.find) per verzoek te duur: elke kassahandeling, elke bestelling
     en elke inlog zoekt een zaak op. Daarom een index (code -> zaak) die zichzelf
     herbouwt zodra het aantal zaken verandert (nieuwe partner erbij). Zo is elke
     opzoeking O(1), ook bij miljoenen restaurants. */
  let _supIndex = null, _supIndexLen = -1;
  function supplierIndex() {
    if (!_supIndex || _supIndexLen !== db.data.suppliers.length) {
      _supIndex = new Map();
      for (const s of db.data.suppliers) _supIndex.set(s.code, s);
      _supIndexLen = db.data.suppliers.length;
    }
    return _supIndex;
  }
  function findSupplier(code) {
    const c = String(code || '').trim().toUpperCase();
    // eerst de kleine, actieve kast in het geheugen (O(1)); anders het grootboek
    // in Postgres (miljoenen bulk-zaken, op aanvraag ingeladen met cache).
    return supplierIndex().get(c) || grootSupplierSync(c) || null;
  }
  function supplierAuth(req, res, next) {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const sess = token && sessionFor(token);
    if (!sess || sess.role !== 'supplier') return res.status(401).json({ error: 'Niet ingelogd als leverancier.' });
    req.supplier = findSupplier(sess.code);
    if (!req.supplier) return res.status(401).json({ error: 'Leverancier niet gevonden.' });
    if (req.supplier.partnerStatus === 'geschorst' || req.supplier.partnerStatus === 'beeindigd')
      return res.status(401).json({ error: 'Deze partnerwerkplek is door RTG gesloten.' });
    // Wie is er aan het werk (voor toeschrijving van activiteiten).
    req.actor = { name: sess.actor || 'Beheer', role: sess.staffRole || 'manager', staffId: sess.staffId || null, manager: !!sess.manager, lid: sess.lid || null, lidKey: sess.lidKey || null };
    /* DE PERSOONSEIS. Hier en niet bij de inlog, want dit is het enige keelgat
       waar ELKE supplier-route doorheen moet -- een tweede poort bij /login zou
       de route missen die iemand er later naast bouwt (LAT-regel 5: niets slaat
       stil over). De inlog roept dezelfde functie aan om het meteen te kunnen
       zeggen in plaats van een sessie uit te delen die nergens komt.

       Hij geldt ook voor de manager. Bij een kinderopvang is er geen functie
       waarbij je niet in de buurt van een kind komt, en juist de vrijstelling
       voor de baas is de deur waar een fraudeur op mikt. De weg terug loopt via
       het EIGEN RTG-account (/api/vakbewijs/...), niet via de werkgever: wie zijn
       eigen VOG kan aftekenen, heeft geen VOG nodig. */
    const poort = persoonsPoort(req.supplier, req.actor);
    if (!poort.ok) return res.status(403).json({ error: poort.error, persoonseis: poort.missend || null });
    next();
  }

  /* Mag deze mens werken in een zaak van dit genre? Late binding: de kernlaag
     bouwt persoonseis pas verderop, en deze functie draait pas bij een verzoek.
     Ontbreekt de laag toch (een toets die de kern niet opbouwt), dan is dat GEEN
     stilzwijgend "ja": een genre met een eis hoort dan dicht te zijn. */
  function persoonsPoort(supplier, actor) {
    if (!kern.persoonseis) {
      /* `../kern/` en niet `./kern/`: dit bestand woont in server/opzet/ en niet
         meer in de wortel van server/. Dat pad ging bij het verhuizen mee en was
         daarmee stuk -- op het NOODPAD, dus alleen wanneer de persoonseislaag er
         niet is, en dat is precies het pad dat een gereguleerd genre dicht hoort
         te houden. Het viel niet om in een enkele bestaande toets; het kwam
         boven toen deze poort er eindelijk een eigen kreeg. */
      const eis = require('../kern/persoonseis').EISEN[String(supplier && supplier.type || '')];
      if (!eis || !eis.werk) return { ok: true };
      return { ok: false, error: 'De persoonscontrole is niet beschikbaar; dit genre gaat dan niet open.' };
    }
    /* DE ENE UITZONDERING, EN ZIJ STAAT HIER MET NAAM. De demo-bedrijfsinlog
       (gebruikersnaam + wachtwoord, geen personeelsrij) is geen mens: hij draagt
       geen staffId en geen lidnummer, en er valt dus niets van te eisen.

       Waarom dat GEEN gat is: die weg bestaat alleen in demostand. In productie
       antwoordt /api/supplier/login op precies deze tak met 403 ("Demo-inlog is
       uitgeschakeld. Log in op uw naam met uw persoonlijke pincode"), dus er is
       buiten de demo geen inlog die hier langskomt. De voorwaarde `DEMO` staat er
       toch bij en niet alleen die 403: een poort die op een andere poort vertrouwt
       is een poort die openvalt zodra iemand die andere verzet.

       Wat hier NIET onder valt: de eigenaar die met zijn eigen RTG-account zijn
       zaak binnengaat. Die draagt wel een lidnummer, en wordt dus gewoon getoetst
       -- een kinderopvang van je eigen zaak vraagt ook van de eigenaar een VOG. */
    if (DEMO && kern.persoonseis.isGedeeldeInlog(actor)) {
      return { ok: true, demo: true };
    }
    return kern.persoonseis.magWerkenHier(supplier && supplier.type,
      kern.persoonseis.persoonVanActor(actor));
  }

  // Legt vast wie wat deed binnen het bedrijf; live zichtbaar in de team-tab.
  function logActivity(code, actor, text) {
    const list = db.data.supplierActivity[code] = (db.data.supplierActivity[code] || []);
    list.unshift({ who: actor ? actor.name : 'Beheer', text, at: new Date().toISOString() });
    db.data.supplierActivity[code] = list.slice(0, 80);
    save();
    sseToSupplier(code, 'sync', { scope: 'team' });
  }

  return { sseToSupplier, sseToOffice, notifySupplier, supplierIndex,
    findSupplier, supplierAuth, persoonsPoort, logActivity };
};
