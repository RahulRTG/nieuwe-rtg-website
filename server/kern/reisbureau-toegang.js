/* De bestaande kantoor- en leverancierspoorten vertalen naar de eigenaar van
   een reisopdracht. Dit is geen rechtenregister: de route blijft achter
   officeAuth of supplierAuth. De persoonlijke identiteit, actuele zaakrol en
   tenantbinding worden hier opnieuw gelezen voordat een reiscontract verandert.

   Een zaakcode is een relatie, org is de tenant (TENANT.md). Een org, actor of
   manager-vlag uit de body is daarom nooit invoer van deze adapter. De eerste
   keten sluit alleen contracten met het bestaande managementrecht; fijnere
   werkrollen vragen eerst een bewezen bestaand domeinrecht.

   De uitkomst geldt voor deze aanroep, niet als blijvend mandaat. */
'use strict';

const PERSOON = /^user-([1-9]\d*)$/;
const LOPEND = new Set(['actief', 'opzegging']);
const fout = (status, error) => ({ status, error });
const codeVan = value => String(value || '').trim().toUpperCase();

function maakReisToegang(kern) {
  function kantoorActor(req) {
    if (!kern.accounts || typeof kern.accounts.getUserById !== 'function' ||
        typeof kern.accounts.isActief !== 'function' || typeof kern.boardroomWie !== 'function')
      return fout(503, 'De persoonlijke kantoortoegang is niet beschikbaar.');
    if (!req || typeof req.get !== 'function')
      return fout(403, 'Een reiscontract vraagt een persoonlijke kantoorsessie.');
    const actorRef = kern.boardroomWie(req);
    const persoon = PERSOON.exec(String(actorRef || ''));
    /* officeKey wordt uitsluitend door officeAuth gezet. boardroomWie alleen
       zou ook het gewone ledentoken herkennen en is dus geen kantoorrecht. */
    if (!persoon || !req || req.officeKey !== actorRef)
      return fout(403, 'Een reiscontract vraagt een persoonlijke kantoorsessie.');
    const id = Number(persoon[1]);
    const account = Number.isSafeInteger(id) ? kern.accounts.getUserById(id) : null;
    if (!account || !kern.accounts.isActief(account))
      return fout(401, 'Dit persoonlijke RTG-account is niet meer actief.');
    return Object.freeze({ org: 'rtg', actorRef, role: 'kantoor' });
  }

  function zaakTenant(supplierCode, verkoper) {
    const tenant = kern.tenant;
    if (typeof kern.findSupplier !== 'function' || !tenant || !tenant.register ||
        typeof tenant.register.vanZaak !== 'function' || !tenant.levensloop ||
        typeof tenant.levensloop.stand !== 'function')
      return fout(503, 'De zaak- en tenanttoegang is niet beschikbaar.');
    const supplier = kern.findSupplier(supplierCode);
    if (!supplier || codeVan(supplier.code) !== supplierCode ||
        supplier.partnerStatus === 'geschorst' || supplier.partnerStatus === 'beeindigd')
      return fout(403, 'Deze partnerwerkplek is gesloten.');
    if (verkoper && supplier.type !== 'reisbureau')
      return fout(403, 'De verkoop van deze reis hoort bij een reisbureau.');
    const organisatie = tenant.register.vanZaak(supplierCode);
    if (!organisatie || !organisatie.org || organisatie.actief === false)
      return fout(403, 'Deze zaak heeft geen actieve tenantbinding.');
    const levensloop = tenant.levensloop.stand(organisatie.org);
    if (!levensloop || !LOPEND.has(levensloop.stand))
      return fout(403, 'Deze tenant is gesloten voor nieuwe reisopdrachten.');
    return Object.freeze({ org: organisatie.org, supplierCode, naam: supplier.name || supplierCode });
  }

  /* De klant mag kiezen AAN WIE een vraag wordt gericht. Dat selectorveld
     geeft geen toegang tot de administratie van het gekozen reisbureau. */
  function ontvanger(supplierCode) {
    if (supplierCode != null && typeof supplierCode !== 'string')
      return fout(400, 'Kies een geldige reisbureaucode.');
    const code = codeVan(supplierCode);
    if (!code) return Object.freeze({ org: 'rtg', supplierCode: null, naam: 'RTG Travel' });
    return zaakTenant(code, true);
  }

  /* Een offerteregel wijst naar een concrete aanbieder. Anders dan de keuze
     van een reisbureau betekent een lege code hier niet RTG Travel. */
  function leverancier(supplierCode) {
    if (typeof supplierCode !== 'string' || !codeVan(supplierCode))
      return fout(400, 'Kies een geldige leverancierscode.');
    return zaakTenant(codeVan(supplierCode), false);
  }

  function zaak(req, verkoper) {
    const accounts = kern.accounts;
    const tenant = kern.tenant;
    if (!accounts || typeof accounts.controleerStaffSessie !== 'function' ||
        typeof kern.sessionFor !== 'function' || typeof kern.findSupplier !== 'function' ||
        !tenant || !tenant.register || typeof tenant.register.vanZaak !== 'function' ||
        !tenant.levensloop || typeof tenant.levensloop.stand !== 'function')
      return fout(503, 'De persoonlijke zaak- en tenanttoegang is niet beschikbaar.');
    const header = req && typeof req.get === 'function' ? String(req.get('authorization') || '') : '';
    const sess = header.startsWith('Bearer ') ? kern.sessionFor(header.slice(7)) : null;
    const identiteit = accounts.controleerStaffSessie(sess);
    if (!identiteit.ok) return fout(identiteit.status || 401, identiteit.error || 'Geen persoonlijke zaaksessie.');
    const staff = identiteit.staff;
    /* De oudere, gedeelde demosessie is geen bevoegdheid om contracten te
       sluiten. Alleen de bestaande persoonlijke staff/account-binding telt. */
    if (!staff || Number(staff.active) !== 1 || !Number.isSafeInteger(Number(staff.member_id)) ||
        Number(staff.member_id) < 1 || Number(staff.member_id) !== Number(sess.lid))
      return fout(403, 'Een reiscontract vraagt een actieve, persoonlijke personeelsplek.');
    const supplierCode = codeVan(sess.code);
    if (!supplierCode || codeVan(staff.supplier_code) !== supplierCode || !req.supplier ||
        codeVan(req.supplier.code) !== supplierCode || !req.actor ||
        Number(req.actor.staffId) !== Number(staff.id))
      return fout(403, 'De reisopdracht hoort niet bij deze personeelsplek.');
    /* supplierAuth heeft de route toegelaten. Voor de economische handeling
       geldt de NU opgeslagen rol, nooit het manager-vlaggetje in de sessie. */
    if (staff.role !== 'manager') return fout(403, 'Alleen een actuele manager kan deze reisopdracht uitvoeren.');
    const doel = zaakTenant(supplierCode, verkoper);
    if (doel.error) return doel;
    return Object.freeze({ org: doel.org, supplierCode,
      actorRef: 'user-' + Number(staff.member_id), role: staff.role });
  }

  return { kantoor: kantoorActor, partner: req => zaak(req, true), aanbieder: req => zaak(req, false), ontvanger, leverancier };
}

module.exports = { maakReisToegang };
