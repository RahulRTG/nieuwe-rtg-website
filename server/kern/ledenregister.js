/* Kern-module "ledenregister": het complete ledenoverzicht voor het kantoor,
   gesplitst per stad, per land, op alfabet, per geslacht (m/v/x) en per pas
   (gratis, RTG, Lifestyle, Business). Alles op CODENAAM -- de echte naam blijft
   in de kluis (privacy by design); de codenaam-gids is de enige plek waar leden
   herkenbaar zijn.

   Bij elke pas hoort een maandbijdrage: de gratis app is 0, de RTG Pass en de
   Lifestyle Pass staan in de geld-regie (standaard 65 en 20.000 ex btw), de
   Business Pass is prijs op maat. Van elke bijdrage gaat 30% naar de
   RTFoundation: 20% blijft LOKAAL (de omgeving van het lid) en 10% gaat naar de
   RTFoundation zelf. Dit is een RAPPORTAGE, berekend uit ledental x prijs; er
   wordt nooit geclaimd dat een echte betaling is verwerkt.

   Schaalvast: de rijen komen begrensd uit de accountlaag (een venster, geen
   miljoenen); bij een echt grootboek zou dit aggregatie-per-facet worden. */

const { PASSEN: PAS_VOLGORDE, PAS_NAAM, pasVan } = require('./passen');   // een plek, zie ./passen.js
const GESLACHT_NAAM = { v: 'Vrouw', m: 'Man', x: 'X' };

const { maandCentenVoor } = require('./pasprijs');

module.exports = ({ accounts, onboarding, geldPasprijzen, ledenAantal }) => {
  const eur = c => Math.round(c) / 100;

  // de stad komt uit het onboardingprofiel (woonplaats), op sleutel.
  function stadVan(key, profielen) {
    const p = profielen[key];
    const w = p && p.velden && p.velden.woonplaats;
    return w ? String(w).trim() : null;
  }

  function telOp(map, sleutel) {
    const k = sleutel || 'Onbekend'; // leden zonder ingevuld facet apart tellen
    map[k] = (map[k] || 0) + 1;
  }
  function sorteerTelling(map) {
    return Object.entries(map).map(([naam, aantal]) => ({ naam, aantal }))
      .sort((a, b) => b.aantal - a.aantal || a.naam.localeCompare(b.naam, 'nl'));
  }

  /* Het register. filter = { pas, land, stad, geslacht } versmalt de
     alfabetische lijst; de facet-tellingen gaan altijd over alle leden. */
  function register(filter) {
    filter = filter || {};
    const rijen = accounts.ledenRegisterRijen ? accounts.ledenRegisterRijen(20000) : [];
    const profielen = (onboarding && onboarding.store && onboarding.store().profielen) || {};

    const perPas = {}, perLand = {}, perStad = {}, perGeslacht = {};
    /* AANWAS PER BEDRIJF: wie is er lid geworden via de wervingslink van welke
       werkgever. Een bedrijf dat vijftig medewerkers binnenbrengt is voor RTG
       iets anders dan vijftig losse aanmeldingen, en dat was tot nu toe niet te
       zien -- de uitnodiging wist wel wie hem inwisselde, maar dat werd nergens
       bij elkaar opgeteld. Geteld op codenaam, net als de rest van dit
       register: WELK bedrijf hoeveel leden bracht, nooit wie. */
    const perBedrijf = {};
    const bedrijfsnaam = {};
    const passen = {};
    let metCodenaam = 0, viaBedrijf = 0;
    const genormaliseerd = rijen.map(r => {
      const pas = pasVan(r.tier);
      const stad = stadVan(r.key, profielen);
      const g = r.geslacht; // v/m/x of null
      telOp(perPas, pas);
      telOp(perLand, r.land);
      telOp(perStad, stad);
      telOp(perGeslacht, g ? GESLACHT_NAAM[g] : null);
      if (r.via && r.via.code) {
        telOp(perBedrijf, r.via.code);
        bedrijfsnaam[r.via.code] = r.via.naam;
        viaBedrijf++;
      }
      passen[pas] = (passen[pas] || 0) + 1;
      if (r.codename) metCodenaam++;
      return { codenaam: r.codename, pas, pasNaam: PAS_NAAM[pas], land: r.land, stad,
        geslacht: g, geslachtNaam: g ? GESLACHT_NAAM[g] : null,
        via: r.via ? r.via.naam : null, viaCode: r.via ? r.via.code : null };
    });

    // de alfabetische, gefilterde ledenlijst (op codenaam, al gesorteerd door de bron)
    const lijst = genormaliseerd.filter(m =>
      (!filter.pas || m.pas === filter.pas) &&
      (!filter.land || (m.land || '') === filter.land) &&
      (!filter.stad || (m.stad || '') === filter.stad) &&
      (!filter.geslacht || m.geslacht === filter.geslacht)
    ).filter(m => m.codenaam).slice(0, 500);

    // de omzet per pas en de 30%-foundationsplit (20% lokaal, 10% RTF)
    /* Uit ../pasprijs.js, net als het betaalschema en de ledenfacturen. Hier
       stond `|| 0` als terugval, en dat is stiller dan het lijkt: op een verse
       installatie (nog niets ingesteld in de boardroom) toonde de omzetstaat dan
       NUL euro per lid, terwijl het betaalschema wel 65 euro in rekening bracht.
       Twee kopieen, twee antwoorden op dezelfde vraag. */
    const prijslijst = (() => { try { const p = geldPasprijzen && geldPasprijzen(); return (p && p.passen) || null; } catch (e) { return null; } })();
    const maandCenten = { gratis: 0,
      rtg: maandCentenVoor(prijslijst, 'rtg'), lifestyle: maandCentenVoor(prijslijst, 'lifestyle') };
    const omzet = PAS_VOLGORDE.map(pas => {
      const aantal = passen[pas] || 0;
      const opMaat = pas === 'business';
      const centenPP = maandCenten[pas] || 0;
      const maandCentenTot = opMaat ? null : centenPP * aantal;
      return { pas, pasNaam: PAS_NAAM[pas], aantal, opMaat,
        prijsPP: opMaat ? null : eur(centenPP), maandOmzet: opMaat ? null : eur(maandCentenTot) };
    });
    // totaal alleen over de passen met een bekende prijs (Business is op maat)
    const totaalCenten = omzet.reduce((s, o) => s + (o.maandOmzet != null ? Math.round(o.maandOmzet * 100) : 0), 0);
    const split = {
      totaalOmzet: eur(totaalCenten),
      foundation30: eur(Math.round(totaalCenten * 0.30)),
      lokaal20: eur(Math.round(totaalCenten * 0.20)),
      rtf10: eur(Math.round(totaalCenten * 0.10)),
      businessOpMaat: (passen.business || 0)
    };

    return { ok: true,
      totaalGeteld: rijen.length,
      totaalLeden: typeof ledenAantal === 'function' ? ledenAantal() : rijen.length,
      metCodenaam,
      perPas: PAS_VOLGORDE.map(p => ({ naam: PAS_NAAM[p], pas: p, aantal: perPas[p] || 0 })),
      perGeslacht: sorteerTelling(perGeslacht),
      perLand: sorteerTelling(perLand).slice(0, 60),
      perStad: sorteerTelling(perStad).slice(0, 60),
      // aanwas per bedrijf: de naam erbij, want een zaakcode zegt niemand iets
      viaBedrijf,
      perBedrijf: sorteerTelling(perBedrijf).slice(0, 60)
        .map(x => ({ naam: bedrijfsnaam[x.naam] || x.naam, code: x.naam, aantal: x.aantal })),
      omzet, split,
      filter: { pas: filter.pas || null, land: filter.land || null, stad: filter.stad || null, geslacht: filter.geslacht || null },
      lijst };
  }

  return { ledenregister: { register, PAS_VOLGORDE, PAS_NAAM } };
};
