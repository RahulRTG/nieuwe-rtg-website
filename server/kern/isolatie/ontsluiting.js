/* DE ONTSLUITCEREMONIE -- verlagen is een protocol en geen veld.

   WAAROM DIT NIET `lockdown = false` IS. Een beveiligingsstand die met één
   schrijfactie omlaag kan, is precies zoveel waard als de zwakste weg naar die
   schrijfactie: een gestolen sessie, een te ruime rol, een AI die een route
   aanroept die niemand had ingedeeld. De stand verlagen is daarom een reeks
   stappen met een eigen toestand, en niet een parameter aan een bestaande route.

   DE REGEL DIE DE HELE VORM BEPAALT: HET VERZOEK VERLAAGT NIETS. Het verzoek
   verzamelt bewijs. Pas de laatste, geautoriseerde `commit` levert een nieuwe
   stand op -- en zelfs die schrijft hem hier niet weg, hij GEEFT hem terug.
   Zonder die scheiding ontstaan half-afgemaakte beveiligingstransities: een
   ceremonie die halverwege afbreekt en een stand achterlaat die niemand heeft
   gekozen. Dat is de gevaarlijkste toestand van deze hele laag, want hij ziet er
   van buiten uit als een besluit.

   DE EISEN VOLGEN UIT DE OVERGANG EN UIT DE DRAGER, en niet uit een instelling.
   Hoe hoger de drager (het huis raakt iedereen) en hoe verder de verlaging, hoe
   meer er nodig is. `onvergelijkbaar` uit ./ordening.js telt daarbij als de
   ZWAARSTE verlaging: een overgang die niemand heeft ingedeeld, krijgt niet het
   voordeel van de twijfel.

   VERSTRENGEN KENT GEEN CEREMONIE. Dat is de andere helft van SEC-LOCK-001 en
   het is geen vergetelheid: software mag beveiliging automatisch verhogen. Wie
   hier een drempel voor de veilige richting inbouwt, duwt mensen onder druk naar
   de onveilige (BESTUUR.md grens 6.10).

   WAT ER NIET IS, MET DE REDEN. De stappen `passkey` en `apparaat` worden hier
   AFGETEKEND en niet UITGEVOERD: het bewijs komt van server/webauthn/ en
   kern/webauthn-stapop.js, en die twee horen niet vanuit een ceremoniemodule te
   worden aangeroepen -- dan zou deze module zelf kunnen besluiten dat er is
   ingelogd. Hij eist een verwijzing naar een bewijs dat elders is geleverd. */
'use strict';

const crypto = require('crypto');

/* De stappen die een ceremonie kan eisen. Elk met wie hem levert, want een
   stap die het systeem zelf kan afvinken is geen stap. */
const STAPPEN = Object.freeze({
  reden:        { wie: 'de aanvrager', wat: 'een concrete reden van minimaal 8 tekens' },
  passkey:      { wie: 'server/webauthn', wat: 'een geslaagde WebAuthn-bevestiging, buiten deze module' },
  apparaat:     { wie: 'de sessie', wat: 'de handeling komt van een apparaat dat al vertrouwd was' },
  wachttijd:    { wie: 'de klok', wat: 'een afkoelperiode waarin het verzoek zichtbaar openstaat' },
  tweedePaarOgen: { wie: 'een tweede mens', wat: 'een andere actor dan de aanvrager keurt goed' }
});

/* Hoe lang de afkoelperiode duurt, per drager. Het huis raakt iedereen en
   krijgt de langste; een lid dat zijn eigen isolatie opheft, wordt niet een uur
   uit zijn eigen account gehouden. */
const WACHTTIJD_MINUTEN = Object.freeze({ huis: 60, organisatie: 30, identiteit: 10, sessie: 0, apparaat: 0 });

function maakOntsluiting({ opslag, save, klok, ordening }) {
  const nu = () => (klok && klok.datum ? klok.datum() : new Date());

  function fout(status, tekst) { const e = new Error(tekst); e.status = status; throw e; }

  /* WELKE EISEN GELDEN. Puur: dezelfde overgang geeft altijd hetzelfde antwoord,
     zodat een scherm hem vooraf kan tonen. Een mens die pas halverwege hoort dat
     er een tweede paar ogen bij moet, wacht een uur voor niets. */
  function eisenVoor({ drager, van, naar }) {
    const stap = ordening.verlaagt(van, naar);
    if (!stap.verlaagt) {
      return { verlaagt: false, eisen: [], waarom: 'dit verstrengt of laat gelijk; verhogen kent geen ceremonie' };
    }
    const eisen = ['reden', 'passkey'];
    const zwaar = !stap.zeker || String(van) === 'isolatie' || String(van) === 'beschermd';
    if (zwaar) eisen.push('apparaat');
    if ((WACHTTIJD_MINUTEN[drager] || 0) > 0 && zwaar) eisen.push('wachttijd');
    if (drager === 'huis' || drager === 'organisatie') eisen.push('tweedePaarOgen');
    return {
      verlaagt: true, zeker: stap.zeker, eisen,
      wachttijdMinuten: eisen.includes('wachttijd') ? WACHTTIJD_MINUTEN[drager] : 0,
      waarom: stap.zeker
        ? 'dit verlaagt de stand van ' + van + ' naar ' + naar
        : 'deze overgang is niet te ordenen en telt daarom als de zwaarste verlaging'
    };
  }

  function lijst() { return opslag.tak('ontsluitingen'); }
  function vind(id) { return lijst().find(v => v.id === String(id)) || null; }

  /* START. Bewaart een verzoek en verandert GEEN stand. */
  function start({ drager, sleutel, van, naar, door, reden }) {
    const eis = eisenVoor({ drager, van, naar });
    if (!eis.verlaagt) fout(400, 'Deze overgang verlaagt niets; verstrengen gaat zonder ceremonie.');
    const schoon = String(reden || '').trim().replace(/\s+/g, ' ').slice(0, 240);
    if (schoon.length < 8) fout(400, 'Geef een concrete reden van minimaal 8 tekens.');

    const verzoek = {
      id: crypto.randomBytes(8).toString('hex'),
      drager: String(drager), sleutel: sleutel ? String(sleutel).slice(0, 64) : null,
      van: String(van), naar: String(naar),
      aangevraagdDoor: String(door || 'onbekend').slice(0, 64),
      gestart: nu().toISOString(),
      vereisten: eis.eisen,
      wachttijdMinuten: eis.wachttijdMinuten,
      voltooid: { reden: { at: nu().toISOString(), door: String(door || 'onbekend').slice(0, 64) } },
      reden: schoon,
      status: 'open',
      /* HET VERZOEK ZELF VERLAAGT NIETS, en dat staat in het object zodat een
         scherm het kan tonen zonder het te moeten weten. */
      effectNu: 'geen: de stand blijft ' + String(van) + ' tot de commit slaagt'
    };
    lijst().unshift(verzoek);
    if (save) save();
    return openbaar(verzoek);
  }

  /* EEN STAP AFTEKENEN. Het bewijs komt van elders; hier wordt het genoteerd. */
  function stap(id, { soort, door, bewijs }) {
    const v = vind(id);
    if (!v) fout(404, 'Onbekend ontsluitverzoek.');
    if (v.status !== 'open') fout(409, 'Dit verzoek is al ' + v.status + '.');
    if (!STAPPEN[soort]) fout(400, 'Onbekende stap: ' + soort);
    if (!v.vereisten.includes(soort)) fout(400, 'Deze ceremonie vraagt geen stap "' + soort + '".');
    if (soort === 'wachttijd') fout(400, 'De wachttijd wordt niet afgetekend maar verstreken; de klok doet dat.');

    /* HET TWEEDE PAAR OGEN IS EEN ANDER PAAR. Zonder deze regel is vier ogen een
       formaliteit die dezelfde mens twee keer uitvoert. */
    if (soort === 'tweedePaarOgen' && String(door || '') === v.aangevraagdDoor) {
      fout(403, 'Het tweede paar ogen hoort van iemand anders te zijn dan de aanvrager.');
    }
    /* DE EERSTE AFTEKENING BLIJFT STAAN. Dezelfde stap nog eens aftekenen
       overschreef hier het tijdstip, en dan verschuift het moment waarop het
       bewijs geleverd wérd -- precies het gegeven waar een wachttijd en een
       onderzoek achteraf aan hangen. Een herhaling verandert dus niets. */
    if (!v.voltooid[soort]) {
      v.voltooid[soort] = { at: nu().toISOString(), door: String(door || 'onbekend').slice(0, 64),
        bewijs: bewijs ? String(bewijs).slice(0, 120) : null };
    }
    if (save) save();
    return openbaar(v);
  }

  function wachttijdVerstreken(v) {
    if (!v.wachttijdMinuten) return true;
    return (nu().getTime() - new Date(v.gestart).getTime()) >= v.wachttijdMinuten * 60000;
  }

  function ontbreekt(v) {
    return v.vereisten.filter(e => (e === 'wachttijd' ? !wachttijdVerstreken(v) : !v.voltooid[e]));
  }

  /* DE COMMIT. Geeft de nieuwe stand TERUG; hij schrijft hem niet weg. De
     aanroeper zet hem, en die aanroeper is de enige plek waar een stand
     verandert -- zie ./index.js. */
  function commit(id, { door }) {
    const v = vind(id);
    if (!v) fout(404, 'Onbekend ontsluitverzoek.');
    if (v.status !== 'open') fout(409, 'Dit verzoek is al ' + v.status + '.');
    const open = ontbreekt(v);
    if (open.length) fout(409, 'Deze ceremonie is nog niet rond: ' + open.join(', ') + ' ontbreekt nog.');
    v.status = 'voltooid';
    v.voltooidOp = nu().toISOString();
    v.voltooidDoor = String(door || 'onbekend').slice(0, 64);
    if (save) save();
    return { verzoek: openbaar(v), nieuweStand: v.naar, drager: v.drager, sleutel: v.sleutel };
  }

  function afbreken(id, { door, reden }) {
    const v = vind(id);
    if (!v) fout(404, 'Onbekend ontsluitverzoek.');
    if (v.status !== 'open') fout(409, 'Dit verzoek is al ' + v.status + '.');
    v.status = 'afgebroken';
    v.afgebroken = { at: nu().toISOString(), door: String(door || 'onbekend').slice(0, 64),
      reden: String(reden || '').slice(0, 240) };
    if (save) save();
    return openbaar(v);
  }

  function openbaar(v) {
    return Object.assign({}, v, {
      ontbreekt: v.status === 'open' ? ontbreekt(v) : [],
      wachttijdVerstreken: wachttijdVerstreken(v)
    });
  }

  function open() { return lijst().filter(v => v.status === 'open').map(openbaar); }

  return { STAPPEN, WACHTTIJD_MINUTEN, eisenVoor, start, stap, commit, afbreken, open, vind: id => {
    const v = vind(id); return v ? openbaar(v) : null; } };
}

module.exports = { maakOntsluiting, STAPPEN, WACHTTIJD_MINUTEN };
