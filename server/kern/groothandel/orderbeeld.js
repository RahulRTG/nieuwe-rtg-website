/* Leesmodel van bestaande orders. Filtert op koper of leverancier en
   projecteert hun toegestane klantbeeld. Geen voorraad-, bestel- of schrijfpoort;
   de orderketen blijft eigenaar van statuswijzigingen en opslag. */
module.exports = ({ orders, klantSoortVan, GH_KLAAR }) => {
  function publiekeOrder(o, kant) {
    return {
      ref: o.ref, groothandelCode: o.groothandelCode, groothandelNaam: o.groothandelNaam,
      klant: kant === 'groothandel' ? o.klant : { soort: o.klant.soort, naam: o.klant.naam },
      regels: o.regels, subtotaal: o.subtotaal, bezorgen: o.bezorgen, soort: o.soort, bron: o.bron,
      status: o.status, at: o.at, stappen: o.stappen, ontvangst: o.ontvangst || null
    };
  }
  function mijnBestellingen(koper) {
    const soort = klantSoortVan(koper);
    return orders().filter(o => o.klant.soort === soort && o.klant.id === koper.id).slice(0, 100).map(o => publiekeOrder(o, 'klant'));
  }
  function inkomend(groothandelCode) {
    const lijst = orders().filter(o => o.groothandelCode === groothandelCode);
    return {
      open: lijst.filter(o => !GH_KLAAR[o.status]).map(o => publiekeOrder(o, 'groothandel')),
      afgerond: lijst.filter(o => GH_KLAAR[o.status]).slice(0, 60).map(o => publiekeOrder(o, 'groothandel')),
      omzet: Math.round(lijst.filter(o => o.status === 'geleverd').reduce((n, o) => n + o.subtotaal, 0) * 100) / 100
    };
  }

  return { publiekeOrder, mijnBestellingen, inkomend };
};
