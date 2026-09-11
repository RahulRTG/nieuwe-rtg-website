/* ============================================================================
   DE MACHTIGING -- wat een MENS namens een ANDER MENS mag.

   DIT IS DE VIERDE VORM VAN VERTEGENWOORDIGING IN DIT HUIS, en de drie die er
   al waren dekken hem geen van alle:

     kern/command/bijstand.js   RTG namens een klant
     kern/service/machtiging.js een medewerker in de zaak van een lid
     kern/stuur/mandaat.js      de AI namens een mens

   De grammatica komt WEL uit die derde, en met opzet letterlijk -- een tweede
   grammatica naast de eerste is precies de fout die SEMANTIEK.json meet:

     1 EEN MACHTIGING VERLEENT NOOIT VERMOGEN. Zij kan bestaand vermogen van de
       cliënt alleen VERSMALLEN. Daarom is `versmalMachtiging()` een DOORSNEDE en geen
       optelsom: een vertegenwoordiger kan structureel nooit meer dan de mens
       voor wie hij staat. Zou een machtiging iets kunnen toevoegen, dan was zij
       een tweede rechtenlijst -- en dan is de eerste geen waarheid meer.
     2 LEEG IS DICHT. Geen machtiging betekent dat er niets namens u gebeurt,
       niet dat er niets beperkt is. Een machtiging zonder bevoegdheden bestaat
       niet; `vorm()` weigert hem.
     3 VERVAL IS EEN BEREKENDE TOESTAND EN GEEN OPRUIMACTIE (SERVICE.md). Een
       machtiging die niemand intrekt, houdt vanzelf op. Er is dus geen veegtimer
       die hem "verlopen" zet: `stand()` rekent hem bij elke vraag opnieuw uit,
       en een stilstaande server verruimt daarmee nooit iemands bevoegdheid.

   DRIE DINGEN DIE HIER IN CODE STAAN EN NIET IN EEN AFSPRAAK:

   EEN MACHTIGING ZONDER EINDDATUM BESTAAT NIET. kern/machtiging.js zegt het al
   voor de incasso -- "een machtiging zonder maximum is een blanco cheque" -- en
   in een loopbaan is de looptijd precies waar het misgaat: wie op zijn
   zeventiende tekent, is op zijn vijfentwintigste nog steeds getekend. `tot` is
   daarom verplicht en begrensd, en dat is geen instelling.

   GEEN DELEGATIE. Er is geen bevoegdheid waarmee een vertegenwoordiger iemand
   anders machtigt; hij staat niet in de gesloten lijst, dus hij is niet te
   vragen. Dat is structureel en geen controle die iemand kan vergeten.

   EN DIT BESTAND VOERT NIETS UIT. Geen db, geen routes, geen sessie -- alleen
   de regels. Zo is het BESLUIT te beproeven zonder een server op te starten,
   dezelfde reden als bij kern/economie/firewall.js. */
'use strict';

const { bestaat, HOEDANIGHEDEN, BEVOEGDHEDEN } = require('./bevoegdheden');

/* Vijf jaar. Niet omdat vier fout is, maar omdat een looptijd een GRENS moet
   hebben die niet per geval onderhandelbaar is: wie hem per machtiging mag
   zetten, zet hem op vijftig. */
const MAX_MAANDEN = 60;
const STANDEN = Object.freeze(['voorgesteld', 'actief', 'verlopen', 'ingetrokken']);

const tijd = (v) => { const t = Date.parse(v); return Number.isFinite(t) ? t : null; };

/* DE STAND WORDT GEREKEND EN NOOIT GELEZEN. Volgorde is gedrag: ingetrokken
   gaat vóór verlopen (wie intrekt, wil dat het NU stopt en niet "vanzelf"), en
   verlopen gaat vóór actief. */
function stand(m, nu) {
  if (!m || typeof m !== 'object') return 'ingetrokken';
  if (m.ingetrokken) return 'ingetrokken';
  const t = nu == null ? Date.now() : nu;
  const eind = tijd(m.tot);
  if (eind == null || eind <= t) return 'verlopen';
  if (!m.aanvaard) return 'voorgesteld';
  /* DE TWEEDE HANDTEKENING VAN HET JEUGDBESTUUR. Draagt de machtiging
     `voogdNodig`, dan is de handtekening van de jongere ALLEEN niet genoeg --
     en die van de voogd alleen ook niet. Beide, of hij blijft voorgesteld.

     Dit staat hier en niet in acties.js omdat het een REGEL is en geen
     handeling: `stand()` wordt bij elke vraag opnieuw gerekend, dus er is geen
     moment waarop een half getekende machtiging per ongeluk actief heet. En
     `voogdNodig` is een veld OP de machtiging en geen lezing van het dossier,
     zodat dit bestand db-vrij blijft (zie de kop). */
  if (m.voogdNodig && !m.voogdAanvaard) return 'voorgesteld';
  const start = tijd(m.van);
  if (start != null && start > t) return 'voorgesteld';
  return 'actief';
}

/* VORM: maakt van een voorstel een machtiging, of zegt waarom niet. Hij weigert
   liever dan dat hij repareert -- een stilletjes bijgeschaafde bevoegdheid is
   precies wat de cliënt niet kan zien. */
function vorm(data, opties) {
  const d = data || {}, o = opties || {};
  const nu = o.nu == null ? Date.now() : o.nu;

  const hoedanigheid = String(d.hoedanigheid || '').trim();
  if (!HOEDANIGHEDEN.includes(hoedanigheid)) {
    return { error: 'Kies in welke hoedanigheid deze persoon naast u staat: ' + HOEDANIGHEDEN.join(', ') + '.' };
  }

  const gevraagd = Array.isArray(d.bevoegdheden) ? d.bevoegdheden.map(x => String(x || '')) : [];
  const onbekend = gevraagd.filter(k => !bestaat(k));
  if (onbekend.length) {
    return { error: 'Deze bevoegdheid bestaat niet: ' + onbekend.join(', ') + '. De lijst is gesloten, ' +
      'zodat u kunt weten wat u weggeeft.' };
  }
  const bevoegdheden = [...new Set(gevraagd)].sort();
  if (!bevoegdheden.length) {
    return { error: 'Een machtiging zonder bevoegdheden bestaat niet: leeg is hier dicht en niet open.' };
  }

  const eind = tijd(d.tot);
  if (eind == null) {
    return { error: 'Een machtiging heeft een einddatum. Zonder einde is het een blanco cheque, ' +
      'en juist de looptijd is waar een loopbaan op stukloopt.' };
  }
  if (eind <= nu) return { error: 'De einddatum ligt in het verleden.' };
  if (eind > nu + MAX_MAANDEN * 31 * 86400000) {
    return { error: 'Een machtiging loopt hier maximaal ' + MAX_MAANDEN + ' maanden. Verlengen kan altijd; ' +
      'dat is een besluit dat u opnieuw neemt in plaats van een dat u ooit nam.' };
  }

  /* HET PLAFOND IS EEN GRENS EN GEEN RECHT. Het zegt tot waar er nog namens u
     gesproken mag worden, niet dat er iets mag. Zonder plafond mag er niet
     onderhandeld worden over een bedrag -- dat is strenger dan een plafond van
     nul, want nul leest als "gratis mag wel". */
  let plafondCenten = null;
  if (d.plafondCenten != null && d.plafondCenten !== '') {
    const p = Math.round(Number(d.plafondCenten));
    if (!Number.isFinite(p) || p < 0) return { error: 'Het plafond is geen bedrag.' };
    plafondCenten = p;
  }

  return {
    machtiging: {
      hoedanigheid, bevoegdheden, plafondCenten,
      van: d.van && tijd(d.van) ? new Date(tijd(d.van)).toISOString() : new Date(nu).toISOString(),
      tot: new Date(eind).toISOString(),
      aanvaard: null, ingetrokken: null,
      /* Vastgelegd bij het VORMEN en niet bij het aanvaarden: of er een voogd
         bij hoort, is een eigenschap van het moment waarop deze machtiging
         ontstond. Wordt de jongere later achttien, dan blijft deze machtiging
         er een waar twee mensen voor tekenden -- dat is geschiedenis en geen
         toestand die stilletjes mag wegvallen. */
      voogdNodig: !!o.voogdNodig, voogdAanvaard: null
    }
  };
}

/* DE DOORSNEDE. `magClient` is wat de cliënt ZELF heeft; wat daar niet in zit,
   kan een machtiging niet geven. Structureel, niet als vuistregel.

   HIJ HEET `versmalMachtiging` EN NIET `versmal`. Een naam van twee
   lettergrepen die in drie kernmodules staat, zegt niets meer over WAT hij
   versmalt -- en de keuring telt precies dat (`keuringDubbeling`). Zelfde
   remedie als `mandaatGeldig` in kern/stuur/mandaat.js. */
function versmalMachtiging(magClient, machtiging) {
  const van = Array.isArray(magClient) ? magClient.filter(bestaat) : [];
  const gevraagd = (machtiging && Array.isArray(machtiging.bevoegdheden) ? machtiging.bevoegdheden : []).filter(bestaat);
  const binnen = gevraagd.filter(k => van.includes(k));
  const buiten = gevraagd.filter(k => !van.includes(k));
  return {
    bevoegdheden: binnen, buiten,
    reden: buiten.length
      ? buiten.length + ' van de ' + gevraagd.length + ' gevraagde bevoegdheden vallen af: die heeft u zelf niet. ' +
        'Een machtiging versmalt bestaand vermogen en voegt er nooit iets aan toe.'
      : 'Alle gevraagde bevoegdheden vallen binnen wat u zelf heeft.'
  };
}

/* MAG DEZE ENE HANDELING NU? Geeft altijd een reden, en bij twijfel nee. */
function magHandelen(machtiging, bevoegdheid, ctx) {
  const c = ctx || {};
  const k = String(bevoegdheid || '');
  if (!bestaat(k)) return { mag: false, reden: 'Deze bevoegdheid bestaat niet.' };
  const st = stand(machtiging, c.nu);
  if (st !== 'actief') {
    return { mag: false, stand: st, reden: st === 'voorgesteld'
      ? 'Deze machtiging is nog niet aanvaard; aanvaarden doet de cliënt zelf.'
      : 'Deze machtiging is ' + st + '.' };
  }
  if (!machtiging.bevoegdheden.includes(k)) {
    return { mag: false, stand: st, reden: 'Dit staat niet in de machtiging. Wat er niet in staat, mag niet.' };
  }
  const def = BEVOEGDHEDEN[k];
  if (c.bedragCenten != null) {
    const bedrag = Math.round(Number(c.bedragCenten) || 0);
    if (machtiging.plafondCenten == null) {
      return { mag: false, stand: st, reden: 'Deze machtiging noemt geen plafond, dus er wordt namens u ' +
        'niet over bedragen gesproken.' };
    }
    if (bedrag > machtiging.plafondCenten) {
      return { mag: false, stand: st, reden: 'Dit gaat over het plafond van deze machtiging; daarboven ' +
        'beslist u zelf.' };
    }
  }
  return { mag: true, stand: st, klaarzetten: !!def.klaarzetten,
    reden: def.klaarzetten
      ? 'Binnen de machtiging, en deze bevoegdheid mag alleen KLAARZETTEN -- bevestigen doet de cliënt.'
      : 'Binnen de machtiging.' };
}

module.exports = { vorm, stand, versmalMachtiging, magHandelen, STANDEN, MAX_MAANDEN };
