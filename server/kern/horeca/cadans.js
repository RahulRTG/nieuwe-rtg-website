/* Horeca (kern): de CADANS -- terugrekenen vanaf het moment dat een gang op
   tafel hoort te staan.

   WAAROM DIT BESTAAT. Het keukenbord rekent vooruit: "deze bon loopt 14 van 12
   minuten". Dat is een registratie. Een kok heeft daar weinig aan, want het
   vertelt hem wat er al mis is en niet wat hij nú moet aanzetten. Een gang komt
   pas samen de deur uit als het langzaamste gerecht bepaalt wanneer de rest
   begint -- dus reken je terug vanaf het serveermoment. Dat is het hele verschil
   tussen een kassa die opslaat en een systeem dat regisseert (HORECA.md).

   DE REKENSOM STAAT ERBIJ, EN DAT IS GEEN SIER. Net als bij de drukterem in
   keukenlaag.js: wie het getal niet kan narekenen, gelooft het niet, en een
   keuken die het scherm niet gelooft werkt eromheen. Elke gang draagt daarom
   `rekensom` in gewone woorden.

   WAT DIT NIET DOET. Het start niets, het houdt niets tegen en het vinkt niets
   af. Het rekent, en de mens aan de pas beslist -- dezelfde grens als in
   horeca/expeditie.js. En het maakt geen tweede orderstaat: alles hieronder is
   een projectie op de bestaande regels van de bestaande rekening (LAT-regel 4). */
'use strict';

const klok = require('../../lib/klok');
const { bereidingsMinuten } = require('./keukenlaag');

/* Twee marges, allebei klein en allebei uitlegbaar. PASMARGE is de tijd tussen
   "alles staat bij de pas" en "het staat op tafel": afwerken, controleren,
   weglopen. STARTVENSTER is hoe ruim "nu" is -- een kok die binnen twee minuten
   moet beginnen, staat in de baan NU en niet in HIERNA, want anders springt een
   gerecht van de ene kolom naar de andere terwijl hij ernaar kijkt. */
const PASMARGE = 2;
const STARTVENSTER = 2;

const MIN = 60000;
const minuten = (ms) => Math.round(ms / MIN);

/* "19:42" op de dag van de vrijgave. Een club serveert om half drie 's nachts,
   dus een tijd die meer dan zes uur vóór de vrijgave ligt, hoort bij de dag
   erna -- anders staat een bestelling van 02:15 vijftien uur in het verleden en
   kleurt het hele bord rood. */
function klokTijdNaarMs(tijd, ankerMs) {
  const m = /^([0-2]?\d):([0-5]\d)$/.exec(String(tijd || '').trim());
  if (!m) return null;
  const uur = Number(m[1]), min = Number(m[2]);
  if (uur > 23) return null;
  const anker = new Date(ankerMs);
  const d = new Date(anker.getFullYear(), anker.getMonth(), anker.getDate(), uur, min, 0, 0);
  let ms = d.getTime();
  if (ms < ankerMs - 6 * 60 * MIN) ms += 24 * 60 * MIN;
  return ms;
}

/* Het doelmoment van een gang. Twee bronnen, en welke het was staat erbij:

   AFSPRAAK -- de zaal heeft bij het vrijgeven een serveertijd meegegeven
   (`serveerOm`). Dat is een afspraak met de gast en die wint altijd.

   AFGELEID -- er is geen afspraak, dus leiden we hem af: vanaf het moment dat
   de gang is vrijgegeven, plus de tijd van het LANGZAAMSTE gerecht erin, plus
   de pasmarge. Dat is de vroegst mogelijke eerlijke belofte; korter kan de
   keuken niet en langer is verzonnen.

   DIE PASMARGE HOORT ER ECHT BIJ, en dat bleek pas uit een toets. Zonder hem is
   het doel `vrijgave + langste`, en dan is het startmoment van juist dat
   langzaamste gerecht `doel - pasmarge - langste` = twee minuten VOOR de
   vrijgave. Elke gang zonder afgesproken tijd kwam daardoor als achterstand
   binnen: de kok kreeg een rode bon op het moment dat de zaal hem vrijgaf.

   Er komt hier nooit een derde bron bij die "ongeveer" is. Wat we niet weten,
   zeggen we niet (HORECA.md, grens 7). */
function doelVanGang(h, regels, nuMs) {
  const afspraak = regels.map((r) => r.serveerOm).find(Boolean);
  const vrijMs = regels.reduce((vroegst, r) => {
    const t = Date.parse(r.vrijAt || '');
    return isNaN(t) ? vroegst : (vroegst === null ? t : Math.min(vroegst, t));
  }, null);
  const anker = vrijMs === null ? nuMs : vrijMs;

  if (afspraak) {
    const ms = klokTijdNaarMs(afspraak, anker);
    if (ms !== null) return { doelMs: ms, bron: 'afspraak',
      rekensom: 'De zaal gaf ' + afspraak + ' door als serveertijd.' };
  }
  const langste = regels.reduce((m, r) => Math.max(m, bereidingsMinuten(h, r)), 0);
  return { doelMs: anker + (langste + PASMARGE) * MIN, bron: 'afgeleid',
    rekensom: 'Geen afgesproken tijd; vrijgegeven plus ' + langste +
      ' min voor het langzaamste gerecht van deze gang, plus ' + PASMARGE +
      ' min bij de pas.' };
}

/* In welke baan hoort dit gerecht op het stationsbord?

   NU      dit moet nu aan, of het staat al aan en loopt op tijd
   HIERNA  hier begin je later aan; gebruik de tijd voor mise-en-place
   WACHT   klaar, maar de gang is nog niet compleet -- bewust vastgehouden
   RISICO  het startmoment is voorbij en het staat nog niet aan, of het loopt
           over zijn eigen norm heen

   De baan volgt uit de GETALLEN en nooit andersom -- zelfde regel als de kleur
   op het keukenbord. Wie de baan niet ziet, leest de minuten. */
function baanVan(regel, startOverMin, looptMin, norm, gangCompleet) {
  if (regel.stand === 'uitgegeven') return 'uitgegeven';
  if (regel.stand === 'klaar') return gangCompleet ? 'nu' : 'wacht';
  const bezig = regel.stand === 'gestart' || regel.stand === 'bereid';
  if (bezig) return looptMin > norm ? 'risico' : 'nu';
  if (startOverMin < -STARTVENSTER) return 'risico';
  if (startOverMin <= STARTVENSTER) return 'nu';
  return 'hierna';
}

/* De cadans van één rekening: per gang een doel, per regel een startmoment.

   `aantal` telt hier BEWUST niet mee in de duur. Vier entrecotes gaan samen op
   de grill; ze duren niet vier keer zo lang. Voor de BELASTING van een station
   telt het aantal wel mee, en dat rekent openWerk() in keukenlaag.js -- twee
   verschillende vragen, twee verschillende sommen. */
function cadansVanRekening(h, rek, nuMs) {
  const nuT = typeof nuMs === 'number' ? nuMs : klok.nu();
  const perGang = new Map();
  for (const regel of (rek.regels || [])) {
    if (!regel.vrijAt) continue;                 // de keuken ziet alleen vrijgegeven werk
    if (regel.stand === 'uitgegeven') continue;
    if (regel.bevestiging === 'wacht') continue; // wacht op een mens (allergie, plafond)
    const sleutel = String(regel.gang || 0);
    if (!perGang.has(sleutel)) perGang.set(sleutel, []);
    perGang.get(sleutel).push(regel);
  }

  const gangen = [];
  for (const [gang, regels] of perGang) {
    const { doelMs, bron, rekensom } = doelVanGang(h, regels, nuT);
    const passMs = doelMs - PASMARGE * MIN;
    const compleet = regels.every((r) => r.stand === 'klaar');

    const items = regels.map((regel) => {
      const norm = bereidingsMinuten(h, regel);
      const startMs = passMs - norm * MIN;
      const looptMin = regel.startAt || regel.vrijAt
        ? Math.max(0, minuten(nuT - Date.parse(regel.startAt || regel.vrijAt))) : 0;
      const startOverMin = minuten(startMs - nuT);
      return {
        regelId: regel.id, naam: regel.naam, aantal: regel.aantal,
        station: regel.station || 'warm', stand: regel.stand,
        allergie: regel.allergie || null,
        norm, loopt: looptMin,
        startOm: new Date(startMs).toISOString(),
        startOver: startOverMin,
        baan: baanVan(regel, startOverMin, looptMin, norm, compleet),
        rekensom: 'Klaar bij de pas om ' + hhmm(passMs) + ', ' + norm +
          ' min bereiding, dus aanzetten om ' + hhmm(startMs) + '.'
      };
    }).sort((a, b) => Date.parse(a.startOm) - Date.parse(b.startOm));

    /* De spreiding is het echte kwaliteitsgetal van een gang: hoe lang staat
       het eerste bord te wachten op het laatste. Niet een score van 0 tot 100,
       maar minuten -- want minuten kun je narekenen en een score niet. */
    const gereed = items.filter((i) => i.stand === 'klaar');
    const spreidingMin = gereed.length && gereed.length < items.length
      ? Math.max(...gereed.map((i) => i.loopt)) : 0;

    gangen.push({
      gang: Number(gang), doelOm: new Date(doelMs).toISOString(), passOm: new Date(passMs).toISOString(),
      doelOver: minuten(doelMs - nuT), bron, rekensom,
      compleet, klaar: gereed.length, totaal: items.length,
      staatKoud: spreidingMin, regels: items,
      laatste: items.filter((i) => i.stand !== 'klaar')
        .sort((a, b) => Date.parse(b.startOm) - Date.parse(a.startOm))[0] || null
    });
  }
  return gangen.sort((a, b) => Date.parse(a.doelOm) - Date.parse(b.doelOm));
}

function hhmm(ms) {
  const d = new Date(ms);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

/* De cadans van de hele zaak, plat: één regel per vrijgegeven gerecht, met de
   gang en het doel eraan. Zo kan het stationsbord er rechtstreeks op tekenen
   zonder zelf te hoeven weten hoe een gang in elkaar zit. */
function cadansVanZaak(h, nuMs) {
  const nuT = typeof nuMs === 'number' ? nuMs : klok.nu();
  const uit = [];
  for (const rek of Object.values(h.rekeningen || {})) {
    if (rek.status !== 'open' && rek.status !== 'betaald') continue;
    for (const gang of cadansVanRekening(h, rek, nuT)) {
      for (const regel of gang.regels) {
        uit.push(Object.assign({}, regel, {
          rekeningId: rek.id, tafel: rek.tafel || rek.kanaal, kanaal: rek.kanaal,
          gang: gang.gang, doelOm: gang.doelOm, passOm: gang.passOm,
          doelOver: gang.doelOver, gangCompleet: gang.compleet,
          samenMet: gang.regels.filter((x) => x.regelId !== regel.regelId).map((x) => x.naam)
        }));
      }
    }
  }
  return uit.sort((a, b) => Date.parse(a.startOm) - Date.parse(b.startOm));
}

/* De vier banen geteld, voor de kop van het scherm. `uitgegeven` komt hier niet
   voor: die staat niet meer op het bord. */
function banen(rijen) {
  const t = { nu: 0, hierna: 0, wacht: 0, risico: 0 };
  for (const r of rijen) if (t[r.baan] !== undefined) t[r.baan]++;
  return t;
}

module.exports = { cadansVanRekening, cadansVanZaak, banen, klokTijdNaarMs, PASMARGE, STARTVENSTER };
