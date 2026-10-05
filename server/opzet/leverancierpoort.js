/* DE LEVERANCIERSPOORT: wie er binnenkomt, waar hij heen mag seinen, en wat er
   van de MENS achter de balie wordt gevraagd.

   Acht dingen die bij elkaar horen: de twee SSE-wegen (naar een zaak, naar het
   kantoor), de melding aan een zaak, de index die een code op een actuele zaak
   terugvoert, de opzoeking zelf, de poort waar ELKE supplier-route doorheen
   moet, de persoonseis die daaraan hangt, en het activiteitenjournaal.

   supplierAuth is apart leesbaar omdat ELKE supplier-route hierlangs gaat.
   De persoonseis geldt ook voor de manager (kinderopvang, beveiliging en
   hulpdiensten). De index mag daarvoor nooit een vervangen partner vasthouden.

   `bus` en `kern` komen als GETTER binnen: diensten.js levert de bus maar
   gebruikt findSupplier en de SSE-wegen van deze poort; kern wordt later
   gebouwd. Beide worden daarom pas bij het verzoek opgehaald. Een kopie bij
   opbouw bevriest undefined. `grootSupplierSync` blijft een expliciete binding:
   die wordt alleen na een actuele lokale miss aangesproken. De eigen toetsen
   in test/leverancierpoort.test.js bewaken deze grenzen.
   ========================================================================== */
'use strict';

const envelop = require('./envelop');
const kostenhaak = require('../kern/kosten/haak');

module.exports = ({ db, save, crypto, rtgKlok, sessionFor, DEMO, accounts,
  grootSupplierSync, busGeef, kernGeef }) => {
  const routepoort = require('../kern/commercie/routepoort');
  const bus = { publish: (a, b) => busGeef().publish(a, b) };
  const kern = new Proxy({}, { get: (_, naam) => kernGeef()[naam] });

  // SSE-routering naar een specifieke leverancier of naar de backoffice
  function sseToSupplier(code, event, data) {
    bus.publish('sse', { doel: 'sup', match: code, event, data, envelop: { classificatie: 'intern' } });
  }
  function sseToOffice(event, data) {
    bus.publish('sse', { doel: 'office', event, data, envelop: { classificatie: 'intern' } });
  }

  const notifySupplier = require('./leveranciersmeldingen')({ meldingen: () => db.data.supplierNotifications, save, crypto, rtgKlok, sseToSupplier });

  const supplierIndex = require('./leverancierindex')(() => db.data.suppliers);
  function findSupplier(code) {
    const c = String(code || '').trim().toUpperCase();
    // Eerst de actuele kleine kast in het geheugen; anders het grootboek
    // in Postgres (miljoenen bulk-zaken, op aanvraag ingeladen met cache).
    return supplierIndex().get(c) || grootSupplierSync(c) || null;
  }
  function supplierAuth(req, res, next) {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const sess = token && sessionFor(token);
    const identiteit = accounts.controleerStaffSessie(sess);
    if (!identiteit.ok) return res.status(identiteit.status).json({ error: identiteit.error });
    req.supplier = findSupplier(sess.code);
    if (!req.supplier) return res.status(401).json({ error: 'Leverancier niet gevonden.' });
    if (req.supplier.partnerStatus === 'geschorst' || req.supplier.partnerStatus === 'beeindigd')
      return res.status(401).json({ error: 'Deze partnerwerkplek is door RTG gesloten.' });
    // Wie is er aan het werk (voor toeschrijving van activiteiten).
    req.actor = { name: sess.actor || 'Beheer', role: sess.staffRole || 'manager', staffId: sess.staffId || null, manager: !!sess.manager, lid: sess.lid || null, lidKey: sess.lidKey || null };
    envelop.zet(req, { soort: 'medewerker', id: sess.staffId || sess.lidKey || null,
      naam: sess.actor || null, rol: sess.staffRole || 'manager',
      tenantSoort: 'zaak', tenantId: req.supplier.code || null,
      gezagBron: 'zaakrol', gezagBaas: !!sess.manager });
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

    /* HET ABONNEMENT VAN DE ZAAK. Hier, om precies dezelfde reden als de
       persoonseis erboven: dit is het enige keelgat waar elke leveranciersroute
       doorheen moet, dus een kassaroute die er morgen naast wordt gebouwd valt
       er vanzelf onder. Waarom deze poort TERUGVALT waar de persoonseis
       DICHTVALT, staat in kern/commercie/routepoort.js. */
    const abo = routepoort.voorZaak(kern.zaakAbonnement, req.supplier.code, req.path, kern.handhavingSchaduw);
    if (!abo.ok) return res.status(402).json({ error: abo.error, capability: abo.cap, nodig: abo.nodig || null });

    // Kostencontext op de ZAAKCODE en NA de abonnementspoort (KOSTEN.md par. 6).
    const drager = kostenhaak.drager('zaak', req.supplier.code);
    kostenhaak.meld('verzoek', 1, { drager, pas: 'zaak' });
    kostenhaak.binnen(drager, next, 'zaak', 'sessie');
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
  function noteerActiviteit(code, actor, text, bewaar) {
    const list = db.data.supplierActivity[code] = (db.data.supplierActivity[code] || []);
    list.unshift({ who: actor ? actor.name : 'Beheer', text, at: new Date().toISOString() });
    db.data.supplierActivity[code] = list.slice(0, 80);
    bewaar();
    sseToSupplier(code, 'sync', { scope: 'team' });
  }
  const logActivity = (code, actor, text) => noteerActiviteit(code, actor, text, save);
  // Alleen voor een caller die zijn andere mutaties al zelf heeft bewaard.
  // Gewone activiteit bewaart ook de bestaande impliciete domeinmutaties mee.
  logActivity.alleenActiviteit = (code, actor, text) => noteerActiviteit(code, actor, text,
    () => typeof save.sleutels === 'function' ? save.sleutels(['supplierActivity']) : save());

  return { sseToSupplier, sseToOffice, notifySupplier, supplierIndex,
    findSupplier, supplierAuth, persoonsPoort, logActivity };
};
