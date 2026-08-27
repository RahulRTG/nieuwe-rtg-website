/* ============================================================================
   DE GEBEURTENISSENSTROOM -- de envelop, uitgezonden.

   WAAROM DIT ER IS. `kern/envelop.js` legde de VORM vast van wat er in dit huis
   gebeurt, en stond daarna nergens aangeroepen. Een vorm die niemand vult is
   geen afspraak maar een voornemen. Dit bestand is de plek waar hij wordt
   gevuld en verstuurd.

   WAT DIT WEL EN NIET IS. De bus (server/bus.js) draagt vandaag drie kanalen, en
   geen ervan is een gebeurtenis:

     sse                routering -- "stuur dit naar deze verbindingen"
     rtg:sessies:v1     synchronisatie -- "deze sessie is weg"
     rtg:db:versie      mechaniek -- "de database is verder"

   Dat zijn alle drie berichten over de MACHINE. Een gebeurtenis gaat over wat er
   in het huis is voorgevallen: een inzending is afgekeurd, een app is
   ingetrokken, een besluit is genomen. Die stroom bestond hier niet, en daarom
   krijgt hij een eigen kanaal in plaats van dat hij op een van die drie wordt
   geduwd -- een routeringsbericht is geen gebeurtenis, hoe erg de vorm ook lijkt.

   ER IS NOG GEEN ABONNEE, EN DAT IS GEEN ONAF WERK. Op een bus is een uitzender
   zonder luisteraar een complete toestand: de gebeurtenis is nu beschikbaar voor
   elk ander proces in de vloot, en wie hem nodig heeft haakt aan met `luister()`.
   Wat er NIET bij hoort te komen zonder een eigen besluit, staat in
   `envelop.NIET_GEBOUWD`: geen leveringsgarantie, geen volgorde, geen opslag, en
   geen abonnement voor derden. Dit kanaal is intern.

   DRIE REGELS DIE HIER VASTLIGGEN.

   1. EEN GEBEURTENIS BREEKT NOOIT DE HANDELING. Wie `meld()` aanroept is midden
      in zijn eigen werk; een envelop die niet klopt mag dat werk niet omgooien.
      Daarom wordt hier niets gegooid.

   2. MAAR HIJ VERDWIJNT OOK NIET STIL. Een geweigerde envelop wordt geteld en
      gemeld met de reden erbij (LAT-regel 5). Een stroom die zwijgend berichten
      laat vallen, ziet er precies zo uit als een stroom waarin niets gebeurt.

   3. DEZE MODULE VOEGT GEEN VELDEN TOE. Alles wat een envelop draagt, komt uit
      kern/envelop.js. Zou hier een veldje bij komen "omdat de App Store dat
      nodig heeft", dan is de gedeelde vorm binnen een jaar geen gedeelde vorm
      meer (CREATE-02).
   ========================================================================== */
'use strict';
const envelop = require('./envelop');

const KANAAL = 'rtg:gebeurtenis:v1';

function maakGebeurtenis({ bus, crypto, log } = {}) {
  /* Wie deze uitzender is. Bij Redis krijgt het publicerende proces zijn eigen
     bericht terug (zie de kop van server/bus.js); een luisteraar hoort zijn
     eigen gebeurtenissen niet nog een keer te verwerken. Zelfde truc als
     kern/sessies.js. */
  const afzender = (crypto || require('crypto')).randomBytes(8).toString('hex');
  const meld_ = (t) => { try { (log || console.warn)(t); } catch (e) {} };

  const tel = { verstuurd: 0, geweigerd: 0, zonderBus: 0 };
  let laatsteFout = null;

  /* Een gebeurtenis melden. `soort` is `domein.gebeurtenis`; de rest van de
     velden gaat rechtstreeks naar kern/envelop.js, die ze streng leest.

     Geeft altijd hetzelfde terug -- { ok, envelop, fouten } -- zodat een
     aanroeper die het WEL wil weten (een toets, bijvoorbeeld) het kan zien,
     zonder dat wie het niet controleert erdoor omvalt. */
  function meld(soort, velden) {
    const r = envelop.maak(Object.assign({ soort }, velden || {}));
    if (!r.ok) {
      tel.geweigerd++;
      laatsteFout = { soort, fouten: r.fouten };
      meld_('[gebeurtenis] geweigerd: ' + soort + ' -- '
        + r.fouten.map(f => f.veld + ': ' + f.wat).join(' | '));
      return r;
    }
    if (!bus || typeof bus.publish !== 'function') { tel.zonderBus++; return r; }
    try {
      bus.publish(KANAAL, { afzender, envelop: r.envelop });
      tel.verstuurd++;
    } catch (e) {
      /* Een bus die stukgaat is geen reden om de handeling te laten mislukken,
         maar wel om het te zeggen. */
      tel.geweigerd++;
      laatsteFout = { soort, fouten: [{ veld: 'bus', wat: String(e && e.message || e) }] };
      meld_('[gebeurtenis] bus weigerde ' + soort + ': ' + (e && e.message));
    }
    return r;
  }

  /* Luisteren. De eigen gebeurtenissen worden overgeslagen en alles wat
     binnenkomt gaat opnieuw door `envelop.lees()` -- een bericht van de bus komt
     van buiten dit proces, en wat van buiten komt wordt gelezen en niet
     vertrouwd. Een binnenkomende envelop wordt daarbij NIET aangevuld: zonder id
     of tijdstip valt hij af. */
  function luister(fn) {
    if (!bus || typeof bus.subscribe !== 'function') return false;
    bus.subscribe(KANAAL, (bericht) => {
      if (!bericht || bericht.afzender === afzender) return;
      const r = envelop.lees(bericht.envelop);
      if (!r.ok) {
        tel.geweigerd++;
        meld_('[gebeurtenis] binnengekomen envelop klopt niet: '
          + r.fouten.map(f => f.veld).join(', '));
        return;
      }
      try { fn(r.envelop); } catch (e) { meld_('[gebeurtenis] luisteraar viel om: ' + (e && e.message)); }
    });
    return true;
  }

  return { meld, luister, KANAAL, afzender, stand: () => Object.assign({}, tel, { laatsteFout }) };
}

/* Een journaalnaam naar een gebeurtenissoort. De journalen in dit huis schrijven
   met streepjes ('inzending-door-naar-mens'); de envelop wil
   `domein.gebeurtenis` zonder streepjes, omdat een soort een sleutel is en geen
   zin. Deze vertaling staat hier en niet bij de aanroeper, zodat er niet in elk
   domein een eigen manier ontstaat om dezelfde naam om te zetten. */
function soortVan(domein, wat) {
  const stuk = String(wat || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+(.)/g, (m, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '');
  return String(domein || '') + '.' + stuk;
}

module.exports = { maakGebeurtenis, soortVan, KANAAL };
