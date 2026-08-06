/* RTG STADSWEEFSEL: de laag die van losse stadssystemen EEN stad maakt.

   RTG had de organen al -- sensoren (kern/stad), gemeente, overheid, OV,
   hulpdiensten, rampbeeld, gebouwen, betalingen. Wat ontbrak was het weefsel
   ertussen: geografie, objecten, relaties, geheugen, zaken en werk. Zonder dat
   weet het platform wel DAT er iets speelt, maar niet waar het is, wat eromheen
   staat, of twee meldingen hetzelfde probleem zijn, wat er meevalt als het
   uitvalt, of het vaker gebeurt, en wat het heeft gekost om op te lossen.

   Zes delen, in deze volgorde gemount omdat elk deel op de vorige leunt:
     geografie.js       stad -> wijk -> buurt -> zone -> straatsegment
     objecten.js        het assetregister: wat er staat, van wie, in welke staat
     relaties.js        de getypeerde randen ertussen (voedt, voert af naar)
     afhankelijkheden.js wat sleept wat mee (gevolgen, oorzaken, uitvalbeeld)
     tijdreeksen.js     het geheugen: uur- en dagemmers met een bewaartermijn
     zaken.js           een waarneming uit elk kanaal -> een zaak, dedup en al
     werkorders.js      van zaak naar uitgevoerd werk, kosten en historie

   OPSLAG. De registers (gebieden, objecten, relaties, reeksen) staan onder een
   tak db.data.weefsel: dat is het BEELD van de stad en het verloopt niet -- een
   lantaarnpaal gaat niet weg omdat hij oud is. De gebeurtenissen staan er
   bewust NAAST, in db.data.weefselZaken en db.data.weefselWerk, want die dragen
   wel een termijn en die staat in server/bewaartermijnen.js.

   WAT DEZE LAAG NIET IS. Geen netbeheer en geen aansturing: hij rekent op een
   geregistreerd net en schakelt nooit iets in de fysieke wereld. Geen
   persoonsregister: er staan objecten, plaatsen en codenamen in, geen
   inwoners. En geen beslisser: hij wijst een gedeelde oorzaak AAN, hij
   concludeert hem niet. */

module.exports = (deps) => {
  const { db, save, crypto, sseToOffice, melderSeintje, log } = deps;
  const nu = () => Date.now();
  const d = () => db.data;

  /* De registerbak. Een tak per soort, en een migratiestap die niets doet
     zodra hij een keer is gelopen -- de vorm staat hier, zodat geen enkel
     deelbestand hoeft te raden wat er in db.data staat. */
  function bak() {
    if (!d().weefsel || typeof d().weefsel !== 'object') d().weefsel = {};
    const w = d().weefsel;
    if (!Array.isArray(w.gebieden)) w.gebieden = [];
    if (!w.objecten || typeof w.objecten !== 'object') w.objecten = {};
    if (!Array.isArray(w.relaties)) w.relaties = [];
    if (!w.reeksen || typeof w.reeksen !== 'object') w.reeksen = {};
    return w;
  }

  /* Niets slaat stil over (de lat, regel 5). Een fout in een zijtak van het
     weefsel mag de handeling van een lid niet omgooien, maar hij moet wel
     ergens luid landen: log.uitzondering telt hem in de fout-aggregatie van
     het techniekbord. Een lege catch zou hetzelfde doen als een werkende. */
  const stil = (waar, e) => {
    try { (log || require('../../log').log).uitzondering(e, { bron: 'weefsel', waar }); }
    catch (x) { console.error('[weefsel]', waar, e && e.message, x && x.message); }
  };

  const ctx = { db, save, crypto, nu, d, bak, stil };
  const geo = require('./geografie')(ctx); ctx.geo = geo;
  const obj = require('./objecten')(ctx); ctx.obj = obj;
  const rel = require('./relaties')(ctx); ctx.rel = rel;
  const afh = require('./afhankelijkheden')(ctx); ctx.afh = afh;
  const tr = require('./tijdreeksen')(ctx); ctx.tr = tr;
  const zkn = require('./zaken')(ctx); ctx.zkn = zkn;
  const werk = require('./werkorders')(ctx); ctx.werk = werk;

  const seintje = () => { try { if (sseToOffice) sseToOffice('sync', { scope: 'weefsel' }); } catch (e) { stil('sse', e); } };
  ctx.zaakSeintje = (z) => {
    seintje();
    if (!melderSeintje) return;
    for (const w of z.waarnemingen) if (w.melder) melderSeintje(w.melder);
  };

  function zorgWeefsel() { geo.zorgGeografie(); obj.zorgObjecten(); rel.zorgRelaties(); }

  // metingen die het geheugen niet haalden; zichtbaar op het bord (zie weefselBoek)
  let boekMis = 0;

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
      oorzaken: Object.keys(zkn.CATS).map(c => zkn.oorzaakZoek(c)).filter(Boolean),
      reeksen: { emmers: Object.keys(bak().reeksen).length, bewaartermijnDagen: tr.BEWAAR, nietGeboekt: boekMis },
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

  /* ---- de naden naar de rest van het huis (worden door server.js gekoppeld) ----
     Deze vier zijn met opzet klein: kern/stad blijft de baas over zijn eigen
     bord, en geeft hier alleen door wat het weefsel nodig heeft. */
  const api = {
    weefselZorg: zorgWeefsel,
    weefselBeeld: beeld,
    weefselKaart: kaart,
    // de zonenamen: kern/stad had ze zelf in db.data.stadZones; die waarheid ligt nu hier
    weefselZones: () => { geo.zorgGeografie(); return geo.namen('zone'); },
    weefselZone: (naam) => geo.opNaam(naam, 'zone'),
    // een Stadsdoos krijgt een plaats en wordt een object in het register
    weefselDoosPlaats: (doos) => {
      zorgWeefsel();
      const zone = geo.opNaam(doos.zone, 'zone');
      if (!zone) return null;
      const straat = geo.kinderen(zone.id)[0];
      const punt = straat ? geo.middenVan(straat.geometrie.punten) : zone.centrum;
      const r = obj.objectMaak({ soort: 'sensor', naam: doos.naam || doos.serial, lat: punt.lat, lng: punt.lng,
        beheerder: 'RTG Stadstechniek', bron: 'stadsdoos:' + doos.serial });
      if (!r.ok) { stil('doosplaats', new Error(r.error || 'kon de Stadsdoos niet plaatsen')); return null; }
      // de doos hangt aan de stroom van zijn wijk, dus hij valt mee bij uitval
      const wijk = geo.pad(zone.id).find(g => g.niveau === 'wijk');
      const trafo = wijk ? obj.zoek({ soort: 'transformator', gebied: wijk.id })[0] : null;
      if (trafo) rel.relatieMaak({ van: trafo.id, naar: r.object.id, soort: 'voedt', door: 'stad' });
      return { objectId: r.object.id, gebied: r.object.gebied };
    },
    /* Elke meting van de stad rolt hier op in het geheugen. Wat NIET geboekt
       kan worden (een sensor zonder gebied, een waarde die geen getal is) telt
       mee als gemiste meting en staat op het bord: een geheugen dat stilletjes
       de helft mist, ziet er precies zo uit als een geheugen dat werkt. */
    weefselBoek: (m) => {
      try {
        const r = tr.boek(m);
        if (r === null) {
          boekMis++;
          if (boekMis === 1 || boekMis % 500 === 0)
            stil('boek', new Error('meting niet geboekt (' + boekMis + 'x): sens=' + (m && m.sens) + ' gebied=' + (m && m.gebied)));
        }
        return r;
      } catch (e) { stil('boek', e); return null; }
    },
    // en elk kanaal biedt zijn waarnemingen bij dezelfde motor aan
    weefselMeld: (inv) => zkn.waarneming(inv),
    /* De zaken van een melder, in de melderweergave: zijn EIGEN tekst en de
       stand, niet de vrije tekst van de buren die dezelfde paal meldden. */
    weefselZakenVanMelder: (codenaam) => zkn.vanMelder(codenaam).map(z => zkn.voorMelder(z, codenaam)).filter(Boolean),
    weefselWerkVoorZaak: (zaakId) => werk.voorZaak(zaakId),
    weefselZaakKlaar: (zaakId, wie, notitie) => zkn.zaakKlaar(zaakId, wie, notitie)
  };
  Object.assign(api, geo.api, obj.api, rel.api, afh.api, tr.api, zkn.api, werk.api);
  return { weefsel: api };
};
