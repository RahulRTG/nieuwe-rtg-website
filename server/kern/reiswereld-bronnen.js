/* DE BRONNEN VAN DE REISWERELD (hoort bij kern/reiswereld.js).

   Welk domein welke rij levert. Dat is iets anders dan wat de wereld met die
   rijen doet -- sorteren, oordelen, tellen -- en sinds de Invoerbalie erbij
   kwam past het ook niet meer in één bestand.

   Twee regels gelden hier voor elke bron, en ze staan allebei in wereldkern.js
   uitgelegd: een bron die stukgaat mag de andere niet meenemen EN mag niet stil
   verdwijnen (zijn naam belandt in `stil` en reist door tot op het scherm), en
   elke rij draagt zijn HERKOMST mee -- de bron weet waar de rij vandaan komt en
   de lagen erboven niet (REIZEN.md par. 2.2). */
'use strict';

module.exports = function bronnen({ kern, regel, bron }, key, uit, stil) {
    bron('verblijven', () => (kern.mijnVerblijven(key) || [])
      .filter(v => v.status !== 'geannuleerd')
      .map(v => regel('verblijf', {
        titel: v.roomName, bestemming: v.plaats || '', van: v.aankomst, tot: v.vertrek,
        status: v.status, kenmerk: v.id, herkomst: 'partner',
        app: 'Verblijven', link: '/apps/hotels.html'
      })), uit, stil);

    bron('reisbureau', () => (kern.reisbureau.mijn(key) || [])
      .filter(a => a.status !== 'geannuleerd')
      .map(a => regel('reis', {
        titel: a.titel, bestemming: a.bestemming, van: a.vertrek, personen: a.personen,
        status: a.status, kenmerk: a.ref, herkomst: 'rtg',
        app: 'Reisbureau', link: '/apps/reisbureau.html'
      })), uit, stil);

    bron('vluchten', () => {
      const d = kern.lucht.mijn(key) || {};
      const b = (d.boekingen || []).filter(x => x.status !== 'geannuleerd').map(x => regel('vlucht', {
        titel: (x.vlucht || {}).nummer, bestemming: (x.vlucht || {}).bestemming,
        van: (x.vlucht || {}).datum, tijd: (x.vlucht || {}).tijd,
        status: x.status, kenmerk: x.code, herkomst: 'rtg',
        app: 'Vluchten', link: '/apps/vluchten.html'
      }));
      const c = (d.charters || []).filter(x => x.status !== 'geannuleerd').map(x => regel('charter', {
        titel: x.soort, bestemming: x.bestemming, van: x.datum, tijd: x.tijd,
        status: x.status, kenmerk: x.code, herkomst: 'rtg', app: 'Hangar', link: '/apps/hangar.html'
      }));
      return b.concat(c);
    }, uit, stil);

  /* DE INVOERBALIE: wat het lid zelf invoerde uit een eigen document, foto of
     e-mail (kern/invoer.js). Een domein als elk ander -- het bezit zijn eigen
     rijen -- met dit verschil: de herkomst komt hier PER RIJ mee en staat niet
     vast. Een ingevoerde regel kan uit een document, een beeld of uit de hand
     komen, en dat verschil bepaalt straks wat ermee mag (REIZEN.md par. 2.2).

     Ontbreekt de module, dan gaat deze bron stuk en meldt hij zich in `stil` --
     precies zoals bedoeld. Een reis die stilletjes zonder uw eigen ingevoerde
     onderdelen wordt getoond, ziet er compleet uit en is het niet. */
  bron('ingevoerd', () => (kern.invoer.mijnRegels(key) || []).map(x => regel(x.soort, {
    titel: x.titel, bestemming: x.bestemming, van: x.van, tot: x.tot,
    status: x.status, kenmerk: x.kenmerk, herkomst: x.herkomst,
    app: 'Invoerbalie', link: '/apps/reizen.html'
  })), uit, stil);
};
