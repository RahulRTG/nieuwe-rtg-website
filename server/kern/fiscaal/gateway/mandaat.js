/* DE AANGIFTEGATEWAY (deelmodule): HET MANDAAT -- mag RTG dit namens hem doen.

   Een gateway zonder mandaatregister is een gateway die namens iedereen kan
   indienen zodra iemand de knop vindt. Dus staat dit VOOR de zending en niet
   ernaast: zonder geldig mandaat wordt er niet eens iets opgemaakt. Dat is
   strenger dan alleen het versturen tegenhouden, en met reden -- een
   klaargezette zending met andermans cijfers erin is al een gegevensverwerking
   die niemand heeft gevraagd.

   WIE HET GEEFT. De ondernemer, op naam, en nooit RTG zelf. Dat lijkt
   vanzelfsprekend tot je bedenkt dat het kantoor alle knoppen heeft: als het
   kantoor zijn eigen mandaat kan aanmaken, is het register een formaliteit.
   `verleen` eist daarom een naam van de gever EN dat die iemand van de zaak is;
   wie dat controleert staat buiten deze module (de route), en dat het
   gecontroleerd MOET zijn staat hier.

   HET VERLOOPT, EN WORDT BIJ ELKE VRAAG OPNIEUW GEREKEND. Dezelfde regel als
   bij het vakbewijs (kern/vakbewijs.js): een mandaat dat gisteren gold, geldt
   vandaag niet vanzelf. Er wordt dus nergens een vlaggetje "geldig" bewaard --
   de vraag wordt elke keer gesteld, tegen de datum van dat moment.

   INTREKKEN WERKT METEEN en wist niets. Een ingetrokken mandaat blijft staan
   met de datum en de reden erbij: wat er onder dat mandaat is gebeurd, moet
   navraagbaar blijven. */
'use strict';

const { versmalNamens } = require('../../namens/versmalling');

const isDatum = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

/* De soorten waarvoor een mandaat kan bestaan. Bewust een gesloten lijst: een
   mandaat voor "alles" is geen mandaat. */
const SOORTEN = Object.freeze({
  btw: 'Aangifte omzetbelasting',
  loonheffing: 'Aangifte loonheffingen'
});

const ALLE_SOORTEN = Object.freeze(Object.keys(SOORTEN));

/* ----------------------------------------------------------------------------
   DE VERSMALLING, EN WAAROM ZIJ HIER EEN GRENDEL IS EN GEEN CONTROLE ERBIJ.

   De kop hierboven zegt al jaren: "`verleen` eist een naam van de gever EN dat
   die iemand van de zaak is; wie dat controleert staat buiten deze module (de
   route), en dat het gecontroleerd MOET zijn staat hier." Dat tweede was een
   BELOFTE en geen grendel -- deze module kon een mandaat verlenen aan wie hem
   maar aanriep, en de enige aanroeper die de regel naleeft is er precies één.
   Een tweede aanroeper (een script, een tweede route, een taakloper) had hem
   stilzwijgend kunnen overslaan, en aan het mandaat was dat niet te zien.

   `geverEffectief` IS NU EEN VERPLICHTE INVOER. Wie hem niet meegeeft krijgt
   geen mandaat maar een VERKLAARDE WEIGERING: de doorsnede in
   kern/namens/versmalling.js weigert een bron die niet is vast te stellen, in
   plaats van hem als leeg door te laten. Dat is het verschil tussen "deze gever
   mag niets" en "er heeft niemand gekeken", en die twee mogen nooit hetzelfde
   antwoord opleveren.

   WAT DEZE LAAG BEWUST NIET DOET, en dat is een grens en geen gat. Zij snijdt
   NIET op de vraag of de zaak deze aangifteplicht werkelijk heeft. Dat is
   verleidelijk -- "een zaak zonder personeel hoeft geen loonaangifte te doen"
   klinkt als een goede versmalling -- maar het is onwaar (een ingehouden-
   plichtige zonder loon doet nog steeds een nulaangifte) en RTG heeft er geen
   register voor: er is geen btw-plichtvlag, geen loonplichtvlag en geen
   inhoudingsplichtnummer. Zo'n snede zou een FISCALE POSITIE innemen die dit
   huis niet mag innemen (kern/fiscaal/zekerheid.js: dat is `voorbehouden`).
   Wat er wel is, is de zaakrol -- en dat is een boolean. Grof, maar echt.
   -------------------------------------------------------------------------- */
const GEEN_CONTEXTBEPERKING = 'Er is aan dit moment niets dat één soort afzonderlijk tegenhoudt; ' +
  'de geldigheid in de tijd staat op het mandaat zelf (`van` en `tot`) en wordt door geldt() gerekend.';

function maakMandaat({ db, save, nu }) {
  const tijd = nu || (() => new Date().toISOString());
  const vandaag = () => tijd().slice(0, 10);

  const eigen = require('../../eigencollectie')({ db, domein: 'kern/fiscaal/gateway/mandaat', bezit: { gatewayMandaten: 'lijst' } });
  const bak = () => eigen.bak('gatewayMandaten');
  // lezen zonder scheppen -- zie kijk() in kern/eigencollectie.js
  const lees = () => eigen.kijk('gatewayMandaten');


  function verleen({ code, soort, van, tot, doorNaam, doorRol, kenmerk, geverEffectief }) {
    const zaak = String(code || '').toUpperCase();
    if (!zaak) return { status: 400, error: 'Voor welke zaak geldt dit mandaat?' };
    if (!SOORTEN[soort]) return { status: 400, error: 'Kies een soort: ' + Object.keys(SOORTEN).join(', ') + '.' };
    const naam = String(doorNaam || '').trim();
    if (naam.length < 2) return { status: 400, error: 'Een mandaat wordt op naam verleend, door iemand van de zaak zelf.' };

    /* DE DOORSNEDE, en zij staat VOOR de datumcontroles omdat een mandaat dat
       deze gever niet mag verlenen ook niet op zijn datums hoeft te worden
       nagekeken. Zie de kop bij ALLE_SOORTEN voor waarom `geverEffectief`
       verplicht is en waarom er niet op aangifteplicht wordt gesneden. */
    const snede = versmalNamens({
      gevraagd: [String(soort)],
      geverEffectief,
      beleid: ALLE_SOORTEN,
      context: ALLE_SOORTEN
    });
    if (!snede.ok) {
      /* 503 en met opzet geen 403: er is niets mis met deze gever, er is een
         bron niet aangesloten. Een storing die klinkt als een verbod stuurt de
         verkeerde mens op onderzoek uit (CONTROLPLANE.md). */
      return { status: 503, error: snede.weigering.reden, code: snede.weigering.code,
        hoe: 'Dit is een gebrek aan onze kant: de aanroeper moet opgeven wat deze gever zelf mag ' +
          'verlenen. Er is niets verleend.' };
    }
    if (!snede.effectief.includes(String(soort))) {
      const weg = snede.versmald[0];
      return { status: 403, error: 'Deze gever kan dit mandaat niet verlenen: ' +
        (weg ? weg.reden : 'het valt buiten wat hij zelf mag') + '.',
        bron: weg ? weg.bron : null,
        hoe: 'Een machtiging verleent nooit vermogen, zij versmalt bestaand vermogen. Laat iemand ' +
          'die deze aangifte zelf mag doen het mandaat verlenen.' };
    }
    if (!isDatum(van)) return { status: 400, error: 'Geef een ingangsdatum (JJJJ-MM-DD).' };
    if (tot && !isDatum(tot)) return { status: 400, error: 'Geef een einddatum als JJJJ-MM-DD, of laat hem leeg.' };
    if (tot && tot < van) return { status: 400, error: 'De einddatum ligt voor de ingangsdatum.' };

    const m = { id: 'mnd_' + zaak + '_' + soort + '_' + van,
      code: zaak, soort, soortNaam: SOORTEN[soort],
      van, tot: tot || null,
      doorNaam: naam, doorRol: String(doorRol || '').trim().slice(0, 60) || null,
      kenmerk: String(kenmerk || '').trim().slice(0, 60) || null,
      verleendOp: tijd(), ingetrokkenOp: null, ingetrokkenDoor: null, reden: null };
    /* Twee keer hetzelfde mandaat verlenen is geen fout maar ook geen tweede
       mandaat: dan staan er twee en weet niemand welke gold. */
    const bestaand = bak().find(x => x.id === m.id && !x.ingetrokkenOp);
    if (bestaand) return { ok: true, ongewijzigd: true, mandaat: bestaand };
    bak().unshift(m);
    save();
    return { ok: true, mandaat: m };
  }

  function trekIn(id, door, reden) {
    const m = lees().find(x => x.id === id);
    if (!m) return { status: 404, error: 'Dit mandaat kennen we niet.' };
    if (m.ingetrokkenOp) return { ok: true, ongewijzigd: true, mandaat: m };
    const wie = String(door || '').trim();
    if (wie.length < 2) return { status: 400, error: 'Intrekken gebeurt op naam.' };
    m.ingetrokkenOp = tijd(); m.ingetrokkenDoor = wie;
    m.reden = String(reden || '').trim().slice(0, 300) || null;
    save();
    return { ok: true, mandaat: m };
  }

  /* GELDT ER EEN MANDAAT, op deze dag, voor deze zaak en soort. Geeft altijd
     een reden mee -- ook bij ja, want dan staat er WELK mandaat het was, en dat
     is wat er straks bij de zending gestempeld moet worden. */
  function geldt(code, soort, opDatum) {
    const zaak = String(code || '').toUpperCase();
    const d = isDatum(opDatum) ? String(opDatum).slice(0, 10) : vandaag();
    const alle = lees().filter(m => m.code === zaak && m.soort === soort);
    if (!alle.length) return { ok: false, reden: 'Er is geen mandaat voor ' + zaak + ' (' + soort + ').' };
    const geldig = alle.find(m => !m.ingetrokkenOp && m.van <= d && (!m.tot || m.tot >= d));
    if (geldig) return { ok: true, mandaat: geldig,
      reden: 'Mandaat van ' + geldig.doorNaam + ', geldig vanaf ' + geldig.van + (geldig.tot ? ' tot en met ' + geldig.tot : '') + '.' };
    const ingetrokken = alle.find(m => m.ingetrokkenOp);
    if (ingetrokken) return { ok: false,
      reden: 'Het mandaat is ingetrokken op ' + String(ingetrokken.ingetrokkenOp).slice(0, 10) +
        (ingetrokken.reden ? ' (' + ingetrokken.reden + ')' : '') + '.' };
    const verlopen = alle.find(m => m.tot && m.tot < d);
    if (verlopen) return { ok: false, reden: 'Het mandaat liep tot en met ' + verlopen.tot + '.' };
    const later = alle.find(m => m.van > d);
    if (later) return { ok: false, reden: 'Het mandaat gaat pas in op ' + later.van + '.' };
    return { ok: false, reden: 'Er geldt op ' + d + ' geen mandaat voor ' + zaak + '.' };
  }

  const vanZaak = (code) => lees().filter(m => m.code === String(code || '').toUpperCase());

  return { mandaat: { verleen, trekIn, geldt, vanZaak, SOORTEN } };
}

module.exports = { maakMandaat, SOORTEN };
