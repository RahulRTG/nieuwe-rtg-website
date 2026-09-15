/* ============================================================================
   DE VERSMALLING -- de invariant die onder elke vorm van namens-iemand-handelen
   hoort te liggen. REPRESENTATIE.md par. 5, REP-03.

   DE WET, en hij staat hier als FORMULE en niet als vuistregel:

     effectief = gevraagd ∩ geverEffectief ∩ beleid ∩ context

   Een gedelegeerde bevoegdheid kan nooit groter zijn dan de effectieve
   bevoegdheid van de gever. Niet "hoort niet groter te zijn" -- KAN niet, want
   een doorsnede voegt structureel niets toe. Wie hier ooit een optelsom van
   maakt, heeft privilege-amplification ingebouwd op de enige plek waar dit huis
   hem centraal kan tegenhouden.

   WAAROM DIT GEEN TWEEDE kern/stuur/mandaat.js IS, en dat is de eerste vraag
   die een lezer hoort te stellen. `speelruimte()` daar voert dezelfde wet uit,
   maar op ROUTEPADEN voor de AI: hij leest `beleidVoor(pad, wereld)` live, kent
   NOOIT_AUTONOOM, en weegt budgetten in `centen`, `handelingen` en `berichten`.
   Dit bestand werkt op BEVOEGDHEIDSSLEUTELS (`aanbod.bespreken`,
   `contract.lezen`) die over zeven mechanismen lopen waarvan er zes geen
   routepad kennen. Twee onderwerpen, dezelfde wet; de vorm is met opzet gelijk
   gehouden zodat een lezer die de ene kent de andere meteen leest. Zou deze
   laag paden gaan wegen, dan is hij de tweede allowlist en is de eerste geen
   waarheid meer.

   DRIE DINGEN DIE STRUCTUREEL ZIJN EN GEEN AFSPRAAK:

   1. LEEG IS DICHT. Een ontbrekende verzameling telt als de LEGE verzameling en
      niet als "alles". Dat is de klassieke fout in dit soort lagen: een lege
      regelset die als "geen beperking" wordt gelezen. `kern/stuur/mandaat.js`
      schrijft het met zoveel woorden op en deze laag voert dezelfde regel --
      met één verschil dat hieronder staat.

   2. `null` IS IETS ANDERS DAN `[]`, EN DAT VERSCHIL IS HET HELE PUNT. Een
      lege lijst zegt "ik heb gemeten en er is niets"; `null` of een ontbrekend
      veld zegt "ik weet het niet". Allebei leveren ze een lege uitkomst -- bij
      twijfel gebeurt er niets -- maar de REDEN verschilt, en alleen die tweede
      is een gebrek dat gerepareerd hoort te worden. Een laag die ze samenvoegt,
      kan een kapotte bron nooit onderscheiden van een dichte deur.
      (CONTROLPLANE.md: `ONBEKEND` is met opzet geen synoniem van `WEIGEREN`.)

   3. HIJ VOERT NIETS UIT EN KENT GEEN OPSLAG. Geen db, geen routes, geen
      sessie -- dezelfde vorm als kern/economie/firewall.js,
      kern/rugdekking/soorten.js en kern/vertegenwoordiging/machtiging.js, en om
      dezelfde reden: zo is het BESLUIT te beproeven zonder een server op te
      starten.

   EN HIJ ZEGT ALTIJD WAAROM ER IETS AFVIEL. Een versmalling die het gevraagde
   vermogen laat verdwijnen zonder reden is de gevaarlijkste faalvorm van deze
   laag -- dat staat al in EXECUTIE.md over de resolver, en het geldt hier
   sterker: daar verdween een suggestie, hier verdwijnt een bevoegdheid.
   ========================================================================== */
'use strict';

/* De vier bronnen van de doorsnede. Ze staan hier als lijst omdat de uitslag
   per bron zegt wie er iets tegenhield -- "het viel af" zonder te zeggen waar
   is voor de mens die het leest onbruikbaar. */
const BRONNEN = Object.freeze([
  { sleutel: 'gevraagd', wat: 'wat er in dit verzoek gevraagd wordt',
    reden: 'dit stond niet in het verzoek' },
  { sleutel: 'geverEffectief', wat: 'wat de GEVER op dit moment zelf effectief mag',
    reden: 'de gever mag dit zelf niet (meer); een machtiging kan nooit meer geven dan de gever heeft' },
  { sleutel: 'beleid', wat: 'wat het beleid voor deze soort relatie toestaat',
    reden: 'het beleid staat dit voor deze relatie niet toe' },
  { sleutel: 'context', wat: 'wat er op DIT moment mag (tijd, plaats, stand)',
    reden: 'dit mag nu niet: de context van dit moment laat het niet toe' }
]);

const SLEUTELS = Object.freeze(BRONNEN.map(b => b.sleutel));

/* Een bron omzetten naar een verzameling, of naar `onbekend`. Zie regel 2 in de
   kop: dat onderscheid overleeft tot in de uitslag. */
function bron(waarde) {
  if (waarde == null) return { bekend: false, set: new Set() };
  if (waarde instanceof Set) return { bekend: true, set: waarde };
  if (Array.isArray(waarde)) {
    return { bekend: true, set: new Set(waarde.filter(x => typeof x === 'string' && x)) };
  }
  /* Een bron die geen verzameling IS, is geen lege verzameling maar een fout in
     de aanroep. Hem stil als leeg behandelen zou een typefout in een aanroeper
     laten lezen als "deze gever mag niets". */
  return { bekend: false, set: new Set(), stuk: true };
}

/* DE DOORSNEDE.

   `gevraagd` is de kandidatenlijst; de andere drie kunnen hem alleen kleiner
   maken. De volgorde waarin ze worden nagelopen is die van BRONNEN, zodat de
   reden die een sleutel meekrijgt altijd de EERSTE is die hem tegenhield -- een
   mens die leest waarom hij iets niet mag, heeft aan de eerste horde genoeg. */
function doorsnede(invoer) {
  const i = invoer || {};
  const bronnen = {};
  const onbekend = [], stuk = [];
  for (const b of BRONNEN) {
    const r = bron(i[b.sleutel]);
    bronnen[b.sleutel] = r;
    if (r.stuk) stuk.push(b.sleutel);
    else if (!r.bekend) onbekend.push(b.sleutel);
  }

  const kandidaten = [...bronnen.gevraagd.set];
  const effectief = [], geweigerd = [];
  for (const sleutel of kandidaten) {
    const tegen = BRONNEN.find(b => b.sleutel !== 'gevraagd' && !bronnen[b.sleutel].set.has(sleutel));
    if (tegen) geweigerd.push({ sleutel, bron: tegen.sleutel, reden: tegen.reden });
    else effectief.push(sleutel);
  }
  effectief.sort();
  geweigerd.sort((a, b) => a.sleutel.localeCompare(b.sleutel));

  return {
    effectief,
    geweigerd,
    /* Welke bronnen niets wisten te zeggen. Dit is GEEN weigering en het hoort
       apart te staan: een doorsnede die leeg is doordat een bron ontbreekt, is
       iets anders dan een doorsnede die leeg is doordat er niets mag. */
    onbekendeBronnen: onbekend,
    stukkeBronnen: stuk,
    aantalGevraagd: kandidaten.length,
    grens: 'Dit is een DOORSNEDE en geen toekenning: er kan niets in staan dat niet in alle vier de ' +
      'bronnen zat. Een machtiging verleent nooit vermogen, zij versmalt bestaand vermogen.',
    let: onbekend.length
      ? 'Let op: ' + onbekend.join(' en ') + ' ' + (onbekend.length === 1 ? 'is' : 'zijn') +
        ' niet opgegeven en tellen daarom als LEEG. Dat is geen oordeel over deze gever -- het is een ' +
        'gebrek in de aanroep, en het hoort gerepareerd te worden in plaats van geaccepteerd.'
      : null
  };
}

/* Mag deze ENE sleutel? Zelfde wet, andere vraag, en hij geeft altijd een
   reden -- ook bij ja, want "waarom mag dit wel" is bij een machtiging een even
   redelijke vraag als "waarom niet". */
function mag(sleutel, invoer) {
  const s = String(sleutel || '');
  const r = doorsnede(Object.assign({}, invoer, { gevraagd: [s] }));
  if (r.effectief.includes(s)) {
    return { mag: true, reden: 'deze bevoegdheid zit in alle vier de bronnen: het verzoek, wat de gever ' +
      'zelf mag, het beleid en de context van dit moment' };
  }
  const weg = r.geweigerd[0];
  return { mag: false, bron: weg ? weg.bron : 'gevraagd',
    reden: weg ? weg.reden : 'deze bevoegdheid stond niet in het verzoek',
    onbekendeBronnen: r.onbekendeBronnen };
}

/* DE WET ALS CONTROLEERBARE BEWERING. Hij staat hier en niet alleen in een
   toets, zodat een aanroeper die twijfelt hem op zijn eigen uitkomst kan
   loslaten -- en zodat een toets hem niet hoeft na te bouwen (en er dus niet
   naast kan gaan zitten).

   Geeft `null` als de uitkomst klopt, en anders de overtreding. */
function overtreding(uitkomst, invoer) {
  const u = uitkomst || {}, i = invoer || {};
  const eff = new Set(Array.isArray(u.effectief) ? u.effectief : []);
  for (const b of BRONNEN) {
    const r = bron(i[b.sleutel]);
    for (const s of eff) {
      if (!r.set.has(s)) {
        return { sleutel: s, bron: b.sleutel,
          reden: 'de uitkomst bevat `' + s + '` terwijl die niet in `' + b.sleutel + '` zat. Dat is ' +
            'privilege-amplification: de doorsnede heeft iets TOEGEVOEGD.' };
      }
    }
  }
  return null;
}

/* HET BESLUIT staat in ./versmalling-besluit.js en wordt hier doorgegeven, niet
   nagebouwd. Die naad is dezelfde die in de kop hierboven al stond: dit bestand
   MEET (de doorsnede plus de staat van zijn vier bronnen) en oordeelt niet;
   `versmalNamens` oordeelt. Een aanroeper hoeft dat verschil niet te kennen en
   haalt allebei hier op. */
const { maakBesluit } = require('./versmalling-besluit');
const { versmalNamens } = maakBesluit({ doorsnede });

module.exports = { doorsnede, versmalNamens, mag, overtreding, BRONNEN, SLEUTELS };
