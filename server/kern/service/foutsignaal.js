/* ============================================================================
   HET FOUTSIGNAAL -- 84.000 gebeurtenissen, geen 84.000 zaken.

   WAT ER WAS. routes/fout.js vangt fouten uit de browser op (bewust zonder
   inlog: een fout die het INLOGGEN sloopt komt nooit binnen achter een poort die
   inloggen vereist) en schrijft ze naar het logboek. Meer niet -- geen opslag,
   geen scherm, geen opvolging, geen terugkoppeling aan wie hem meldde.

   WAT ER NIET MOET KOMEN. Een zaak per fout. Een scherm dat op elke render
   struikelt levert tienduizend meldingen van honderd mensen, en een wachtrij met
   tienduizend zaken is geen wachtrij meer. Dat is precies de fout die een
   ticketsysteem maakt zodra je er telemetrie in laat lopen.

   WAT ER WEL KOMT: EEN SIGNAAL PER FOUT-VORM. Gelijke fouten worden op een
   VINGERAFDRUK bij elkaar gelegd -- soort, melding, bestand, regel, scherm --
   en het signaal telt hoe vaak en over hoeveel schermen. Zo staat er in het
   overzicht één regel:

     ERR-a1b2c3  checkout-confirmation undefined   84.294 keer, 6 schermen

   DE VINGERAFDRUK KENT GEEN MENSEN. Er gaat geen codenaam, geen sessiesleutel
   en geen token in, en dat is geen zuinigheid: deze route staat met opzet open
   zonder inlog, dus alles wat er in wordt bewaard is per definitie ongeverifieerd
   en van een onbekende. Er wordt geteld hoe VAAK iets gebeurde en niet WIE het
   overkwam. Een teller is voor een diagnose genoeg; een gedragslogboek per lid
   is dat niet, en het is ook niet te verdedigen (KOSTEN.md voert diezelfde
   redenering over de verbruiksmeter).

   EN DE GETALLEN ZIJN CIJFERS, GEEN CONCLUSIE. `gebruikers` bestaat hier niet:
   zonder identiteit is dat niet te tellen, en een geschat aantal mensen is
   precies het soort getal dat later als feit wordt geciteerd. Er staat wat er
   gemeten is -- gebeurtenissen en schermen -- en verder niets.
   ========================================================================== */
'use strict';

const crypto = require('crypto');
const klok = require('../../lib/klok');

const MAX_SIGNALEN = 2000;

module.exports = function maakFoutsignalen({ db, save }) {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/service-foutsignaal', bezit: { serviceFoutsignalen: 'kaart' } });
  const S = () => eigen.bak('serviceFoutsignalen');
  const nu = () => klok.datum().toISOString();
  const kort = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').slice(0, n);

  /* DE VINGERAFDRUK. Getallen in de melding worden weggehaald voordat er wordt
     gehasht: "kan 12847 niet laden" en "kan 12848 niet laden" zijn dezelfde
     fout met een ander id, en zonder deze regel zijn het twee signalen. Dat is
     de klassieke manier waarop een foutgroepering alsnog een lange lijst wordt. */
  function afdruk({ soort, melding, bestand, regel, pad }) {
    const kaal = kort(melding, 300).replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().toLowerCase();
    const sleutel = [kort(soort, 20), kaal, kort(bestand, 80), Number(regel) || 0].join('|');
    return 'ERR-' + crypto.createHash('sha256').update(sleutel).digest('hex').slice(0, 8);
  }

  /* Een fout binnen. Geeft het signaal terug zodat de aanroeper kan zien of dit
     nieuw is -- routes/fout.js gebruikt dat niet, maar een scherm dat straks
     "dit is bekend" wil zeggen wel. */
  function meld(b) {
    const soort = kort(b.soort, 20) || 'onbekend';
    const melding = kort(b.melding, 300);
    if (!melding) return null;
    const bestand = kort(b.bestand, 80);
    const regel = Number(b.regel) || 0;
    const pad = kort(b.pad, 120);
    const id = afdruk({ soort, melding, bestand, regel, pad });

    const bak = S();
    let s = bak[id];
    if (!s) {
      /* Een plafond, en hij gooit de OUDSTE weg en niet de kleinste: een fout
         die vandaag begint is interessanter dan een die al een jaar meeloopt en
         waar niemand iets mee deed. */
      const sleutels = Object.keys(bak);
      if (sleutels.length >= MAX_SIGNALEN) {
        sleutels.sort((a, b2) => Date.parse(bak[a].laatst) - Date.parse(bak[b2].laatst));
        delete bak[sleutels[0]];
      }
      s = bak[id] = { id, soort, melding, bestand, regel, schermen: [], aantal: 0,
        eerst: nu(), laatst: nu(), zaken: [] };
    }
    s.aantal++;
    s.laatst = nu();
    /* Hoogstens twintig schermen per signaal. Een fout die op honderd schermen
       staat, is met twintig ook wel herkend, en de rij hoeft niet te groeien
       met wat een aanvaller erin duwt. */
    if (pad && !s.schermen.includes(pad) && s.schermen.length < 20) s.schermen.push(pad);
    save();
    return kortS(s);
  }

  function kortS(s) {
    return { id: s.id, soort: s.soort, melding: s.melding, bestand: s.bestand, regel: s.regel,
      schermen: s.schermen.slice(), aantal: s.aantal, eerst: s.eerst, laatst: s.laatst,
      zaken: s.zaken.slice() };
  }

  /* Het overzicht: de vorm waarop een mens naar fouten kijkt. Op AANTAL, want
     dat is het enige dat hier gemeten is -- niet op een verzonnen ernst. */
  function lijst({ max = 50, sinds } = {}) {
    const grens = sinds ? Date.parse(sinds) : 0;
    return Object.values(S())
      .filter(s => !grens || Date.parse(s.laatst) >= grens)
      .sort((a, b) => b.aantal - a.aantal)
      .slice(0, Number(max) || 50)
      .map(kortS);
  }

  /* Een zaak aan een signaal hangen, en andersom. Dit is waarvoor de laag
     bestaat: zodra iemand vanaf een kapot scherm om hulp vraagt, hoort een
     medewerker meteen te zien dat dit geen individueel probleem is. */
  function koppel(signaalId, zaakId) {
    const s = S()[String(signaalId || '')];
    if (!s) return { status: 404, error: 'Dit foutsignaal kennen wij niet.' };
    const z = String(zaakId || '').toUpperCase();
    if (!z) return { status: 400, error: 'Welke zaak?' };
    if (!s.zaken.includes(z)) {
      s.zaken.unshift(z);
      if (s.zaken.length > 100) s.zaken.pop();
      save();
    }
    return { ok: true, signaal: kortS(s) };
  }

  /* Welke signalen op DIT scherm spelen. Gebruikt door de kantoorkant zodra een
     zaak binnenkomt met `betrokken: { soort: 'scherm', code: ... }`: dan staat
     er meteen bij of er op dat scherm iets kapot is. */
  function bijScherm(pad, { max = 5 } = {}) {
    const p = kort(pad, 120);
    if (!p) return [];
    return Object.values(S()).filter(s => s.schermen.includes(p))
      .sort((a, b) => b.aantal - a.aantal).slice(0, max).map(kortS);
  }

  const tel = () => {
    const alle = Object.values(S());
    return { signalen: alle.length, gebeurtenissen: alle.reduce((n, s) => n + s.aantal, 0),
      /* Wat hier NIET staat is een aantal geraakte gebruikers. Deze route is
         zonder inlog en telt dus geen mensen; een schatting zou later als feit
         worden geciteerd. */
      gebruikers: null, gebruikersWaarom: 'De foutingang staat zonder inlog open en kent geen identiteit; mensen tellen kan hier niet.' };
  };

  return { meld, lijst, koppel, bijScherm, tel, afdruk, MAX_SIGNALEN };
};
