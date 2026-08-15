/* Bedrijfsprofiel, bouwstenen en veilige profielimport voor de Partnerstudio.
   Dit deel raakt geen operationele order-, betaal- of klantentabel. */
'use strict';

const RECHTEN = ['bekijken', 'bewerken', 'goedkeuren', 'oefenen'];

module.exports = ({ basis: B }) => {
  function fout(error, status = 400) { return { error, status }; }
  function check(t, invoer) { return B.magWijzigen(t, invoer && invoer.versie); }
  function overzicht(supplier) {
    if (!supplier || supplier.partnerStatus === 'geschorst' || supplier.partnerStatus === 'beeindigd')
      return fout('Alleen een actieve, officieel goedgekeurde RTG-partner krijgt een Partnerstudio.', 403);
    return Object.assign({ ok: true }, B.eigenBeeld(B.tweeling(supplier)));
  }
  function profielZet(supplier, actor, invoer = {}) {
    const t = B.tweeling(supplier), geblokkeerd = check(t, invoer);
    if (geblokkeerd) return geblokkeerd;
    const omschrijving = B.tekst(invoer.omschrijving, 800), trainingsdoel = B.tekst(invoer.trainingsdoel, 500);
    const bedrijfsmodel = B.tekst(invoer.bedrijfsmodel, 40), sector = B.tekst(invoer.sector, 70);
    if (omschrijving.length < 40) return fout('Beschrijf het bedrijf in minimaal 40 tekens.');
    if (trainingsdoel.length < 20) return fout('Beschrijf het trainingsdoel in minimaal 20 tekens.');
    if (!['dienstverlening', 'productie', 'handel', 'platform', 'maatschappelijk'].includes(bedrijfsmodel))
      return fout('Kies een geldig bedrijfsmodel.');
    t.profiel = { sector: sector || t.type, omschrijving, trainingsdoel, bedrijfsmodel };
    t.toestemming = { merkInSpel: invoer.merkInSpel === true,
      synthetischeDossiers: invoer.synthetischeDossiers === true,
      geheimenUitgesloten: invoer.geheimenUitgesloten === true };
    B.wijzig(t, actor, 'profiel-bijgewerkt', 'Bedrijfsprofiel en gegevensgrenzen aangepast.');
    return Object.assign({ ok: true }, B.eigenBeeld(t));
  }
  function schoonItem(t, soort, invoer) {
    const naam = B.tekst(invoer.naam, 100);
    if (!naam) return fout('Geef deze bouwsteen een naam.');
    if (soort === 'locatie') return { naam, plaats: B.tekst(invoer.plaats, 80) || t.stad,
      soort: B.tekst(invoer.locatieSoort, 40) || 'werkplek', trainingslocatie: true };
    if (soort === 'afdeling') {
      const doel = B.tekst(invoer.doel, 300);
      if (doel.length < 10) return fout('Beschrijf kort waarvoor deze afdeling verantwoordelijk is.');
      return { naam, doel };
    }
    if (soort === 'rol') {
      const afdelingId = B.tekst(invoer.afdelingId, 80);
      if (!t.afdelingen.some(x => x.id === afdelingId)) return fout('Koppel de rol aan een bestaande afdeling.');
      const rechten = [...new Set((Array.isArray(invoer.rechten) ? invoer.rechten : []).map(String).filter(x => RECHTEN.includes(x)))];
      if (!rechten.includes('oefenen')) rechten.push('oefenen');
      return { naam, afdelingId, rechten };
    }
    if (soort === 'aanbod') return { naam, categorie: B.tekst(invoer.categorie, 60) || 'Dienst',
      eenheid: B.tekst(invoer.eenheid, 40) || 'opdracht', bron: 'handmatig', bevatPrijs: false };
    if (soort === 'werkproces') {
      const afdelingId = B.tekst(invoer.afdelingId, 80), rolId = B.tekst(invoer.rolId, 80), stappen = B.regels(invoer.stappen, 16);
      if (!t.afdelingen.some(x => x.id === afdelingId)) return fout('Koppel het werkproces aan een bestaande afdeling.');
      if (!t.rollen.some(x => x.id === rolId)) return fout('Koppel het werkproces aan een bestaande oefenrol.');
      if (stappen.length < 3) return fout('Een realistisch werkproces heeft minimaal drie controleerbare stappen.');
      return { naam, afdelingId, rolId, stappen, doel: B.tekst(invoer.doel, 300) || 'Veilig en aantoonbaar afronden' };
    }
    return fout('Onbekend type bouwsteen.');
  }
  function bouwsteenZet(supplier, actor, soortIn, invoer = {}) {
    const soort = B.tekst(soortIn, 30), def = B.SOORTEN[soort], t = B.tweeling(supplier), geblokkeerd = check(t, invoer);
    if (!def) return fout('Kies locatie, afdeling, rol, aanbod of werkproces.');
    if (geblokkeerd) return geblokkeerd;
    const item = schoonItem(t, soort, invoer);
    if (item.error) return item;
    const lijst = t[def.veld], bestaand = B.tekst(invoer.id, 80) && lijst.find(x => x.id === B.tekst(invoer.id, 80));
    if (!bestaand && lijst.length >= def.limiet) return fout('De limiet voor ' + soort + ' is bereikt.', 409);
    if (bestaand) Object.assign(bestaand, item); else lijst.push(Object.assign({ id: B.id(soort) }, item));
    B.wijzig(t, actor, bestaand ? soort + '-bijgewerkt' : soort + '-toegevoegd', item.naam);
    return Object.assign({ ok: true }, B.eigenBeeld(t));
  }
  function bouwsteenWeg(supplier, actor, soortIn, invoer = {}) {
    const soort = B.tekst(soortIn, 30), def = B.SOORTEN[soort], t = B.tweeling(supplier), geblokkeerd = check(t, invoer);
    if (!def) return fout('Onbekend type bouwsteen.');
    if (geblokkeerd) return geblokkeerd;
    const lijst = t[def.veld], index = lijst.findIndex(x => x.id === B.tekst(invoer.id, 80));
    if (index < 0) return fout('Deze bouwsteen bestaat niet.', 404);
    const item = lijst[index];
    if (soort === 'afdeling' && (t.rollen.some(x => x.afdelingId === item.id) || t.werkprocessen.some(x => x.afdelingId === item.id)))
      return fout('Deze afdeling wordt nog door een rol of werkproces gebruikt.', 409);
    if (soort === 'rol' && t.werkprocessen.some(x => x.rolId === item.id)) return fout('Deze rol wordt nog door een werkproces gebruikt.', 409);
    lijst.splice(index, 1); B.wijzig(t, actor, soort + '-verwijderd', item.naam);
    return Object.assign({ ok: true }, B.eigenBeeld(t));
  }
  function importeer(supplier, actor, invoer = {}) {
    const t = B.tweeling(supplier), geblokkeerd = check(t, invoer);
    if (geblokkeerd) return geblokkeerd;
    let locaties = 0, aanbod = 0;
    for (const kamer of (supplier.rooms || []).slice(0, 20)) {
      const naam = B.tekst(kamer.name, 100);
      if (!naam || t.locaties.some(x => x.naam.toLowerCase() === naam.toLowerCase())) continue;
      t.locaties.push({ id: B.id('locatie'), naam, plaats: t.stad, soort: 'operationele ruimte', trainingslocatie: true, bron: 'rtg-profiel' }); locaties += 1;
    }
    for (const product of (supplier.menu || []).slice(0, 80)) {
      const naam = B.tekst(product.name, 100);
      if (!naam || t.aanbod.some(x => x.naam.toLowerCase() === naam.toLowerCase())) continue;
      t.aanbod.push({ id: B.id('aanbod'), naam, categorie: B.tekst(product.cat, 60) || 'Aanbod', eenheid: 'simulatie-eenheid', bron: 'rtg-profiel', bevatPrijs: false }); aanbod += 1;
    }
    if (!locaties && !aanbod) return fout('Er staan geen nieuwe veilige publieke profielvelden klaar om over te nemen.', 409);
    B.wijzig(t, actor, 'rtg-profiel-overgenomen', locaties + ' locaties en ' + aanbod + ' aanbodregels, zonder prijzen of klantdata.');
    return Object.assign({ ok: true, overgenomen: { locaties, aanbod } }, B.eigenBeeld(t));
  }

  return { overzicht, profielZet, bouwsteenZet, bouwsteenWeg, importeer };
};
