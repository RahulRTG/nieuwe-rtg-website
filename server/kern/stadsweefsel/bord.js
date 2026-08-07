/* RTG Stadsweefsel, deel "bord": het overzicht en de kaart.

   Twee vragen die de boardroom als eerste stelt -- hoe groot is de stad en wat
   staat er open, en teken hem eens -- en die allebei over ALLE andere delen
   heen kijken. Ze staan daarom niet in een van die delen maar hier, en ze
   rekenen niets zelf uit: elk getal komt uit de laag die het bijhoudt.

   Krijgt de gedeelde ctx van kern/stadsweefsel/index.js. */
module.exports = (ctx) => {
  const { bak, geo, obj, rel, tr, zkn, werk, con, ond, kli, zorgWeefsel, gemisteMetingen } = ctx;

  /* Het weefselbeeld voor de boardroom: hoe groot is de stad, wat staat er
     open, en wat vraagt zonder dat iemand belde om aandacht. Bewust een
     samenvatting -- de losse lijsten hebben hun eigen poorten. */
  function beeld() {
    zorgWeefsel();
    const objecten = obj.zoek({});
    const zaken = zkn.lijst({});
    const orders = werk.werklijst({});
    const perCategorie = {};
    for (const z of zaken) perCategorie[z.categorie] = (perCategorie[z.categorie] || 0) + 1;
    const waarde = objecten.reduce((s, o) => s + (o.waarde.vervanging || 0), 0);
    return {
      status: 200,
      gebieden: geo.NIVEAUS.map(n => ({ niveau: n, aantal: geo.opNiveau(n).length })),
      objecten: { totaal: objecten.length, vervangingswaarde: waarde,
        perSoort: objecten.reduce((m, o) => { m[o.soort] = (m[o.soort] || 0) + 1; return m; }, {}),
        storing: objecten.filter(o => o.status === 'storing').length },
      relaties: rel.relaties().length,
      zaken: { open: zaken.length, perCategorie, urgent: zaken.filter(z => z.prioriteit === 'urgent').length },
      werk: { open: orders.length, perPloeg: orders.reduce((m, w) => { m[w.ploeg] = (m[w.ploeg] || 0) + 1; return m; }, {}) },
      aandacht: obj.api.weefselAandacht().objecten.slice(0, 8),
      onderhoud: { teDoen: ond.teDoen({}).length, zwaarste: ond.teDoen({}).slice(0, 3).map(x => ({ naam: x.object.naam, score: x.score, redenen: x.redenen })) },
      contracten: con.contracten().filter(c => c.actief).length,
      klimaat: kli.voorRampbeeld(),
      oorzaken: Object.keys(zkn.CATS).map(c => zkn.oorzaakZoek(c)).filter(Boolean),
      reeksen: { emmers: Object.keys(bak().reeksen).length, bewaartermijnDagen: tr.BEWAAR, nietGeboekt: gemisteMetingen() },
      privacy: 'het weefsel kent objecten, plaatsen en codenamen -- geen inwoners; metingen zijn dingen, geen mensen'
    };
  }

  /* De kaart: alles met een positie in EEN antwoord, zodat een scherm de stad
     kan tekenen zonder vier vragen te stellen. Begrensd, want een kaart met
     tienduizend punten is geen kaart meer. */
  function kaart({ gebied } = {}) {
    zorgWeefsel();
    const grens = gebied ? String(gebied) : null;
    const objecten = obj.zoek(grens ? { gebied: grens } : {}).slice(0, 1500);
    const zaken = zkn.lijst(grens ? { gebied: grens } : {}).slice(0, 500);
    return {
      status: 200,
      grenzen: geo.api.weefselGebieden({ niveau: 'zone' }).gebieden.map(g => ({ id: g.id, naam: g.naam, geometrie: g.geometrie })),
      objecten: objecten.map(o => ({ id: o.id, soort: o.soort, naam: o.naam, lat: o.lat, lng: o.lng, status: o.status, risico: o.risico })),
      zaken: zaken.map(z => ({ id: z.id, ref: z.ref, categorie: z.categorie, prioriteit: z.prioriteit, lat: z.lat, lng: z.lng, status: z.status }))
    };
  }

  return { beeld, kaart };
};
