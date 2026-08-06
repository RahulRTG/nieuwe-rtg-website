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

  /* De volgorde is gedrag, geen smaak: elk deel leunt op de vorige, en de
     delen die een HAAK zetten (contracten zet de SLA-klok van werkorders,
     werkorders zet de werkhaak van zaken) staan na wat ze aanhaken. */
  const ctx = { db, save, crypto, nu, d, bak, stil };
  const geo = require('./geografie')(ctx); ctx.geo = geo;
  const obj = require('./objecten')(ctx); ctx.obj = obj;
  const rel = require('./relaties')(ctx); ctx.rel = rel;
  const afh = require('./afhankelijkheden')(ctx); ctx.afh = afh;
  const tr = require('./tijdreeksen')(ctx); ctx.tr = tr;
  const zkn = require('./zaken')(ctx); ctx.zkn = zkn;
  const werk = require('./werkorders')(ctx); ctx.werk = werk;
  const con = require('./contracten')(ctx); ctx.con = con;      // zet ctx.slaVoorWerk
  const ond = require('./onderhoud')(ctx); ctx.ond = ond;
  const ind = require('./indicatoren')(ctx); ctx.ind = ind;
  const bes = require('./bestuur')(ctx); ctx.bes = bes;        // het mandaat, vóór de begroting die het leest
  const beg = require('./begroting')(ctx); ctx.beg = beg;
  const insp = require('./inspraak')(ctx); ctx.insp = insp;
  const ene = require('./energie')(ctx); ctx.ene = ene;
  const kli = require('./klimaat')(ctx); ctx.kli = kli;
  const sim = require('./simulatie')(ctx); ctx.sim = sim;
  const kan = require('./kansen')(ctx); ctx.kan = kan;
  const ter = require('./terugval')(ctx); ctx.ter = ter;
  const vzn = require('./voorzieningen')(ctx); ctx.vzn = vzn;
  const alg = require('./algoritmeregister')(ctx); ctx.alg = alg;

  const seintje = () => { try { if (sseToOffice) sseToOffice('sync', { scope: 'weefsel' }); } catch (e) { stil('sse', e); } };
  ctx.zaakSeintje = (z) => {
    seintje();
    if (!melderSeintje) return;
    for (const w of z.waarnemingen) if (w.melder) melderSeintje(w.melder);
  };

  function zorgWeefsel() { geo.zorgGeografie(); obj.zorgObjecten(); rel.zorgRelaties(); }

  // metingen die het geheugen niet haalden; zichtbaar op het bord (zie weefselBoek)
  let boekMis = 0;

  /* Het overzicht en de kaart staan in ./bord.js: die kijken over alle delen
     heen en horen daarom bij geen enkel deel. Ze krijgen het zaaien en de
     gemiste-metingen-teller via de ctx, want die twee wonen hier. */
  ctx.zorgWeefsel = zorgWeefsel;
  ctx.gemisteMetingen = () => boekMis;
  const { beeld, kaart } = require('./bord')(ctx);

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
    weefselZaakKlaar: (zaakId, wie, notitie) => zkn.zaakKlaar(zaakId, wie, notitie),
    /* De klimaatmeters die een Stadsdoos mag insturen, met hun bereik. kern/stad
       kende alleen zijn eigen acht domeinen; zonder deze lijst zou een doos met
       een regenmeter zijn metingen geweigerd zien en zou de klimaatlaag leeg
       blijven -- twee lijsten die hetzelfde bedoelen, en een gat ertussen. */
    weefselKlimaatMeters: () => ({ regen: [0, 120], grondwater: [0, 400], riool: [0, 100], waterstand: [-100, 600], hitte: [-20, 60] }),
    // wat het gezamenlijke rampbeeld van de klimaatkant hoort te zien
    weefselKlimaatBeeld: () => kli.voorRampbeeld(),
    /* De economische naad: vacatures, bedrijven en beroepen wonen elders in het
       huis en blijven daar. server.js hangt de LEZERS hier aan; zonder die
       koppeling telt de kansenlaag nul en zegt hij dat er geen bron is -- niet
       dat er geen werk is. Dat verschil is de hele reden dat het zo staat. */
    weefselKoppelEconomie: (bronnen) => kan.koppel(bronnen || {})
  };
  Object.assign(api, geo.api, obj.api, rel.api, afh.api, tr.api, zkn.api, werk.api,
    con.api, ond.api, ind.api, bes.api, beg.api, insp.api, ene.api, kli.api, sim.api, kan.api, ter.api, vzn.api, alg.api);
  return { weefsel: api };
};
