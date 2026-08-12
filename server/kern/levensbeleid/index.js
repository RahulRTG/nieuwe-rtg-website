/* Kern-module "levensbeleid": de regels van de mens zelf over zijn eigen
   levenswereld (LEVEN.md par. 3, de tweede laag van het wereldpatroon).

   RTFoundation had vier van de vijf lagen: de levensgraaf (graaf), het
   levens-command-center (cockpit), de mentor-in-aanleg (de gegronde stem) en de
   levenslijn eronder. Beleid ontbrak, en zonder beleid handelt een systeem naar
   eigen inzicht binnen wat de code toestaat.

   HET WERKWOORD VAN DEZE WERELD IS "OPENEN" (LEVEN.md par. 0): hij voert niets
   uit. Dat maakt de vraag "wat mag het systeem" hier bijna leeg -- en juist
   daarom gaat dit beleid over iets anders: wat mag er van MIJ naar buiten, en
   hoe lang.

   NET ALS BIJ RTG SOCIAAL KAN DIT BELEID ALLEEN VERSMALLEN. Er is geen veld dat
   een deling vooraf goedkeurt, geen "deel dit voortaan automatisch met mijn
   ouder", geen vertrouwensniveau. Dat zou besluit 2 uit LEVEN.md par. 2.8 door
   de achterdeur ongedaan maken: van een minderjarige ziet de ander standaard
   niets, en het kind deelt PER STUK. Een beleidsregel die vooraf deelt, is geen
   instelling maar een ander besluit.

   Twee dingen zijn instelbaar, allebei versmallend:

     nooit         stukken die deze mens NOOIT deelt, bovenop de vaste lijst in
                   kern/levensband/delen.js. Een eigen slot naast het huisslot.
     standaardTot  het aantal dagen dat het scherm voorstelt als vervaldatum.
                   De datum blijft verplicht en blijft een keuze; dit maakt de
                   veilige keuze alleen de makkelijke.

   WAT MET OPZET NIET INSTELBAAR IS: het veiligheidssignaal (LEVEN.md par. 2.8,
   inzage/signaal). Een ouder hoort te kunnen zien DAT er iets mis is zonder te
   lezen WAT er staat, en dat is precies de uitzondering die niet aan een
   voorkeur mag hangen -- niet van het kind en niet van de ouder. Waar het botst
   met de rest van deze regels, wint de veiligheid van het kind. */
'use strict';

const TOT_MIN = 1;
const TOT_MAX = 365;
const TOT_STANDAARD = 90;

module.exports = ({ db, save, stukken }) => {
  /* De deelbare stukken komen uit kern/levensband/delen.js en worden hier niet
     overgetikt: twee lijsten van wat deelbaar is, lopen uiteen zodra iemand er
     een toevoegt (LAT.md regel 4). */
  const STUKKEN = Array.isArray(stukken) ? stukken.slice() : [];

  const leeg = () => ({ nooit: [], standaardTot: TOT_STANDAARD });

  function kijk(wie) {
    const alles = db.data.levensbeleid;
    const w = String(wie || '');
    const r = alles && alles[w];
    return r && typeof r === 'object' ? r : leeg();
  }

  /* Opslag pas als er echt iets bewaard wordt; kijken laat geen spoor achter. */
  function pak(wie) {
    if (!db.data.levensbeleid || typeof db.data.levensbeleid !== 'object') db.data.levensbeleid = {};
    const w = String(wie || '');
    if (!w) return null;
    if (!db.data.levensbeleid[w] || typeof db.data.levensbeleid[w] !== 'object') {
      db.data.levensbeleid[w] = leeg();
    }
    const r = db.data.levensbeleid[w];
    if (!Array.isArray(r.nooit)) r.nooit = [];
    if (!Number.isFinite(r.standaardTot)) r.standaardTot = TOT_STANDAARD;
    return r;
  }

  function beleid(wie) {
    const r = kijk(wie);
    return {
      ok: true,
      nooit: r.nooit.slice(),
      standaardTot: r.standaardTot,
      grens: { min: TOT_MIN, max: TOT_MAX, standaard: TOT_STANDAARD },
      stukken: STUKKEN.slice(),
      /* Een FEIT dat het scherm hoort te kunnen tonen, geen instelling: er
         bestaat hier geen stand waarmee iets vooraf gedeeld wordt. Zonder deze
         zin zou iemand hem gaan zoeken. */
      vooraafDelenMogelijk: false
    };
  }

  function zet(wie, invoer) {
    const r = pak(wie);
    if (!r) return { status: 400, error: 'Geen identiteit.' };
    const v = invoer && typeof invoer === 'object' ? invoer : {};
    const was = { nooit: r.nooit.slice(), standaardTot: r.standaardTot };

    if (v.stuk !== undefined) {
      const s = String(v.stuk).toLowerCase();
      if (STUKKEN.length && !STUKKEN.includes(s)) {
        return { status: 400, error: 'Dat stuk bestaat niet.' };
      }
      /* `nooit: true` zet het slot erop, `false` haalt het eraf. Dat tweede is
         geen verruiming van het beleid maar een terugkeer naar de standaard --
         delen blijft daarna nog steeds een handeling per stuk, met een datum. */
      const dicht = v.nooit !== false;
      r.nooit = dicht ? (r.nooit.includes(s) ? r.nooit : r.nooit.concat(s)) : r.nooit.filter(x => x !== s);
    }

    if (v.standaardTot !== undefined) {
      const n = Math.round(Number(v.standaardTot));
      if (!Number.isFinite(n) || n < TOT_MIN || n > TOT_MAX) {
        return { status: 400, error: 'Kies tussen ' + TOT_MIN + ' en ' + TOT_MAX + ' dagen.' };
      }
      r.standaardTot = n;
    }

    const gewijzigd = was.standaardTot !== r.standaardTot ||
      was.nooit.length !== r.nooit.length || was.nooit.some(x => !r.nooit.includes(x));
    if (gewijzigd) save();
    return { status: 200, ok: true, gewijzigd, beleid: beleid(wie) };
  }

  /* Wat kern/levensband/delen.js hieraan vraagt: mag deze mens dit stuk delen?
     Alleen een NEE kan hieruit komen -- het beleid kan een stuk sluiten, nooit
     er een openen dat de vaste lijst verbiedt. */
  const magDelen = (wie, stuk) => !kijk(wie).nooit.includes(String(stuk || '').toLowerCase());

  return { levensbeleid: { beleid, zet, magDelen, TOT_STANDAARD, TOT_MIN, TOT_MAX } };
};
