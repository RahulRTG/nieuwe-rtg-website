/* DE MACHTIGING: wat er getekend is, en waarom dit huis er niets mee int.

   DIT BESTAAT OMDAT DE REGELS AL EEN KEER GOED ZIJN OPGESCHREVEN. server/school/
   machtiging.js legt vast wie heeft getekend voor automatische incasso, en de
   houding daar is precies goed: er wordt NIETS geind, het volledige
   rekeningnummer staat er niet in, een machtiging zonder maximum is een blanco
   cheque, en intrekken kan altijd en per direct. Toen de periodieke gift om
   een SEPA-machtiging vroeg, was de verleiding om dat na te bouwen. Twee
   registers met dezelfde betekenis onder dezelfde naam is exact wat
   SEMANTIEK.json duur noemt (LAT.md regel 4).

   WAT HIER STAAT ZIJN DE REGELS EN NIET DE OPSLAG. Waar een machtiging woont
   verschilt legitiem -- bij een school hangt hij aan een leerling, bij een gift
   aan de gever -- maar WAT een geldige machtiging is, is een ding. Dit bestand
   kent dus geen database, geen routes en geen sessie.

   DE HARDE KERN, EN GEEN ERVAN IS ONDERHANDELBAAR:

   1. ER WORDT NIETS GEIND. Niet "nog niet": dit huis heeft geen incasso-rail.
      server/betaal.js kent alleen maakUitbetaling (geld eruit) en maakBetaling
      (een kaartbetaling die de betaler zelf start). Een SEPA-incasso trekt geld
      van de rekening van een ander en vraagt een contract met een bank plus een
      incassant-ID. Software kan dat niet vervangen, en doen alsof breekt de
      huisregel: nooit claimen dat een boeking is verwerkt. Elk antwoord uit
      deze laag draagt daarom `geindNu: false` met de reden erbij.

   2. GEEN MAXIMUM, GEEN MACHTIGING. Een open volmacht is geen toestemming maar
      een blanco cheque.

   3. HET VOLLEDIGE REKENINGNUMMER WORDT NIET BEWAARD. Alleen de laatste vier
      tekens. We innen niet, dus hebben we de rest niet nodig -- en een IBAN
      naast een codenaam voert die codenaam terug naar een mens (CLAUDE.md).
      Dataminimalisatie is hier een ontwerp en geen instelling.

   4. EEN TWEEDE MACHTIGING VERVANGT DE EERSTE. Twee geldige naast elkaar is
      precies hoe iemand twee keer wordt afgeschreven.

   5. INTREKKEN KAN ALTIJD, zonder reden en per direct, door beide kanten. Een
      machtiging die je alleen telefonisch kunt stoppen is een val. */
'use strict';

/* Hoe vaak er geincasseerd zou worden. 'per schooljaar' hoort bij school en
   'jaarlijks' bij de periodieke gift; ze staan in EEN lijst omdat een
   frequentie die de ene helft kent en de andere niet, een frequentie is die
   ergens stil door de controle glipt. */
const FREQUENTIES = ['eenmalig', 'maandelijks', 'per kwartaal', 'per periode', 'jaarlijks', 'per schooljaar'];

const KANALEN = ['papier', 'app', 'balie', 'brief'];

/* De storneringstermijn van een Europese incasso voor een consument: acht
   weken zonder opgaaf van reden. Dat getal hoort op het scherm te staan en niet
   in een voetnoot -- het is de belangrijkste bescherming die de betaler heeft.
   Bij een onterechte incasso (geen geldige machtiging) is het dertien maanden.
   RTG stelt die termijnen niet vast en rekt ze niet op; ze staan hier zodat er
   maar een plek is waar ze staan. */
const STORNO_WEKEN = 8;
const STORNO_ONTERECHT_MAANDEN = 13;

/* De aankondiging vooraf. Een incasso komt nooit als verrassing: de betaler
   hoort van tevoren te weten welk bedrag op welke dag van zijn rekening gaat.
   Veertien dagen is de standaard; korter mag alleen als het is afgesproken, en
   dat is een afspraak tussen mensen en geen instelling in software. */
const AANKONDIGING_DAGEN = 14;

/* Wat elk antwoord uit deze laag meedraagt. Geen vlag maar een zin, want
   `geindNu: false` zonder uitleg leest als een fout in plaats van als een
   grens. */
function nietGeind(huis) {
  return { geindNu: false,
    uitleg: (huis || 'RTG') + ' int niets. Dit register legt vast wat er is getekend; ' +
      'het afschrijven vraagt een contract met een bank of betaaldienst, en dat kan software niet vervangen.' };
}

/* Wat een lezer van een machtiging mag zien. Het volledige rekeningnummer staat
   er niet in omdat het er niet IS -- zie regel 3. */
function publiek(m) {
  if (!m) return null;
  return { id: m.id, kenmerk: m.kenmerk, houder: m.houder, ibanEinde: m.ibanEinde,
    bank: m.bank || null, maxCenten: m.maxCenten, frequentie: m.frequentie,
    getekendOp: m.getekendOp, kanaal: m.kanaal, actief: !!m.actief,
    ingetrokkenAt: m.ingetrokkenAt || null, ingetrokkenDoor: m.ingetrokkenDoor || null };
}

/* De keuring van wat iemand intikt. Geeft ofwel { ok: true, velden } ofwel een
   weigering met een zin die zegt wat eraan scheelt -- nooit een stilzwijgend
   verbeterde waarde (LAT.md: een ingelezen waarde wordt niet stil verbeterd). */
function keur(b, opties) {
  b = b || {};
  const o = opties || {};
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);

  const houder = schoon(b.houder, 80);
  if (!houder) return { status: 400, error: 'Op wiens naam staat de rekening?' };

  /* ALLEEN DE LAATSTE VIER, en wie het volledige nummer intikt krijgt ook de
     laatste vier -- maar hij hoort te lezen waarom, anders tikt hij het de
     volgende keer weer voluit in. */
  const ruw = String(b.ibanEinde || b.iban || '').replace(/\s/g, '');
  const einde = ruw.slice(-4);
  if (!/^[0-9A-Za-z]{4}$/.test(einde)) {
    return { status: 400, error: 'Geef de laatste vier tekens van het rekeningnummer. Het volledige nummer bewaren we niet: er wordt hier niets geind.' };
  }

  const maxCenten = Math.round(Math.max(0, Math.min(1000000, Number(b.max) || 0)) * 100);
  if (!maxCenten) return { status: 400, error: 'Noteer het maximumbedrag per incasso. Een machtiging zonder maximum is een blanco cheque.' };

  const frequentie = String(b.frequentie || o.frequentie || 'maandelijks');
  const mag = o.frequenties || FREQUENTIES;
  if (!mag.includes(frequentie)) return { status: 400, error: 'Kies een frequentie: ' + mag.join(', ') + '.' };

  const kanaal = schoon(b.kanaal, 30) || 'papier';
  if (!KANALEN.includes(kanaal)) return { status: 400, error: 'Kies een kanaal: ' + KANALEN.join(', ') + '.' };

  return { ok: true, velden: { houder, ibanEinde: einde, bank: schoon(b.bank, 60) || null,
    maxCenten, frequentie, kanaal, getekendOp: schoon(b.getekendOp, 10) || null } };
}

/* REGEL 4 in een functie: alles wat nog actief is voor dezelfde houder gaat uit,
   met de reden erbij. Geeft terug wat er is ingetrokken, zodat de aanroeper het
   kan melden in plaats van het stil te laten gebeuren. */
function vervang(lijst, hoortBij, kenmerk, nu) {
  const weg = [];
  for (const oud of lijst || []) {
    if (!oud.actief || !hoortBij(oud)) continue;
    oud.actief = false;
    oud.ingetrokkenAt = nu;
    oud.ingetrokkenDoor = 'vervangen door ' + kenmerk;
    weg.push(oud.kenmerk);
  }
  return weg;
}

module.exports = { FREQUENTIES, KANALEN, STORNO_WEKEN, STORNO_ONTERECHT_MAANDEN,
  AANKONDIGING_DAGEN, nietGeind, publiek, keur, vervang };
