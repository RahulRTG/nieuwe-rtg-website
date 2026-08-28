/* RTG Stadsweefsel, deel "zaken": EEN zaak- en incidentmotor voor de hele stad.

   Dit lost het gat op dat in de inventarisatie het duidelijkst was: een bewoner
   die een kapotte lantaarn meldde in Mijn Stad kwam bij de veldploeg terecht,
   dezelfde lantaarn gemeld via de gemeente kwam bij een ambtenaar terecht, en
   die twee wisten niets van elkaar. Tien meldingen over dezelfde paal werden
   tien klussen.

   Een WAARNEMING is wat er binnenkomt, uit welk kanaal dan ook: bewonersapp,
   gemeenteloket, telefoon, een ambtenaar, een Stadsdoos, een vervoerder. Een
   ZAAK is wat de stad ervan maakt. De motor beslist welke van de twee het is:

     waarneming -> zelfde categorie? zelfde object of dichtbij? binnen het
     tijdvak? en de zaak nog open? -> dan hoort hij bij de bestaande zaak,
     anders wordt het een nieuwe.

   DE DREMPEL STAAT HIER EN NERGENS ANDERS. Te ruim en twee echte problemen
   worden een zaak (en de tweede wordt nooit opgelost); te streng en de stad
   stuurt drie monteurs naar dezelfde paal. Vandaar: zelfde geregistreerde
   object telt altijd als hetzelfde, en zonder object geldt een straal van
   DUP_M meter binnen DUP_UUR uur.

   Privacy zoals overal in het huis: een waarneming draagt een CODENAAM, nooit
   een naam. De vrije tekst van bewoners gaat niet de AI-dataset in (kern/aidata
   leest deze tak met opzet niet), en een melder ziet alleen zijn eigen
   waarnemingen terug -- niet die van de buurman op hetzelfde adres.

   Dit bestand is de INGANG. Wat er daarna met een zaak gebeurt -- tonen,
   verzetten, sluiten, en de vraag naar de gedeelde oorzaak -- staat in
   ./zaakbeeld.js. Krijgt de gedeelde ctx van kern/stadsweefsel/index.js. */
const { schoon, coordPaar } = require('../util');
const { CATS, PLOEG, OBJECTSOORT, PRIO, UIT_STAD } = require('./categorien');

const STATUS = ['open', 'in-behandeling', 'klaar', 'afgewezen'];
const PRIOS = ['laag', 'normaal', 'hoog', 'urgent'];
/* Hernoemd van `KANALEN`: vier domeinen droegen dat woord met vier betekenissen
   (SEMANTIEK.json, botsing, overlap 0,10). Het woord is nu van de verkoopweg;
   zie COMMERCE.md par. 3. Alleen de naam veranderde, niet de waarden. */
const MELDWEGEN = ['bewonersapp', 'gemeente', 'telefoon', 'ambtenaar', 'stadsdoos', 'politie',
  'vervoerder', 'bedrijf', 'gebouwbeheer', 'automatisch'];
const DUP_M = 75;              // zonder object: zo dichtbij is "hetzelfde"
const DUP_UUR = 72;            // en zo lang telt een open zaak als dezelfde
const MAX_ZAKEN = 20000;
const MAX_OPEN_PER_MELDER = 5; // een bewoner kan niet eindeloos open zetten

module.exports = (ctx) => {
  const { d, save, crypto, nu, geo, obj } = ctx;

  const zaken = () => { if (!Array.isArray(d().weefselZaken)) d().weefselZaken = []; return d().weefselZaken; };
  const zaak = (id) => zaken().find(z => z.id === String(id || '') || z.ref === String(id || '')) || null;
  const open = (z) => z.status === 'open' || z.status === 'in-behandeling';

  /* Waar gaat dit over? Een positie mag ontbreken (iemand belt), dan valt de
     zaak terug op het midden van de opgegeven zone. Wat er NIET gebeurt is een
     positie verzinnen die er niet is: zonder zone en zonder punt is er geen
     plaats, en dat zegt het antwoord dan ook. */
  function plaatsBepaal({ lat, lng, gebied, tekst }) {
    const p = coordPaar(lat, lng);
    if (p) {
      const plek = geo.plaats(p.lat, p.lng);
      if (plek.binnenStad) return { lat: p.lat, lng: p.lng, gebied: plek.gebiedId, zone: plek.zone.id };
      return null;
    }
    /* Geen positie? Dan de vrije tekst. Een gemeentemelding komt binnen met
       "bij de brug op de Marinalaan" en zonder GPS, en die viel eerst buiten de
       stad omdat "Marinalaan" geen gebied-ID is. De straatzoeker hieronder
       vindt hem alsnog: eerst een exacte gebiedsnaam, daarna een straat- of
       zonenaam DIE IN DE TEKST VOORKOMT. Vindt hij niets, dan is er geen
       plaats -- en dan wordt er geen plek gegokt. */
    const g = (String(gebied || '') ? (geo.gebied(gebied) || geo.opNaam(gebied) || geo.uitTekst(gebied)) : null) || geo.uitTekst(tekst);
    if (!g) return null;
    const zone = geo.pad(g.id).find(x => x.niveau === 'zone') || (g.niveau === 'zone' ? g : null);
    return { lat: g.centrum.lat, lng: g.centrum.lng, gebied: g.id, zone: zone ? zone.id : null };
  }

  // de prioriteit: de categorie zet de bodem, een kritiek object en meerdere
  // melders trekken hem op. Nooit omlaag -- drukte is geen reden voor minder.
  function prioriteitVan(z) {
    let i = PRIOS.indexOf(PRIO[z.categorie] || 'normaal');
    const o = z.objectId ? obj.object(z.objectId) : null;
    if (o && ['hoog', 'kritiek'].includes(o.risico)) i = Math.max(i, PRIOS.indexOf('hoog'));
    if (o && o.risico === 'kritiek' && z.waarnemingen.length >= 2) i = PRIOS.length - 1;
    if (z.waarnemingen.length >= 3) i = Math.max(i, PRIOS.indexOf('hoog'));
    return PRIOS[Math.min(i, PRIOS.length - 1)];
  }

  /* De duplicaatvraag. Zelfde categorie, nog open, binnen het tijdvak, en dan:
     zelfde object telt altijd; zonder object beslist de afstand. */
  function zelfdeZaak(kandidaat) {
    const grens = nu() - DUP_UUR * 3600000;
    for (const z of zaken()) {
      if (!open(z) || z.categorie !== kandidaat.categorie || z.at < grens) continue;
      if (kandidaat.objectId && z.objectId) { if (z.objectId === kandidaat.objectId) return z; continue; }
      if (kandidaat.lat == null || z.lat == null) continue;
      const m = geo.afstand({ lat: z.lat, lng: z.lng }, { lat: kandidaat.lat, lng: kandidaat.lng });
      if (m != null && m <= DUP_M) return z;
    }
    return null;
  }

  /* Een waarneming aanbieden. Dit is de ENIGE ingang; elk kanaal gebruikt hem,
     ook de kanalen die hun eigen dossier bijhouden (de gemeente houdt zijn
     behandeling zelf bij en geeft hier zijn kenmerk mee als bronRef). */
  function waarneming(inv) {
    obj.zorgObjecten();
    inv = inv || {};
    const kanaal = MELDWEGEN.includes(inv.kanaal) ? inv.kanaal : 'automatisch';
    const categorie = CATS[inv.categorie] ? inv.categorie
      : (UIT_STAD[inv.soort] || (CATS[inv.soort] ? inv.soort : null));
    if (!categorie) return { status: 400, error: 'Kies waar het over gaat: ' + Object.keys(CATS).join(', ') + '.' };
    const tekst = schoon(inv.tekst, 200);
    if (!tekst || tekst.length < 5) return { status: 400, error: 'Vertel in een paar woorden wat je ziet (minstens 5 tekens).' };
    const plek = plaatsBepaal({ ...inv, tekst });
    if (!plek) return { status: 400, error: 'Waar is het? Geef een gebied of een positie binnen de stad.' };
    const melder = schoon(inv.melder, 60) || null;
    if (melder && zaken().filter(z => open(z) && z.waarnemingen.some(w => w.melder === melder)).length >= MAX_OPEN_PER_MELDER)
      return { status: 429, error: 'Je hebt al ' + MAX_OPEN_PER_MELDER + ' open meldingen; de veldploeg is ermee bezig.' };

    // aan welk DING hangt dit? Expliciet meegegeven wint; anders het
    // dichtstbijzijnde object van de soort die bij deze categorie hoort.
    let objectId = obj.object(inv.objectId) ? String(inv.objectId) : null;
    if (!objectId && OBJECTSOORT[categorie]) {
      const dichtbij = obj.dichtstbij({ lat: plek.lat, lng: plek.lng, soort: OBJECTSOORT[categorie], straal: 90 });
      if (dichtbij) objectId = dichtbij.object.id;
    }
    const w = { id: 'W-' + crypto.randomBytes(3).toString('hex').toUpperCase(), kanaal, melder,
      tekst, bronRef: schoon(inv.bronRef, 40) || null, at: nu() };

    const bestaand = zelfdeZaak({ categorie, objectId, lat: plek.lat, lng: plek.lng });
    if (bestaand) {
      bestaand.waarnemingen.unshift(w);
      if (bestaand.waarnemingen.length > 50) bestaand.waarnemingen.length = 50;
      bestaand.prioriteit = prioriteitVan(bestaand);
      save();
      return { ok: true, duplicaat: true, zaak: publiek(bestaand), waarneming: w };
    }
    if (zaken().length >= MAX_ZAKEN) return { status: 429, error: 'De zakenlijst zit vol.' };
    const z = {
      id: 'Z-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      ref: 'Z-' + new Date(nu()).getFullYear() + '-' + String(zaken().length + 1).padStart(5, '0'),
      categorie, categorieLabel: CATS[categorie], objectId,
      lat: plek.lat, lng: plek.lng, gebied: plek.gebied, zone: plek.zone,
      status: 'open', prioriteit: PRIO[categorie] || 'normaal', ploeg: PLOEG[categorie],
      waarnemingen: [w], werkorders: [], oorzaak: null, notities: [], at: nu(), klaarAt: null, klaarDoor: null
    };
    z.prioriteit = prioriteitVan(z);
    zaken().unshift(z);
    save();
    // de werkorder ontstaat meteen: een zaak zonder werk is een wachtrij
    if (ctx.werkVoorZaak) { try { ctx.werkVoorZaak(z); } catch (e) { ctx.stil('werkorder', e); } }
    if (ctx.zaakSeintje) { try { ctx.zaakSeintje(z); } catch (e) { ctx.stil('seintje', e); } }
    return { ok: true, duplicaat: false, zaak: publiek(z), waarneming: w };
  }

  /* Het bijhouden en tonen van een zaak staat in ./zaakbeeld.js: dit bestand
     is de ingang (waarneming binnen, duplicaat of niet), dat de behandeling. */
  const H = { zaken, zaak, open, schoon, CATS, STATUS, PRIOS };
  const { publiek, voorMelder, oorzaakZoek, zaakZet, zaakKlaar, lijst, vanMelder } = require('./zaakbeeld')(ctx, H);

  return {
    CATS, STATUS, PRIOS, MELDWEGEN, DUP_M, DUP_UUR, waarneming, zaak, zaakZet, zaakKlaar, lijst, vanMelder, publiek, voorMelder, oorzaakZoek, open,
    api: {
      weefselZaken: (f) => {
        const rij = lijst(f);
        return { status: 200, aantal: rij.length, categorieen: CATS,
          zaken: rij.slice(0, 200).map(z => publiek(z, { metMelders: false })),
          oorzaken: Object.keys(CATS).map(c => oorzaakZoek(c)).filter(Boolean) };
      },
      weefselZaak: ({ id }) => {
        const z = zaak(id);
        return z ? { status: 200, zaak: publiek(z) } : { status: 404, error: 'Onbekende zaak.' };
      },
      weefselWaarneming: waarneming,
      weefselZaakZet: zaakZet
    }
  };
};
