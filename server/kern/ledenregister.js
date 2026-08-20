/* Kern-module "ledenregister": het complete ledenoverzicht voor het kantoor,
   gesplitst per stad, per land, op alfabet, per geslacht (m/v/x) en per pas
   (gratis, RTG, Lifestyle, Business). Alles op CODENAAM -- de echte naam blijft
   in de kluis (privacy by design); de codenaam-gids is de enige plek waar leden
   herkenbaar zijn.

   Bij elke pas hoort een maandbijdrage: de gratis app is 0, de RTG Pass (en
   straks Business Lite) staat in de geld-regie, en de Business Pass en de
   Lifestyle Pass zijn CONTRACTUEEL -- die dragen geen bedrag in de prijslijst,
   dus ze tellen hier niet mee in de omzet. Dat is geen omissie maar het enige
   eerlijke antwoord: RTG kent hun bedrag pas als het contract er is (zie
   PRIJZEN.md, het gat "de contractprijs heeft geen huis"). Van elke bijdrage
   gaat 30% naar de
   RTFoundation: 20% blijft LOKAAL (de omgeving van het lid) en 10% gaat naar de
   RTFoundation zelf. Dit is een RAPPORTAGE, berekend uit ledental x prijs; er
   wordt nooit geclaimd dat een echte betaling is verwerkt.

   Schaalvast: de rijen komen begrensd uit de accountlaag (een venster, geen
   miljoenen); bij een echt grootboek zou dit aggregatie-per-facet worden. */

/* De volgorde en de namen komen uit de ladder (kern/pasladder.js) en staan hier
   niet nog eens: een trede erbij hoort in EEN lijst te landen, niet in twee.
   Alleen beschikbare treden -- een pas die nog niet bestaat, heeft geen leden en
   zou hier als lege regel met nul euro staan. */
const ladder = require('./pasladder');
const PAS_VOLGORDE = ladder.treden().filter(t => t.beschikbaar).map(t => t.id);
const PAS_NAAM = Object.fromEntries(ladder.treden().map(t => [t.id, t.naam]));
const GESLACHT_NAAM = { v: 'Vrouw', m: 'Man', x: 'X' };

const { maandCentenVoor, contractueel } = require('./pasprijs');

module.exports = ({ accounts, onboarding, geldPasprijzen, ledenAantal }) => {
  const eur = c => Math.round(c) / 100;

  // de pas van een lid: een gast/gratis lid heeft tier 'guest'; wij tonen 'gratis'.
  const pasVan = tier => (tier === 'guest' ? 'gratis' : (PAS_VOLGORDE.includes(tier) ? tier : 'rtg'));
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
    const omzet = PAS_VOLGORDE.map(pas => {
      const aantal = passen[pas] || 0;
      /* `opMaat` volgt de ladder en niet de naam 'business'. Sinds Lifestyle
         ook contractueel is, zou een vaste vergelijking op 'business' voor
         Lifestyle NUL euro tonen in plaats van "geen bedrag" -- precies de
         `|| 0`-val die drie regels hoger beschreven staat. */
      const opMaat = contractueel(pas);
      const centenPP = maandCentenVoor(prijslijst, pas) || 0;
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
      /* Het aantal leden op een CONTRACTUELE trede (Business, Lifestyle): hun
         bijdrage staat op hun contract en niet in de prijslijst, dus ze zitten
         niet in `totaalOmzet` hierboven. De oude naam blijft staan omdat het
         kantoorscherm hem zo kent; hij telt nu alleen niet langer alleen
         Business, want sinds de ladder is Lifestyle het net zo goed.

         WAT HIER NOG ONTBREEKT en bewust niet wordt geraden: de afgesproken
         bedragen zelf. Die staan op de aanmelding (kern/aanmeldingen/besluit.js
         -> a.contract) en deze staat leest de accountlaag, niet de
         aanmeldingen. Optellen zou hier dus een schatting worden, en een
         omzetstaat met een geschat getal erin is erger dan een die eerlijk zegt
         dat het er niet in zit. Zie PRIJZEN.md. */
      businessOpMaat: PAS_VOLGORDE.filter(p => contractueel(p)).reduce((n, p) => n + (passen[p] || 0), 0)
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
