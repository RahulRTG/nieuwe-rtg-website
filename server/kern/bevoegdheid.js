/* DE BEVOEGDHEID: mag RTG dit, of kan RTG dit alleen maar?

   Dit huis had al vijf assen waarop een functie dicht kan (globaal, per pas, per
   land, per plaats, per persoon, per genre -- middleware/functieschakelaars.js).
   Die gaan allemaal over WIE de gebruiker is en wat de beheerder heeft
   uitgezet. Er ontbrak een zesde, en die gaat over iets anders: wat RTG ZELF
   mag. Software kunnen bouwen en bevoegd zijn om geld te bewegen zijn twee
   dingen, en zolang ze in dezelfde schakelaar zitten kun je de eerste niet
   uitbouwen zonder de tweede te suggereren.

   Vandaar deze laag, met een lijst die per functie zegt WAT ERVOOR NODIG IS:

     software    niets buiten onszelf. Inzicht in uitgaven, budgetten, doelen
                 tonen -- dat is rekenen op gegevens die we al hebben.
     rail        hangt af van WIE hem uitvoert. Loopt hij over de kaart-naad van
                 een partner, dan is die partij bevoegd en levert RTG het
                 scherm; loopt hij over onze eigen rails, dan moeten we het zelf
                 mogen. Betalen, passen en rekeningen zitten hier.
     vergunning  hangt NIET aan een rail. Geld uitlenen uit eigen boek en rente
                 uitkeren over andermans spaargeld mag je of mag je niet -- daar
                 verandert niets aan door wie de overboeking cleart. Dit
                 onderscheid stond er eerst niet in, en toen was krediet met een
                 bankvergunning nog steeds dicht zolang de kaart-naad clearde.

   DE RANGEN. betaalinstelling < elektronischgeldinstelling < bank. Wie een
   hogere rang heeft, mag ook wat een lagere mag; andersom niet. Klantgeld
   aanhouden en krediet uit eigen boek zijn de twee die de hoogste rang vragen.

   WAT DEZE MODULE NIET IS. Hij is geen juridisch oordeel en doet niet alsof.
   Hij leest wat er in de boardroom is VASTGELEGD -- entiteit, vergunningsoort,
   nummer, landen, geldigheidsdatum -- en vergelijkt dat met wat een handeling
   vraagt. Staat er niets, dan is het antwoord nee, met de reden erbij. Dat is de
   enige veilige leegstand: een lege vergunningsvelden-lijst mag nooit "ja"
   betekenen.

   HOE DE RAIL MEETELT, want dat is de kern van "license-ready". Dezelfde
   handeling kan wel of niet mogen, afhankelijk van wie hem uitvoert. Een SEPA
   via de kaart-naad van een partner is een partnerhandeling; dezelfde SEPA over
   de eigen rails is er een waarvoor RTG zelf bevoegd moet zijn. De aanroeper
   geeft daarom de rail mee (die komt uit kern/bankregie: de effectieve
   clearing), en pas die combinatie bepaalt het antwoord.

   Zo kan de hele ervaring nu gebouwd worden zonder te doen alsof er
   bevoegdheden zijn die er niet zijn -- en verandert er bij een echte
   vergunning alleen wat hier is vastgelegd, niet de code eromheen. */
'use strict';

const RANG = { betaalinstelling: 1, elektronischgeldinstelling: 2, bank: 3 };
const SOORTEN = Object.keys(RANG);

/* De lijst. `nodig` zegt wat de handeling vraagt; `rail` zegt bij welke rail die
   eis geldt -- 'eigen' betekent: over onze eigen rails is dit vergunningswerk,
   over de partnerrail is het de partner die bevoegd is. */
const VERMOGENS = {
  // -- software: dit mogen we altijd, het is rekenen op eigen gegevens --
  BANK_SCHERM:        { soort: 'software', naam: 'De bank-app tonen' },
  INZICHTEN:          { soort: 'software', naam: 'Uitgaven-inzichten' },
  BUDGETTEREN:        { soort: 'software', naam: 'Budgetten en vaste lasten' },
  SPAARDOELEN:        { soort: 'software', naam: 'Spaardoelen (een streefbedrag tonen)' },

  // -- partner of eigen, afhankelijk van de rail --
  REKENING_HOUDEN:    { soort: 'rail', naam: 'Betaalrekeningen aanhouden', eigenNodig: 'bank', partnerRail: 'rekeningen' },
  KLANTGELD:          { soort: 'rail', naam: 'Klantgeld aanhouden', eigenNodig: 'bank', partnerRail: 'rekeningen' },
  SEPA_UIT:           { soort: 'rail', naam: 'SEPA-overboeking versturen', eigenNodig: 'betaalinstelling', partnerRail: 'sepa' },
  SEPA_IN:            { soort: 'rail', naam: 'SEPA-overboeking ontvangen', eigenNodig: 'betaalinstelling', partnerRail: 'sepa' },
  INCASSO:            { soort: 'rail', naam: 'Automatische incasso', eigenNodig: 'betaalinstelling', partnerRail: 'sepa' },
  PAS_UITGIFTE:       { soort: 'rail', naam: 'Betaalpassen uitgeven', eigenNodig: 'elektronischgeldinstelling', partnerRail: 'passen' },
  GELD_UITGEVEN:      { soort: 'rail', naam: 'Eigen geld in omloop brengen', eigenNodig: 'elektronischgeldinstelling', partnerRail: null },

  // -- puur vergunning: geen partner doet dit voor ons, en geen rail verandert het --
  KREDIET_EIGEN_BOEK: { soort: 'vergunning', naam: 'Krediet uit eigen boek', nodig: 'bank' },
  RENTE_OP_DEPOSITO:  { soort: 'vergunning', naam: 'Rente over spaargeld uitkeren', nodig: 'bank' }
};

const zinnen = {
  geen: 'RTG mag dit zelf nog niet; hiervoor is een vergunning nodig die nog niet is vastgelegd.',
  rang: 'De vastgelegde vergunning is niet toereikend voor deze handeling.',
  verlopen: 'De vastgelegde vergunning is verlopen.',
  land: 'De vergunning geldt niet voor dit land.',
  rail: 'De partner die dit voor RTG doet, staat op dit moment uit.',
  onbekend: 'Deze handeling staat niet in de bevoegdhedenlijst.'
};

/* `state` levert wat er is VASTGELEGD en wat er NU draait:
     vergunning()  -> null of { soort, nummer, entiteit, landen: [], tot: <ms> }
     partnerRails() -> { sepa: bool, passen: bool, rekeningen: bool }
     clearing()    -> { eigen: bool, kaart: bool }  (kern/bankregie)
   De klok komt binnen zodat een toets een verlopen vergunning kan tonen zonder
   te wachten. */
function maakBevoegdheid({ vergunning, partnerRails, clearing, nu = () => Date.now() }) {

  /* Welke rail voert deze handeling uit? Niet de aanroeper bepaalt dat maar de
     stand van de knop: draait de eigen bank, dan doen we het zelf en zijn we
     zelf aan de beurt om bevoegd te zijn. Draait alleen de kaart-naad, dan is
     het de partner. In de hybride stand telt de EIGEN kant, want dan kan de
     handeling daar landen -- de strengste van de twee wint, anders zou hybride
     een sluiproute om de vergunning zijn. */
  function railVan() {
    const c = clearing() || {};
    if (c.eigen) return 'eigen';
    if (c.kaart) return 'partner';
    return 'geen';
  }

  function vergunningStand() {
    const v = vergunning();
    if (!v || !v.soort || !RANG[v.soort]) return { er: false };
    const verlopen = Number.isFinite(v.tot) && v.tot < nu();
    return { er: true, soort: v.soort, rang: RANG[v.soort], verlopen,
      landen: Array.isArray(v.landen) ? v.landen : [], entiteit: v.entiteit || '', nummer: v.nummer || '', tot: v.tot || null };
  }

  /* Het oordeel. `land` is de landcode van het lid (of van de handeling); laat
     hem weg en de landtoets slaat over -- dat is geen versoepeling maar een
     erkenning dat niet elke handeling aan een land hangt. */
  function mag(id, { land } = {}) {
    const f = VERMOGENS[id];
    if (!f) return { mag: false, reden: 'onbekend', uitleg: zinnen.onbekend, vermogen: id };
    if (f.soort === 'software') return { mag: true, vermogen: id, via: 'software' };
    if (f.soort === 'vergunning') return toetsVergunning(f.nodig, id, land, 'eigen-boek');

    const rail = railVan();
    if (rail === 'partner') {
      if (!f.partnerRail) return { mag: false, reden: 'geen', uitleg: zinnen.geen, vermogen: id, nodig: f.eigenNodig };
      const rails = partnerRails() || {};
      if (rails[f.partnerRail] === false) return { mag: false, reden: 'rail', uitleg: zinnen.rail, vermogen: id, partnerRail: f.partnerRail };
      return { mag: true, vermogen: id, via: 'partner', partnerRail: f.partnerRail };
    }
    if (rail === 'geen') return { mag: false, reden: 'rail', uitleg: zinnen.rail, vermogen: id };

    // eigen rails: nu moet RTG het zelf mogen
    return toetsVergunning(f.eigenNodig, id, land, 'eigen');
  }

  // de vergunningstoets zelf, gedeeld door de eigen rail en het eigen boek
  function toetsVergunning(nodig, id, land, via) {
    const v = vergunningStand();
    if (!v.er) return { mag: false, reden: 'geen', uitleg: zinnen.geen, vermogen: id, nodig };
    if (v.verlopen) return { mag: false, reden: 'verlopen', uitleg: zinnen.verlopen, vermogen: id, tot: v.tot };
    if (v.rang < RANG[nodig]) return { mag: false, reden: 'rang', uitleg: zinnen.rang, vermogen: id, nodig, heeft: v.soort };
    if (land && v.landen.length && !v.landen.includes('*') && !v.landen.includes(land))
      return { mag: false, reden: 'land', uitleg: zinnen.land, vermogen: id, land };
    return { mag: true, vermogen: id, via, vergunning: v.soort };
  }

  /* De matrix voor de boardroom: per handeling wat hij vraagt, wat er ligt en of
     hij nu open staat. Dit is het bord waarop je in een oogopslag ziet waar de
     grens tussen "gebouwd" en "toegestaan" loopt -- en dat die twee niet
     hetzelfde zijn is precies het punt. */
  function matrix({ land } = {}) {
    const v = vergunningStand();
    return {
      status: 200,
      rail: railVan(),
      vergunning: v.er ? { soort: v.soort, nummer: v.nummer, entiteit: v.entiteit, landen: v.landen, tot: v.tot, verlopen: v.verlopen } : null,
      partnerRails: partnerRails() || {},
      regels: Object.keys(VERMOGENS).map(id => {
        const f = VERMOGENS[id];
        const r = mag(id, { land });
        return { id, naam: f.naam, soort: f.soort, nodig: f.eigenNodig || f.nodig || null,
          partnerRail: f.partnerRail || null, mag: r.mag, reden: r.reden || null, via: r.via || null };
      })
    };
  }

  /* Telt het land mee? Alleen als we op eigen rails draaien EN de vergunning
     zich tot bepaalde landen beperkt. De middleware vraagt dit vooraf, zodat hij
     de woonplaats van een lid niet hoeft op te zoeken voor een toets die er toch
     niet aan toekomt -- dezelfde zuinigheid als bij de land-regels van de
     functieschakelaars. */
  function landTelt() {
    const v = vergunningStand();
    return v.er && v.landen.length > 0 && !v.landen.includes('*');
  }

  return { mag, matrix, railVan, vergunningStand, landTelt, VERMOGENS, RANG, SOORTEN };
}

module.exports = { maakBevoegdheid, VERMOGENS, RANG, SOORTEN };
