/* DE ISOLATIELAAG -- één beveiligingsvlak over zes dragers.

   Isolatie is geen functie die functies uitschakelt. Het is een per-drager
   veiligheidscontract dat beschikbare effecten verkleint, nooit stilzwijgend
   zwakker kan worden, en waarvan iedere geclaimde grens een bewijsgraad heeft.

     ./ordening.js     wat is strenger dan wat, en wanneer is dat niet te zeggen
     ./dragers.js      van wie is een stand, en wie mag hem zetten
     ./effecten.js     wat een handeling DOET, en wat een stand sluit (schaduw)
     ./besluit.js      het verklaarde besluit: waarom niet, en van wie
     ./ontsluiting.js  verlagen als protocol, met het verzoek los van het effect
     ./opslag.js       de enige deur naar db.data

   DIT BESTAND IS DE ENIGE PLEK WAAR EEN STAND VERANDERT, en dat is geen
   ordelijkheid maar de handhaving zelf. `zet()` weigert structureel elke
   verlaging: niet met een controle die je kunt vergeten mee te nemen, maar
   omdat er geen andere weg naar beneden is dan een voltooide ceremonie. Dat is
   SEC-LOCK-001 in code in plaats van in een document.

   DE STAND VAN HET HUIS WORDT GELEZEN EN NIET BEZETEN. Hij woont in
   kern/incidentcontrole.js, waar hij altijd al woonde. Deze laag krijgt hem als
   functie mee. Hem hierheen kopiëren zou twee waarheden maken over dezelfde
   stand, en dan zeggen twee schermen op een dag iets anders over of het platform
   in isolatie staat. Dat de eigenaar het huis dus niet via deze laag verlaagt is
   met opzet: die weg loopt via de incidentcontrole en zijn eigen bevestiging. */
'use strict';

const ordening = require('./ordening');
const dragers = require('./dragers');
const effecten = require('./effecten');
const { maakBesluitlaag } = require('./besluit');
const { maakOntsluiting } = require('./ontsluiting');
const maakOpslag = require('./opslag');
const { maakBeschermstand } = require('../beschermstand');

const EIGEN_DRAGERS = ['organisatie', 'identiteit', 'sessie', 'apparaat'];

function fout(status, tekst) { const e = new Error(tekst); e.status = status; throw e; }

module.exports = function maakIsolatie({ db, save, functies, klok, huisStand, beveilig }) {
  const opslag = maakOpslag({ db });
  const beschermstand = maakBeschermstand({ functies });
  const laag = maakBesluitlaag({ functies, beschermstand });
  const ontsluiting = maakOntsluiting({ opslag, save, klok, ordening });
  const nu = () => (klok && klok.datum ? klok.datum() : new Date());

  /* ---------- lezen ---------- */

  function huis() {
    try { const m = typeof huisStand === 'function' ? huisStand() : huisStand; return m || 'normaal'; }
    catch (e) {
      /* De huisstand niet kunnen lezen is niet hetzelfde als "het huis staat op
         normaal". Een onbekende waarde gaat door dezelfde deur als in
         kern/incidentcontrole.js: hij leest als beschermd, niet als normaal. */
      return 'onbekend:' + String(e.message || 'onleesbaar').slice(0, 30);
    }
  }

  function standVan(drager, sleutel) {
    if (drager === 'huis') return huis();
    if (!EIGEN_DRAGERS.includes(drager)) return null;
    if (!sleutel) return null;
    const kaart = opslag.tak(drager);
    const rij = kaart[String(sleutel)];
    return rij ? rij.stand : null;
  }

  /* DE CONTEXT. De enige plek waar drager-kennis wordt samengesteld, zodat de
     rest van het huis met standen werkt en niet met leden. Wat er niet in staat
     is even belangrijk als wat er wel in staat: geen naam, geen adres, geen rol
     -- alleen sleutels en standen. */
  function context({ organisatie, identiteit, sessie, apparaat } = {}) {
    const sleutels = { organisatie, identiteit, sessie, apparaat };
    const standen = { huis: huis() };
    for (const d of EIGEN_DRAGERS) standen[d] = standVan(d, sleutels[d]);
    return { standen, sleutels, opgesteld: nu().toISOString() };
  }

  function besluit({ pad, methode, context: ctx }) { return laag.besluit({ pad, methode, context: ctx }); }

  /* ---------- zetten ---------- */

  function spoor(regel) {
    const s = opslag.tak('spoor');
    s.unshift(Object.assign({ at: nu().toISOString() }, regel));
    if (s.length > 2000) s.length = 2000;
  }

  /* VERSTRENGEN. Geen ceremonie, met opzet: software mag beveiliging automatisch
     verhogen. Een drempel voor de veilige richting duwt mensen onder druk naar
     de onveilige (BESTUUR.md grens 6.10). */
  function zet({ drager, sleutel, naar, door, reden, zetter }) {
    if (!EIGEN_DRAGERS.includes(drager)) {
      fout(400, drager === 'huis'
        ? 'De stand van het huis wordt gezet via de incidentcontrole en niet via deze laag; ' +
          'twee plekken voor één stand is hoe twee schermen iets anders gaan zeggen.'
        : 'Onbekende drager: ' + String(drager).slice(0, 30));
    }
    if (!sleutel) fout(400, 'Een stand hangt aan een sleutel; zonder sleutel is er geen drager.');
    if (!ordening.ontleed(naar).bekend) fout(400, 'Onbekende stand: ' + String(naar).slice(0, 30));
    if (zetter && !dragers.magZetten(zetter, drager)) {
      fout(403, 'Een ' + zetter + ' zet geen stand op de laag "' + drager + '".');
    }
    const huidig = standVan(drager, sleutel) || 'normaal';

    /* NIETS DOEN LAAT GEEN SPOOR NA. Een tweede identieke aanroep zette hier
       eerst dezelfde stand opnieuw weg en schreef een spoorregel die zei dat er
       iets was verstrengd. Dat is twee keer fout: het spoor gaat liegen over een
       handeling die niet plaatsvond, en een register vol handelingen die niets
       deden is een register dat niemand meer naloopt bij een incident. */
    if (String(huidig) === String(naar)) {
      return { drager, sleutel, stand: String(naar), richting: 'ongewijzigd',
        waarom: 'deze drager stond al op ' + naar + '; er is niets gezet en er is geen spoorregel bij' };
    }

    const stap = ordening.verlaagt(huidig, naar);
    if (stap.verlaagt) {
      fout(409, 'Dit verlaagt de beveiliging (' + huidig + ' -> ' + naar + '). ' +
        'Verlagen loopt via een ontsluitceremonie en niet via deze weg. ' + (stap.waarom || ''));
    }
    const kaart = opslag.tak(drager);
    kaart[String(sleutel)] = { stand: String(naar), sinds: nu().toISOString(),
      door: String(door || 'onbekend').slice(0, 64), reden: String(reden || '').slice(0, 240) };
    spoor({ drager, sleutel: String(sleutel).slice(0, 64), van: huidig, naar: String(naar),
      richting: 'verstrengd', door: String(door || 'onbekend').slice(0, 64) });
    if (save) save();
    if (beveilig) beveilig.meld('isolatie', 'waarschuwing',
      'Isolatiestand verstrengd op ' + drager + ' naar ' + naar + '. Reden: ' + String(reden || '-'),
      { bron: 'isolatie:zet' });
    return { drager, sleutel, stand: String(naar), richting: 'verstrengd' };
  }

  /* VERLAGEN. Alleen langs een ceremonie, en die begint met de HUIDIGE stand --
     niet met een stand die de aanroeper aanlevert. Zou de aanvrager `van` mogen
     kiezen, dan koos hij een overgang die geen ceremonie vraagt. */
  function vraagOntsluiting({ drager, sleutel, naar, door, reden }) {
    if (!EIGEN_DRAGERS.includes(drager)) fout(400, 'Deze laag ontsluit alleen ' + EIGEN_DRAGERS.join(', ') + '.');
    const van = standVan(drager, sleutel) || 'normaal';
    return ontsluiting.start({ drager, sleutel, van, naar, door, reden });
  }

  function voltooiOntsluiting(id, { door }) {
    const uit = ontsluiting.commit(id, { door });
    const kaart = opslag.tak(uit.drager);
    const van = standVan(uit.drager, uit.sleutel) || 'normaal';
    if (String(uit.nieuweStand) === 'normaal') delete kaart[String(uit.sleutel)];
    else kaart[String(uit.sleutel)] = { stand: uit.nieuweStand, sinds: nu().toISOString(),
      door: String(door || 'onbekend').slice(0, 64), reden: 'ontsluiting ' + uit.verzoek.id };
    spoor({ drager: uit.drager, sleutel: String(uit.sleutel).slice(0, 64), van, naar: uit.nieuweStand,
      richting: 'verlaagd', door: String(door || 'onbekend').slice(0, 64), ceremonie: uit.verzoek.id });
    if (save) save();
    if (beveilig) beveilig.meld('isolatie', 'kritiek',
      'Isolatiestand VERLAAGD op ' + uit.drager + ' naar ' + uit.nieuweStand + ' na ceremonie ' + uit.verzoek.id + '.',
      { bron: 'isolatie:ontsluiting' });
    return uit;
  }

  /* ---------- het overzicht ---------- */
  function overzicht() {
    const perDrager = {};
    for (const d of EIGEN_DRAGERS) {
      const kaart = opslag.tak(d);
      const rijen = Object.entries(kaart);
      perDrager[d] = { aantal: rijen.length,
        perStand: rijen.reduce((a, [, v]) => { a[v.stand] = (a[v.stand] || 0) + 1; return a; }, {}) };
    }
    return {
      huis: huis(),
      dragers: dragers.DRAGERS,
      /* Een drager zonder bron is een gat met een naam, en dat hoort in het
         overzicht en niet in een voetnoot. */
      dragersZonderBron: dragers.DRAGERS.filter(d => d.bron === null).map(d => ({ naam: d.naam, waarom: d.nietGebouwd })),
      perDrager,
      openOntsluitingen: ontsluiting.open(),
      spoor: opslag.tak('spoor').slice(0, 50),
      effectmodel: { handhaaft: false,
        waarom: 'het effectmodel loopt in de schaduw naast de beschermstand. CONTROLPLANE.md: een ' +
          'nieuwe handhavingsregel loopt eerst mee zonder te blokkeren -- je kunt niet afdwingen wat ' +
          'nooit in de schaduw heeft gelopen.',
        effecten: effecten.EFFECTEN }
    };
  }

  return { context, besluit, standVan, zet, vraagOntsluiting, voltooiOntsluiting,
    ontsluiting, overzicht, ordening, dragers, effecten, beschermstand,
    effectieveStand: laag.effectieveStand };
};
