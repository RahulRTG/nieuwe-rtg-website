/* ============================================================================
   MIJN RTG blok 4: HET BEZITSBEWIJS -- een token dat op zichzelf niets waard is.

   HET PROBLEEM. Een sessietoken is een DRAGERSBEWIJS: wie hem heeft, mag alles
   wat de eigenaar mag. Onderschept iemand hem -- uit een logregel, een gedeelde
   computer, een verkeerd gekopieerde header -- dan is hij die persoon, tot het
   token verloopt. Alle bewijs uit blok 1 tot 3 (welke authenticator, welk
   toestel, welke context) beschrijft hoe de sessie ONTSTOND en houdt zo iemand
   daarna niet tegen.

   DE OPLOSSING is bekend uit DPoP (RFC 9449): laat de client bij elk verzoek
   bewijzen dat hij de bijbehorende private sleutel bezit. Dit is DPoP niet --
   er is geen access token met een cnf-claim en geen OAuth eromheen -- maar het
   idee en de vorm zijn ervan geleend, en dat hoort erbij te staan in plaats van
   dat het hier "onze eigen beveiliging" heet.

   De sleutel is er al: het toestel-sleutelpaar uit blok 3, gemaakt met
   `extractable: false`. Precies daarom werkt dit -- een gestolen token levert
   niets op zonder een sleutel die het toestel niet kan verlaten.

   NIET OVERAL, EN DAT IS EEN BESLUIT. Elk verzoek laten ondertekenen kost
   rekentijd op de telefoon en breekt elke client die het nog niet kan. De
   zwaarte hoort bij het risico: een menukaart lezen is iets anders dan geld
   verplaatsen of een herstelroute wijzigen. PADEN hieronder is die lijst, met
   per regel de reden -- en niets staat er "voor de zekerheid" bij.

   DRIE STANDEN, EN HIJ BEGINT IN DE SCHADUW. CONTROLPLANE.md is hier expliciet:
   een nieuwe handhavingsregel loopt eerst mee zonder te blokkeren, want je kunt
   niet afdwingen wat nooit in de schaduw heeft gelopen. Dat is geen
   voorzichtigheid maar noodzaak -- zet je dit meteen hard aan, dan weigert de
   eerste echte betaling van het eerste lid dat zijn toestel bond, omdat een
   scherm de kop nog niet meestuurde.

     schaduw      (standaard) weigert NOOIT. Rekent wel uit wat er zou zijn
                  gebeurd en geeft dat terug, zodat de dekking meetbaar is
                  voordat iemand hem aanzet.
     aanbevolen   weigert een sessie die WEL een sleutelbinding heeft en geen
                  bewijs meestuurt. Een gestolen token uit zo'n sessie is
                  daarmee waardeloos. Een sessie zonder binding komt er nog
                  langs -- dat is een echt gat en geen detail, dus het staat in
                  het antwoord als `nietAfgedwongen`.
     verplicht    sluit dat gat: zonder gebonden toestel geen zware handeling.

   De stand komt uit RTG_BEZITSBEWIJS en valt terug op `schaduw`. Een onbekende
   waarde valt OOK terug op schaduw en zegt dat: een typefout in een
   omgevingsvariabele hoort geen beveiliging aan of uit te zetten.
   ========================================================================== */
'use strict';

const { klopt } = require('./toestelsleutels');
const klok = require('../../lib/klok');

/* Hoe ver een bewijs mag afwijken van onze klok. Ruim genoeg voor een trage
   verbinding en een scheve telefoonklok, krap genoeg dat een onderschept bewijs
   niet de hele middag bruikbaar is. */
const SPELING_MS = 90 * 1000;

/* WELKE PADEN, EN WAAROM. Alleen handelingen waarbij een gestolen token echte,
   moeilijk terug te draaien schade doet. Wie hier iets bij zet, schrijft de
   reden erbij -- een lijst zonder redenen groeit tot hij overal staat en dan is
   de zwaarte weer betekenisloos. */
const PADEN = [
  { pad: '/api/pay/', reden: 'geld verplaatsen' },
  { pad: '/api/betaal/', reden: 'geld verplaatsen' },
  { pad: '/api/wallet/', reden: 'tegoed en passen' },
  { pad: '/api/bank/', reden: 'bankhandelingen' },
  { pad: '/api/auth/password', reden: 'het wachtwoord wijzigen zet alle andere sessies eruit' },
  { pad: '/api/webauthn/registreer', reden: 'een nieuwe passkey is een nieuwe sleutel tot het account' },
  { pad: '/api/webauthn/weg', reden: 'een passkey verwijderen haalt een herstelroute weg' },
  { pad: '/api/mijn/toestel/introk', reden: 'een toestel intrekken sluit sessies' },
  { pad: '/api/privacy/delete', reden: 'onomkeerbaar' },
  { pad: '/api/rtgid/machtig', reden: 'iemand anders bevoegdheid geven' }
];

const zwaarPad = (pad) => PADEN.find(p => String(pad || '').startsWith(p.pad)) || null;

const STANDEN = ['schaduw', 'aanbevolen', 'verplicht'];
function standNu() {
  const v = String(process.env.RTG_BEZITSBEWIJS || '').trim().toLowerCase();
  if (!v) return { stand: 'schaduw', reden: 'niet ingesteld' };
  if (!STANDEN.includes(v)) return { stand: 'schaduw', reden: 'onbekende waarde "' + v + '"; teruggevallen op schaduw' };
  return { stand: v, reden: 'ingesteld' };
}

function maakBezitsbewijs({ db, save, toestellen }) {
  /* De gebruikte bewijzen liggen in de DATABASE en niet in het geheugen van een
     proces. Dit huis draait meerdere werkprocessen; een lijst per proces
     betekent dat hetzelfde bewijs op het tweede proces gewoon nog werkt, en dan
     is de herhaalbescherming een gebaar. */
  const eigen = require('../eigencollectie')({ db, domein: 'kern/identiteit',
    bezit: { bezitsbewijzen: 'kaart' } });
  const gebruikt = () => eigen.bak('bezitsbewijzen');

  function alGebruikt(jti) {
    const kast = gebruikt();
    const nu = klok.nu();
    for (const [k, t] of Object.entries(kast)) if (Number(t) < nu) delete kast[k];
    if (kast[jti]) return true;
    kast[jti] = nu + SPELING_MS * 2;
    save();
    return false;
  }

  /* De uitkomst is met opzet geen ja/nee maar een STAND met een reden, zoals de
     acht uitkomsten van CONTROLPLANE.md. `onbekend` en `geweigerd` zijn niet
     hetzelfde: een ontbrekend bewijs op een onbeschermde sessie is geen
     overtreding, en hoort niet als overtreding te klinken. */
  async function controleer({ sess, methode, pad, kop, stand }) {
    const zwaar = zwaarPad(pad);
    if (!zwaar) return { stand: 'nvt' };
    const werkelijk = stand || standNu().stand;
    const uit = await beoordeel({ sess, methode, pad, kop, stand: werkelijk === 'schaduw' ? 'aanbevolen' : werkelijk, zwaar });
    /* IN DE SCHADUW WEIGEREN WIJ NOOIT. Het oordeel wordt wel volledig
       uitgerekend en teruggegeven, want anders meet je niets en blijft de stand
       voor altijd op schaduw staan omdat niemand weet wat er zou gebeuren. */
    if (werkelijk === 'schaduw' && uit.stand === 'geweigerd') {
      return { stand: 'schaduw', zouZijn: 'geweigerd', reden: uit.reden, waarom: zwaar.reden };
    }
    return uit;
  }

  async function beoordeel({ sess, methode, pad, kop, stand, zwaar }) {

    const binding = sess && sess.sessieContext && sess.sessieContext.sleutelbinding;
    const toestelId = binding && binding.keyRef;
    if (!toestelId) {
      if (stand === 'verplicht') {
        return { stand: 'geweigerd', code: 403,
          reden: 'Deze handeling vraagt een toestel dat zijn sleutel kan aantonen. Bevestig dit toestel in "Waar ben ik aanwezig".' };
      }
      return { stand: 'onbeschermd', waarom: zwaar.reden,
        nietAfgedwongen: 'Deze sessie heeft geen sleutelbinding, dus een gestolen token zou hier wel doorheen komen. Bevestig dit toestel om dat te sluiten.' };
    }

    if (!kop) {
      return { stand: 'geweigerd', code: 401,
        reden: 'Deze sessie is aan een sleutel gebonden, dus deze handeling vraagt een bezitsbewijs. Vernieuw de pagina en probeer opnieuw.' };
    }

    const delen = String(kop).split('.');
    if (delen.length !== 2) return { stand: 'geweigerd', code: 401, reden: 'Onleesbaar bezitsbewijs.' };
    let lading;
    try { lading = JSON.parse(Buffer.from(delen[0], 'base64url').toString()); }
    catch (e) { return { stand: 'geweigerd', code: 401, reden: 'Onleesbaar bezitsbewijs.' }; }
    if (!lading || typeof lading !== 'object') return { stand: 'geweigerd', code: 401, reden: 'Onleesbaar bezitsbewijs.' };

    /* DE HANDELING ZIT IN DE HANDTEKENING. Zonder methode en pad zou een bewijs
       dat is afgegeven om een saldo te LEZEN, ook een overboeking kunnen
       dekken -- en dan bewijst het alleen nog dat het toestel er ooit was. */
    if (String(lading.methode || '').toUpperCase() !== String(methode || '').toUpperCase()) {
      return { stand: 'geweigerd', code: 401, reden: 'Dit bezitsbewijs hoort bij een andere handeling.' };
    }
    if (String(lading.pad || '') !== String(pad || '')) {
      return { stand: 'geweigerd', code: 401, reden: 'Dit bezitsbewijs hoort bij een ander adres.' };
    }
    const afwijking = Math.abs(klok.nu() - Number(lading.tijd || 0));
    if (!Number.isFinite(afwijking) || afwijking > SPELING_MS) {
      return { stand: 'geweigerd', code: 401, reden: 'Dit bezitsbewijs is te oud of ligt in de toekomst.' };
    }
    if (typeof lading.jti !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(lading.jti)) {
      return { stand: 'geweigerd', code: 401, reden: 'Onleesbaar bezitsbewijs.' };
    }

    const jwk = toestellen && typeof toestellen.publiekeSleutelVan === 'function'
      ? toestellen.publiekeSleutelVan(sess.key, toestelId) : null;
    if (!jwk) {
      return { stand: 'geweigerd', code: 403,
        reden: 'Het toestel van deze sessie is niet meer bekend of ingetrokken. Log opnieuw in.' };
    }

    const ok = await klopt(jwk, delen[0], Buffer.from(delen[1], 'base64url'));
    if (!ok) return { stand: 'geweigerd', code: 401, reden: 'Het bezitsbewijs klopt niet bij het toestel van deze sessie.' };

    /* Herhaling pas NA de handtekening: anders kan iemand met onzin-bewijzen de
       lijst volpompen zonder ooit een sleutel te bezitten. */
    if (alGebruikt(lading.jti)) {
      return { stand: 'geweigerd', code: 401, reden: 'Dit bezitsbewijs is al gebruikt.' };
    }
    return { stand: 'bewezen', waarom: zwaar.reden };
  }

  return { controleer, zwaarPad, standNu, PADEN, SPELING_MS };
}

module.exports = { maakBezitsbewijs, PADEN, zwaarPad, SPELING_MS };
