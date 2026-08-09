/* DE CAPACITEIT: kan er nog iets bij, en wanneer moet er iemand bij.

   Na het geld is dit wat een ondernemer als eerste raakt. De gegevens staan er
   al: de werkdagen en openingstijden van de zaak (`vakUren`, gezet in
   kern/vakwerk/agenda.js), het aantal mensen dat tegelijk werkt, en de
   boekingen met de duur van de dienst erbij. Deze laag telt die tegen elkaar
   weg over een venster van dagen.

   WAT HIER NIET WORDT UITGEREKEND: GEMISTE OMZET. Het is verleidelijk om te
   zeggen "u loopt 6.800 euro per maand mis door capaciteitsgebrek", en het
   klinkt precies als het soort inzicht waar software voor is. Maar wij zien
   geen vraag die nooit is gesteld. Iemand die uw agenda vol zag en wegklikte,
   staat nergens. Zo'n bedrag zou dus een verzinsel zijn met een euroteken
   ervoor -- en juist dat wordt overgeschreven in een besluit om iemand aan te
   nemen. Wat er WEL staat is wat er is: hoeveel dagen zaten vol, hoeveel
   procent van uw tijd is bezet, en hoeveel aanvragen bleven liggen.

   DE BEZETTING IS EEN DELING VAN TWEE GETELDE WAARDEN en daarmee exact:
   geboekte minuten gedeeld door beschikbare minuten. Dat is iets anders dan de
   scores elders in dit OS, die bronnen van ongelijk gewicht optellen.

   ZONDER AGENDA GEEN BEZETTING. Een winkel of een restaurant heeft geen
   `vakUren`, en voor die zaken betekent capaciteit iets heel anders (stoelen,
   voorraad, vierkante meters). Dan komt hier een eigen stand en geen 0% --
   een winkel die als "0% bezet" leest, is een verkeerd antwoord op een vraag
   die niet is gesteld. */
'use strict';

const TIJD = require('../agendatijd');

const DAG = 86400000;
/* Een dag heet vol vanaf dit deel van de beschikbare tijd. Niet 100%: tussen
   twee klussen zit reistijd, opruimen en een broodje, en een dag die op papier
   voor 90% vol staat is in de praktijk vol. */
const VOL_VANAF = 0.85;
/* Vanaf dit gemiddelde over het venster is er structureel te weinig ruimte. */
const KRAP_VANAF = 0.75;

const pct = (deel, geheel) => (geheel > 0 ? Math.round((deel / geheel) * 100) : null);

module.exports = ({ db, boekingenVanZaak }) => {

  const zaakVan = (o) => (o && o.supplierCode
    ? (db.data.suppliers || []).find(x => x.code === o.supplierCode) || null : null);

  /* De openingstijden zoals kern/vakwerk/agenda.js ze leest. Dezelfde
     standaardwaarden, want een andere aanname hier zou een andere agenda
     opleveren dan het boekingsscherm laat zien. */
  function urenVan(s) {
    const u = (s && s.vakUren) || {};
    return {
      dagen: Array.isArray(u.dagen) && u.dagen.length === 7 ? u.dagen.map(Boolean)
        : [false, true, true, true, true, true, false],
      van: TIJD.geldigeTijd(u.van) ? u.van : '09:00',
      tot: TIJD.geldigeTijd(u.tot) ? u.tot : '18:00',
      geblokkeerd: Array.isArray(u.geblokkeerd) ? u.geblokkeerd : [],
      capaciteit: Math.min(20, Math.max(1, Math.round(Number(u.capaciteit)) || 1)),
      /* Heeft de zaak dit zelf gezet, of kijken we naar de standaardwaarden?
         Dat verschil hoort zichtbaar te zijn: een bezetting die op onze
         aanname rust, is een andere mededeling dan een die op zijn agenda rust. */
      gezet: !!(s && s.vakUren)
    };
  }

  function capaciteit(o, nuMs, dagen) {
    const s = zaakVan(o);
    if (!s) return null;

    const caps = db.capsVan(s);
    if (!caps.includes('agenda')) {
      return { stand: 'geen-agenda', bezetting: null,
        uitleg: 'Deze zaak werkt niet met een agenda, dus capaciteit betekent hier iets anders dan bezette uren -- stoelen, voorraad of vierkante meters.',
        let: 'Wij rekenen dat bewust niet om: 0% bezet zou een verkeerd antwoord zijn op een vraag die niet is gesteld.' };
    }

    const nuT = Number.isFinite(nuMs) ? nuMs : Date.now();
    const venster = Number.isFinite(dagen) && dagen > 0 && dagen <= 180 ? Math.round(dagen) : 28;
    const u = urenVan(s);
    const dagMin = Math.max(0, (TIJD.naarMin(u.tot) - TIJD.naarMin(u.van))) * u.capaciteit;

    /* De boekingen die tijd kosten: aangevraagd of bevestigd. Afgerond werk
       ligt achter ons, en wat op betaling wacht is nog geen afspraak. */
    const relevant = (boekingenVanZaak(s.code) || []).filter(b =>
      b && (b.status === 'aangevraagd' || b.status === 'bevestigd'));

    const perDag = new Map();
    for (let i = 0; i < venster; i++) {
      const d = new Date(nuT + i * DAG);
      const datum = d.toISOString().slice(0, 10);
      const werkdag = u.dagen[d.getUTCDay()] && !u.geblokkeerd.includes(datum);
      perDag.set(datum, { datum, werkdag, beschikbaar: werkdag ? dagMin : 0, bezet: 0, boekingen: 0 });
    }
    for (const b of relevant) {
      const datum = TIJD.datumVan(b);
      const rij = datum && perDag.get(datum);
      if (!rij) continue;
      rij.bezet += (b.service && Number(b.service.duurMin)) || 60;
      rij.boekingen++;
    }

    const rijen = [...perDag.values()];
    const werkdagen = rijen.filter(r => r.werkdag);
    const beschikbaar = werkdagen.reduce((n, r) => n + r.beschikbaar, 0);
    const bezet = rijen.reduce((n, r) => n + r.bezet, 0);
    /* Een dag die vol staat terwijl hij geen werkdag is (een spoedklus op
       zaterdag) telt wel als bezette tijd, maar niet als beschikbare. Dat kan
       boven de 100% uitkomen, en dat is de eerlijke uitkomst: u werkt dan meer
       dan u zelf hebt opgegeven. */
    const volleDagen = werkdagen.filter(r => r.beschikbaar > 0 && r.bezet / r.beschikbaar >= VOL_VANAF);
    const buitenUren = rijen.filter(r => !r.werkdag && r.bezet > 0);

    const bezetting = pct(bezet, beschikbaar);
    const openAanvragen = relevant.filter(b => b.status === 'aangevraagd').length;

    return {
      stand: 'gemeten', venster,
      uren: { van: u.van, tot: u.tot, capaciteit: u.capaciteit, gezet: u.gezet,
        let: u.gezet ? null : 'Uw werktijden staan nog niet ingesteld; wij rekenen met maandag t/m vrijdag, 09:00-18:00, in uw eentje.' },
      bezetting,
      bezetteUren: Math.round(bezet / 60 * 10) / 10,
      beschikbareUren: Math.round(beschikbaar / 60 * 10) / 10,
      werkdagen: werkdagen.length,
      volleDagen: volleDagen.length,
      buitenUrenDagen: buitenUren.length,
      openAanvragen,
      dagen: rijen.map(r => ({ datum: r.datum, werkdag: r.werkdag, boekingen: r.boekingen,
        bezetting: r.beschikbaar > 0 ? pct(r.bezet, r.beschikbaar) : null })),
      /* Zie de kop: wat er niet is, en waarom wij dat niet verzinnen. */
      nietGemeten: 'Wij zien geen vraag die nooit is gesteld. Wie uw agenda vol zag en wegklikte, staat nergens -- dus rekenen wij geen gemiste omzet uit.'
    };
  }

  return { CAPACITEIT_VOL_VANAF: VOL_VANAF, CAPACITEIT_KRAP_VANAF: KRAP_VANAF, capaciteit };
};

/* De opvolgregel. Twee gevallen, en allebei rusten ze op getelde dagen en niet
   op een gevoel. Buiten de opgegeven uren werken weegt zwaarder dan een hoge
   bezetting: dat is al gebeurd, en het is de stille manier waarop iemand
   zichzelf opbrandt. */
function capaciteitOpvolging(c) {
  if (!c || c.stand !== 'gemeten') return null;
  if (c.buitenUrenDagen > 0) {
    return { id: 'buiten-uren', aantal: c.buitenUrenDagen,
      kop: 'U werkt op ' + c.buitenUrenDagen + ' dag' + (c.buitenUrenDagen === 1 ? '' : 'en') +
        ' buiten uw eigen werktijden',
      waarom: 'Dat kan een keer, maar het staat niet in uw agenda en het telt niet mee in uw tarief. Pas uw werktijden aan of zeg vaker nee.' };
  }
  if (c.bezetting !== null && c.bezetting >= KRAP_VANAF * 100) {
    return { id: 'krap', aantal: c.volleDagen,
      kop: 'Uw agenda staat voor ' + c.bezetting + '% vol de komende ' + c.venster + ' dagen',
      waarom: c.volleDagen
        ? c.volleDagen + ' dagen zitten praktisch vol. Vanaf hier kost elke nieuwe klant een bestaande, tenzij u opschaalt of uw prijs verhoogt.'
        : 'Vanaf hier kost elke nieuwe klant een bestaande, tenzij u opschaalt of uw prijs verhoogt.' };
  }
  return null;
}

module.exports.capaciteitOpvolging = capaciteitOpvolging;
module.exports.VOL_VANAF = VOL_VANAF;
module.exports.KRAP_VANAF = KRAP_VANAF;
