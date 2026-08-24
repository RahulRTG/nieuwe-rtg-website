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
const { stappenVan } = require('./stappen');
/* De pure rekenkant staat in ./cadans-doel.js: het doelmoment van een gang en
   de baan van een gerecht. Hier staat de projectie daarvan over de rekeningen
   van een zaak. Zie de kop van dat bestand voor waarom de snede daar ligt. */
const { PASMARGE, STARTVENSTER, MIN, minuten, hhmm, klokTijdNaarMs, doelVanGang, baanVan } = require('./cadans-doel');

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
      /* PER STAP TERUGREKENEN. Een tournedos die drie minuten koud gemarineerd
         wordt, acht minuten grilt en drie minuten saus krijgt, is drie
         handelingen op drie plekken -- en de grill hoort een ander moment te
         horen dan de sauzier. De stappen lopen NA ELKAAR: aannemen dat ze
         parallel gaan, maakt de belofte aan de gast korter dan hij is.

         Zonder stappen blijft er niets staan (null) en verandert er niets aan
         de bestaande som: `startOm` hierboven is dan precies wat het was, en
         met stappen is het het startmoment van de EERSTE stap -- dezelfde
         waarde, want de som van de stappen is de norm. */
      let loper = startMs;
      const stappen = (stappenVan(h, regel.naam) || []).map((st) => {
        const van = loper;
        loper += st.minuten * MIN;
        return { station: st.station, minuten: st.minuten, wat: st.wat,
          startOm: new Date(van).toISOString(),
          startOver: minuten(van - nuT),
          klaarOm: new Date(loper).toISOString(),
          rekensom: (st.wat ? st.wat + ': ' : '') + st.minuten + ' min op ' + st.station +
            ', aanzetten om ' + hhmm(van) + '.' };
      });
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
        stappen: stappen.length ? stappen : null,
        stations: stappen.length ? [...new Set(stappen.map((x) => x.station))] : null,
        rekensom: 'Klaar bij de pas om ' + hhmm(passMs) + ', ' + norm +
          ' min bereiding' + (stappen.length ? ' in ' + stappen.length + ' stappen' : '') +
          ', dus aanzetten om ' + hhmm(startMs) + '.'
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
