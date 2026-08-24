/* ============================================================================
   DE VERIFICATIESTERKTE -- laag 2 van de Trust Fabric (VERTROUWEN.md par. 6).

   Een sessie in dit huis weet DAT hij is ingelogd. Hij weet niet hoe HARD en
   niet hoe LANG GELEDEN, en zonder die twee is er geen onderbouwde step-up:
   "je account is 7 minuten geleden vanaf een nieuw apparaat geverifieerd" is
   dan een zin die niemand kan waarmaken.

   DRIE GEGEVENS, EN GEEN VIERDE:

     hoe        waarmee is deze sessie ontstaan (passkey, wachtwoord, provider)
     wanneer    en dus: hoe oud is dat moment nu
     apparaat   was dit apparaat al eerder bij dit account gezien

   DIT IS GEEN APPARAATREGISTER. Er wordt uitsluitend een HASH bewaard, de lijst
   is kort, en hij verdwijnt met het account. Wat er niet in staat is net zo
   belangrijk als wat er wel in staat: geen useragent, geen IP-adres, geen
   plaats, geen tijdstip van de dag. Dit beantwoordt een enkele vraag -- ken ik
   dit apparaat van u? -- en mag nooit een bewegingsbeeld van een mens worden.

   DE STERKTE IS EEN OORDEEL OVER DE METHODE EN NIET OVER DE MENS. Een
   wachtwoord is niet "slecht"; het is minder hard dan een passkey, en dat
   verschil telt alleen mee bij een zware handeling. Bij de gewone negenennegentig
   procent merkt niemand er iets van.

   EEN SLEUTEL IS GEEN PERSOON. Een beheer-token of een API-sleutel opent een
   deur zonder dat er iemand is geverifieerd. Dat levert hier `sterkte: 'geen'`
   met de reden -- en niet null, want null leest als "nog niet gemeten" terwijl
   dit een gemeten eigenschap is: achter deze sleutel staat aantoonbaar niemand.
   ========================================================================== */
'use strict';

const crypto = require('crypto');
const { nu: klokNu } = require('../../lib/klok');

/* De manieren waarop iemand hier binnenkomt, als DATA. Een manier erbij is een
   regel erbij; de beoordeling eronder verandert niet mee. */
const MANIEREN = {
  passkey: { sterkte: 'sterk', naam: 'een passkey op dit apparaat' },
  wachtwoord: { sterkte: 'gewoon', naam: 'een wachtwoord' },
  sleutelwoorden: { sterkte: 'gewoon', naam: 'sleutelwoorden' },
  pincode: { sterkte: 'zwak', naam: 'een pincode' },
  /* TWEE SLEUTELS VAN DEZELFDE MENS. Een werkruimtelid heeft geen wachtwoord --
     het heeft een lid-token. Wat het WEL heeft als het gekoppeld is, is een
     RTG-account met een eigen, hier al gemeten inlog. Wie beide toont, heeft
     twee onafhankelijke sleutels van dezelfde persoon, en dat is precies wat
     een tweede factor hoort te doen. De sterkte is NIET hoger dan die van de
     RTG-inlog eronder: bedrijf/bevestig.js weigert een zachte of verlopen
     RTG-inlog, dus deze band is een uitkomst en geen aanname. */
  tweesleutels: { sterkte: 'gewoon', naam: 'uw RTG-inlog naast uw lid-token' },
  /* De provider van de klant doet de verificatie; hoe hard die was, weten wij
     niet tenzij de assertie het zegt. Dat is een eigen band en geen 'gewoon':
     doen alsof wij die sterkte kennen, is precies een bewering zonder bron. */
  provider: { sterkte: 'overgenomen', naam: 'de identiteitsprovider van uw organisatie' },
  sleutel: { sterkte: 'geen', naam: 'een sleutel zonder persoon' }
};

/* Hoe lang een verificatie VERS heet. Kort genoeg dat een gestolen sessie niet
   uren lang als net-geverifieerd doorgaat, ruim genoeg dat niemand midden in
   zijn werk opnieuw moet bevestigen. */
const VERS_MS = 15 * 60 * 1000;

/* Hoeveel apparaten we per account onthouden. Kort: het antwoord op "ken ik dit
   apparaat" hoeft geen jaar terug te gaan, en een lange lijst maakt van deze
   tabel alsnog een geschiedenis. */
const APPARATEN = 8;

const hash = (s) => crypto.createHash('sha256').update('rtg-vertrouwen:' + String(s || '')).digest('hex').slice(0, 32);

/* Bij het inloggen. `apparaat` is een ruwe aanduiding van de client die de
   aanroeper al heeft (lib/vingerafdruk.js); hij wordt hier gehasht en de ruwe
   waarde wordt nooit bewaard. */
function noteer(bak, sessie, { hoe, account, apparaat } = {}) {
  if (!bak || !sessie) return null;
  const m = MANIEREN[hoe] || MANIEREN.sleutel;
  bak.sessies = bak.sessies || {};
  bak.apparaten = bak.apparaten || {};

  let nieuw = null;
  if (account && apparaat) {
    const ak = hash('account:' + account);
    const dk = hash('apparaat:' + apparaat);
    const lijst = bak.apparaten[ak] || (bak.apparaten[ak] = []);
    nieuw = !lijst.includes(dk);
    if (nieuw) { lijst.push(dk); if (lijst.length > APPARATEN) lijst.splice(0, lijst.length - APPARATEN); }
  }
  bak.sessies[hash('sessie:' + sessie)] = { hoe: MANIEREN[hoe] ? hoe : 'sleutel', at: klokNu(), nieuw };
  return { hoe, sterkte: m.sterkte, apparaatNieuw: nieuw };
}

/* Bij een handeling. Levert null als deze sessie hier niet bekend is -- en dat
   is iets anders dan `sterkte: 'geen'`: null betekent "wij hebben het niet
   vastgelegd", 'geen' betekent "er staat aantoonbaar geen mens achter". Laag 3
   behandelt die twee verschillend, en dat hoort ook. */
function lees(bak, sessie) {
  const r = bak && bak.sessies && bak.sessies[hash('sessie:' + String(sessie || ''))];
  if (!r) return null;
  const m = MANIEREN[r.hoe] || MANIEREN.sleutel;
  const ouderdomMs = Math.max(0, klokNu() - r.at);
  return {
    hoe: r.hoe, naam: m.naam, sterkte: m.sterkte,
    ouderdomMs, vers: ouderdomMs <= VERS_MS,
    apparaatNieuw: r.nieuw === true
  };
}

/* Een sleutel zonder mens erachter. Geen opslag nodig: dit is geen waarneming
   maar een eigenschap van de deur. De aanroeper noemt alleen WELKE sleutel; de
   zin staat hier, zodat elke deur in dit huis hem hetzelfde formuleert. */
function zonderPersoon(deur) {
  return {
    hoe: 'sleutel', naam: MANIEREN.sleutel.naam, sterkte: 'geen',
    ouderdomMs: null, vers: false, apparaatNieuw: false,
    reden: 'Deze deur gaat open op ' + (deur || 'een sleutel') + ' en niet op een persoon.'
  };
}

function vergeetSessie(bak, sessie, account) {
  let weg = 0;
  if (bak && bak.sessies && sessie) { if (delete bak.sessies[hash('sessie:' + sessie)]) weg += 1; }
  if (bak && bak.apparaten && account) { if (delete bak.apparaten[hash('account:' + account)]) weg += 1; }
  return weg;
}

module.exports = { noteer, lees, zonderPersoon, vergeetSessie, MANIEREN, VERS_MS, APPARATEN };
