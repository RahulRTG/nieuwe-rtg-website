/* Mobility OS (deelmodule): de CDT-uitvoer.

   DE BELANGRIJKSTE REGEL IN DIT BESTAND IS WAT ER NIET IN STAAT. Er is geen
   functie die gegevens naar de Inspectie Leefomgeving en Transport stuurt, en
   dat is geen omissie maar de werkelijkheid: aanleveren aan de Centrale
   Database Taxivervoer loopt via een ICT-dienstverlener die aan de eisen van de
   ILT voldoet, en RTG is dat niet. Een knop "verzenden naar de CDT" zou hier
   een leugen zijn met een groen vinkje eronder -- precies het soort belofte dat
   LAT.md regel 6 verbiedt, en bij een wettelijke verplichting is dat gevaarlijk
   in plaats van slordig: een ondernemer die denkt dat hij heeft aangeleverd,
   controleert het niet meer.

   WAT ER WEL IS:
   1. Een volledige, herhaalbare EXPORT van de diensten en de ritten over een
      periode -- de gegevens die de CDT wil hebben, in onze eigen vorm.
   2. Een VINGERAFDRUK over die export (sha256 over een vaste ordening), zodat
      later na te gaan is of het bestand dat is aangeleverd hetzelfde is als
      wat hier stond. Bij een inspectie is dat het verschil tussen een verhaal
      en een bewijs.
   3. Een OVERDRACHT-journaal: wie heeft welke export wanneer aan welke
      dienstverlener gegeven. Dat legt vast wat er echt is gebeurd -- een
      overdracht -- en niet wat wij hopen dat er daarna gebeurde.

   De stand van de koppeling wordt daarom altijd meegestuurd, in gewone taal, en
   staat standaard op "niet gekoppeld". */

const KOPPELING_UIT = {
  gekoppeld: false,
  uitleg: 'RTG levert niet rechtstreeks aan de CDT. Aanleveren loopt via een ICT-dienstverlener ' +
    'die aan de eisen van de ILT voldoet; deze export is wat u aan die dienstverlener geeft.',
  vanaf: '2028-01-01',
  wetUitleg: 'Vanaf 1 januari 2028 is registratie via de Centrale Database Taxivervoer verplicht; ' +
    'tot die tijd blijft de boordcomputer taxi toegestaan.'
};

module.exports = (ctx) => {
  const { db, save, crypto, id, schoon, nu, findSupplier, logActivity,
    dienstenVan, dienstBeeld, rittenVan, opdrachtMet, opslag } = ctx;

  function ensureExport() {
    opslag.bak('mobCdtExports');
    opslag.bak('mobCdtDienstverlener');
  }

  /* De ICT-dienstverlener die deze onderneming gebruikt. Wij controleren zijn
     ILT-registratie NIET -- dat kunnen wij niet, en doen alsof zou erger zijn
     dan het open laten. Wat hier staat is wat de ondernemer heeft ingevuld, en
     het antwoord zegt dat er ook bij. */
  function dienstverlenerZet(supplier, actor, body = {}) {
    ensureExport();
    const naam = schoon(body.naam, 80);
    if (body.weg) {
      delete opslag.bak('mobCdtDienstverlener')[supplier.code];
      save();
      return { ok: true, dienstverlener: null };
    }
    if (!naam) return { status: 400, error: 'Noteer de naam van de ICT-dienstverlener.' };
    const d = { naam, registratie: schoon(body.registratie, 60) || null,
      vastgelegdDoor: schoon(actor, 60) || 'onderneming', vastgelegd: nu() };
    opslag.bak('mobCdtDienstverlener')[supplier.code] = d;
    save();
    return { ok: true, dienstverlener: d, let: 'RTG controleert deze registratie niet; u blijft zelf verantwoordelijk voor de aanlevering.' };
  }

  const dienstverlenerVan = code => {
    ensureExport();
    return opslag.bak('mobCdtDienstverlener')[code] || null;
  };

  /* Een vaste ordening voor de vingerafdruk: sleutels gesorteerd, zodat
     dezelfde gegevens altijd dezelfde hash geven. Zonder dit hangt de
     vingerafdruk af van de volgorde waarin JavaScript toevallig de velden
     opschreef, en dan bewijst hij niets. */
  function vast(x) {
    if (Array.isArray(x)) return x.map(vast);
    if (x && typeof x === 'object')
      return Object.keys(x).sort().reduce((o, k) => { o[k] = vast(x[k]); return o; }, {});
    return x;
  }
  const vingerafdruk = obj => crypto.createHash('sha256').update(JSON.stringify(vast(obj))).digest('hex');

  /* De export. Een rit gaat mee met de velden die de registratie identificeren:
     wanneer, welk voertuig, welke chauffeurskaart, hoeveel kilometer. GEEN
     bestemmingsnaam, geen codenaam van de reiziger, geen bedrag -- dat hoort
     niet bij een arbeidstijdenregistratie, en wat je niet uitlevert kan ook
     niet uitlekken. */
  function cdtExport(supplier, body = {}) {
    ensureExport();
    const zaak = findSupplier(supplier.code);
    const van = schoon(body.van, 10) || nu().slice(0, 10);
    const tot = schoon(body.tot, 10) || van;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(van) || !/^\d{4}-\d{2}-\d{2}$/.test(tot))
      return { status: 400, error: 'Geef een periode op als jjjj-mm-dd.' };
    if (tot < van) return { status: 400, error: 'De einddatum ligt voor de begindatum.' };

    const diensten = dienstenVan(supplier.code)
      .filter(d => d.start.slice(0, 10) >= van && d.start.slice(0, 10) <= tot)
      .map(d => {
        const b = dienstBeeld(d);
        return {
          dienstId: d.id, chauffeurskaart: d.chauffeurskaart, voertuig: d.voertuig,
          start: d.start, eind: d.eind,
          arbeidMinuten: b.arbeidMin, rijMinuten: b.rijMin, pauzeMinuten: b.pauzeMin,
          blokken: b.blokken.map(x => ({ soort: x.soort, van: x.van, tot: x.tot, minuten: x.minuten })),
          signalen: b.signalen.map(s => s.id),
          ritten: rittenVan(d).map(o => ({
            ref: o.ref, aangevraagd: o.gemaakt, voertuig: o.voertuig || null,
            kilometers: o.km, reizigers: o.reizigers, status: o.status,
            begonnen: o.rijdtAt || o.ingestaptAt || null, geeindigd: o.voltooidAt || null
          }))
        };
      });

    const inhoud = { onderneming: { code: supplier.code, naam: zaak ? zaak.name : supplier.code },
      periode: { van, tot }, diensten,
      aantallen: { diensten: diensten.length, ritten: diensten.reduce((n, d) => n + d.ritten.length, 0) } };

    const e = { id: id('ex'), vervoerder: supplier.code, van, tot, gemaakt: nu(),
      hash: vingerafdruk(inhoud), aantallen: inhoud.aantallen, overdrachten: [] };
    opslag.bak('mobCdtExports').push(e);
    save();
    return { ok: true, export: exportBeeld(e), inhoud, koppeling: koppelingStand(supplier.code) };
  }

  const koppelingStand = code => Object.assign({}, KOPPELING_UIT, { dienstverlener: dienstverlenerVan(code) });

  const exportBeeld = e => ({ id: e.id, van: e.van, tot: e.tot, gemaakt: e.gemaakt,
    hash: e.hash, aantallen: e.aantallen, overdrachten: e.overdrachten || [] });

  /* De overdracht vastleggen. Dit zegt: dit bestand is op dit moment door deze
     persoon aan deze dienstverlener gegeven. Het zegt NIET dat de CDT het heeft
     ontvangen of geaccepteerd -- dat weten wij niet, en het antwoord zegt dat
     er met zoveel woorden bij. */
  function cdtOverdracht(supplier, actor, body = {}) {
    ensureExport();
    const e = opslag.bak('mobCdtExports').find(x => x.id === schoon(body.id, 40) && x.vervoerder === supplier.code);
    if (!e) return { status: 404, error: 'Export niet gevonden.' };
    const dv = dienstverlenerVan(supplier.code);
    const naam = schoon(body.dienstverlener, 80) || (dv && dv.naam);
    if (!naam) return { status: 409, error: 'Leg eerst vast welke ICT-dienstverlener uw aanlevering doet.' };
    const o = { at: nu(), door: schoon(actor, 60) || 'onderneming', dienstverlener: naam,
      hash: e.hash, notitie: schoon(body.notitie, 200) || null };
    e.overdrachten = (e.overdrachten || []).concat([o]);
    save();
    logActivity(supplier.code, actor, 'gaf CDT-export ' + e.id + ' aan ' + naam);
    return { ok: true, export: exportBeeld(e), overdracht: o,
      let: 'Vastgelegd is dat u dit bestand heeft overgedragen. Of de CDT het heeft aanvaard, ' +
        'blijkt uit de bevestiging van uw dienstverlener; RTG kan dat niet zien.' };
  }

  const cdtExportLijst = supplier => {
    ensureExport();
    return { ok: true, exports: opslag.bak('mobCdtExports').filter(e => e.vervoerder === supplier.code)
      .slice(-30).reverse().map(exportBeeld), koppeling: koppelingStand(supplier.code) };
  };

  return { ensureExport, cdtExport, cdtExportLijst, cdtOverdracht, dienstverlenerZet,
    dienstverlenerVan, koppelingStand, CDT_KOPPELING: KOPPELING_UIT };
};
