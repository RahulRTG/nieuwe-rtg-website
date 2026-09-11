/* DE BRONNEN MET HERKOMST `rtg` (hoort bij kern/reiswereld-bronnen.js): de
   reis van het eigen reisbureau en de vlucht of charter van de eigen luchtdesk.
   Zelfde naad als reiswereld-bronnen-partner.js: de herkomst die elke rij
   draagt. De regels uit de kop van reiswereld-bronnen.js gelden ook hier. */
'use strict';

function reisbureau({ kern, regel, bron }, key, uit, stil) {
    /* HET REISBUREAU DRAAGT GEEN PLEK, en dat blijft zo: een reispakket heeft
       een bestemming als vrije tekst ("Barcelona") en geen zaak. Geen benadering
       op de stadsnaam -- op zo'n marge wordt straks een reservering verzet. Het
       hotel dat het reisbureau boekt IS een zaak, dus daar zit de volgende
       dekkingswinst: in dat domein en niet hier. */

    /* WAT ER NIET MEER KOMT, EN WAT NOG WEL AANDACHT VRAAGT -- en dat zijn hier
       twee verschillende dingen.

       Weggelaten worden een INGETROKKEN aanvraag en een AFGEZEGDE reis: die
       eerste is nooit iets geworden, die tweede was rond en gaat alsnog niet
       door (kern/reisbureau-nazorg.js). Allebei staan ze nog gewoon bij "mijn
       aanvragen" en in het bestellingenoverzicht, met hun reden erbij -- ze zijn
       alleen niet KOMEND, en dat is wat deze lijst is.

       Een AFGEWEZEN aanvraag blijft hier wel staan, en dat is met opzet: de
       reiswereld zet er het signaal `aandacht` op, en kern/reisoplosser.js
       hangt daaraan om alternatieven uit de eigen catalogus te zoeken ("los het
       op"). Wie hem hier wegfiltert omdat hij "toch niet doorgaat", haalt stil
       die hele functie weg -- test/reiswereld.test.js zakt er terecht op.

       De afgezegde reis krijgt die alternatieven vandaag NIET. Dat is een gat
       en geen besluit: juist een reis die het reisbureau zelf afzegt is de plek
       waar een lid een alternatief wil. Het staat in TRAVELCOMMERCE.md par. 8
       en niet hier stil weggelaten. */
    bron('reisbureau', () => (kern.reisbureau.mijn(key) || [])
      .filter(a => a.status !== 'geannuleerd' && a.status !== 'afgezegd')
      .map(a => regel('reis', {
        titel: a.titel, bestemming: a.bestemming, van: a.vertrek, personen: a.personen,
        status: a.status, kenmerk: a.ref, herkomst: 'rtg',
        app: 'Reisbureau', link: '/apps/reisbureau.html'
      })), uit, stil);
}

function vluchten({ kern, regel, bron }, key, uit, stil) {
    /* DE PLEK IS HIER NIET DE BESTEMMING. Bij elk ander onderdeel vallen "waar
       ga ik heen" en "waar moet ik zijn" samen; bij een vlucht niet -- u moet op
       de LUCHTHAVEN zijn. Wie `bestemming` als plek meestuurt, laat Move de
       reistijd naar Parijs Le Bourget rekenen voor iemand die naar de gate moet.
       De bestemming blijft dus vrije tekst ('Ibiza (uit Geneve)') en wordt nooit
       een coordinaat; de luchthaven komt als verwijzing uit kern/luchthaven.
       Dit is de bron die de dekking echt verhoogt: een vlucht draagt als enige
       van de vijf een datum EN een uur. Zie MOVE.md par. 6. */
    bron('vluchten', () => {
      const d = kern.lucht.mijn(key) || {};
      const luchthaven = kern.lucht.plek ? kern.lucht.plek() : null;
      const b = (d.boekingen || []).filter(x => x.status !== 'geannuleerd').map(x => regel('vlucht', {
        titel: (x.vlucht || {}).nummer, bestemming: (x.vlucht || {}).bestemming,
        van: (x.vlucht || {}).datum, tijd: (x.vlucht || {}).tijd, plek: luchthaven,
        status: x.status, kenmerk: x.id, herkomst: 'rtg',
        app: 'Vluchten', link: '/apps/vluchten.html'
      }));
      const c = (d.charters || []).filter(x => x.status !== 'geannuleerd').map(x => regel('charter', {
        titel: x.soort, bestemming: x.bestemming, van: x.datum, tijd: x.tijd, plek: luchthaven,
        status: x.status, kenmerk: x.code, herkomst: 'rtg', app: 'Hangar', link: '/apps/hangar.html'
      }));
      return b.concat(c);
    }, uit, stil);
}

module.exports = { reisbureau, vluchten };
