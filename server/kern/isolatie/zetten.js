/* EEN STAND ZETTEN -- verstrengen zonder ceremonie, verlagen alleen met.

   Los van ./index.js omdat dit de HANDHAVING is en de rest de bedrading. De
   regel die hier woont -- er is geen weg naar beneden dan een voltooide
   ceremonie -- is SEC-LOCK-001 in code, en die hoort te vinden te zijn op een
   plek die zo heet.

   VERSTRENGEN KENT GEEN CEREMONIE, en dat is geen vergetelheid maar de andere
   helft van dezelfde regel: software mag beveiliging automatisch verhogen. Een
   drempel voor de veilige richting duwt mensen onder druk naar de onveilige
   (BESTUUR.md grens 6.10). */
'use strict';

const ordening = require('./ordening');
const dragers = require('./dragers');

module.exports = function maakZetter({ opslag, save, beveilig, nu, standVan, spoor, fout,
  EIGEN_DRAGERS, ontsluiting }) {
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
  function vraagOntsluiting({ drager, sleutel, naar, door, reden, tweedeMens }) {
    if (!EIGEN_DRAGERS.includes(drager)) fout(400, 'Deze laag ontsluit alleen ' + EIGEN_DRAGERS.join(', ') + '.');
    const van = standVan(drager, sleutel) || 'normaal';
    return ontsluiting.start({ drager, sleutel, van, naar, door, reden, tweedeMens });
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

  return { zet, vraagOntsluiting, voltooiOntsluiting };
};
