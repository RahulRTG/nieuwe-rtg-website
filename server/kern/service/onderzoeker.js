/* ============================================================================
   DE AI-ONDERZOEKER -- de derde rol van de AI in deze laag, en de enige die
   iets kan OPENEN.

   De eerste twee rollen bestaan al en vragen niets: de AI die een lid meteen
   helpt (kern/ai.js), en de AI die een zaak samenvat voor een medewerker. Die
   lezen alleen wat de ZAAK zelf draagt en dat is geen inzage in een mens.

   DE DERDE ROL IS DE GEVAARLIJKE. Bij "waarom is mijn boeking niet doorgekomen"
   is het antwoord niet te geven zonder in de boeking te kijken -- en dat is
   iemands gegeven, niet dat van de zaak. Het besluit van de eigenaar is:
   DAT MAG, MAAR ALLEEN NA BEVESTIGING DOOR HET LID. Dus geen aparte AI-poort en
   geen stille dienstsleutel: de AI vraagt langs DEZELFDE weg als een medewerker
   (./bevestiging.js), en het lid ziet dat er een machine vraagt.

   DRIE DINGEN DIE HIER NIET GEBEUREN, en waar de code op weigert:
     - de AI vraagt nooit iets dat het TEAM van de zaak niet nodig heeft. Dat
       versmalt de bevestiging al; de onderzoeker verruimt dat niet.
     - de AI krijgt nooit ZWAAR werk (./machtiging-grenzen.js). Dat vraagt een
       tweede MENS, en een machine kan die handtekening niet zetten -- dat
       vooraf weigeren is eerlijker dan hem laten wachten op een tekening die
       nooit komt.
     - de AI vraagt niet op eigen houtje. `mag()` zegt eerst WAT er zonder
       machtiging al te beantwoorden is; pas als het antwoord daar aantoonbaar
       niet in zit, is er iets te vragen. Anders vraagt een machine bij elke zaak
       standaard alles aan, en dan is de bevestigingsknop binnen een maand een
       reflex.
   ========================================================================== */
'use strict';

const { AI_VOOR, ZWAAR } = require('./machtiging-grenzen');
const router = require('./router');

/* Er is er EEN, en hij heet zo op het scherm van het lid. Geen verzonnen
   voornaam: wie een machine een mensennaam geeft, laat een lid iets bevestigen
   in de veronderstelling dat er een mens meekijkt. */
const NAAM = AI_VOOR + 'onderzoeker';
const TOONNAAM = 'RTG AI (onderzoeker)';

module.exports = function maakOnderzoeker({ zaken, loop, machtigingen, bevestiging, save }) {

  /* WAT DE AI ZONDER IETS AL HEEFT. Dit is de zaak zelf: wat de melder heeft
     opgeschreven en wat er sindsdien op de tijdlijn staat. Geen naam, geen
     gegeven van buiten de zaak -- `zaken.verwijzing()` heeft van het onderwerp
     al niet meer overgelaten dan een soort en een code. */
  function stof(zaakId) {
    const d = zaken.dossier(zaakId);
    if (d.error) return d;
    const z = d.zaak;
    return { ok: true, stof: {
      zaak: z.id, soort: z.soort, onderwerp: z.onderwerp, titel: z.titel,
      doelgroep: z.doelgroep, team: z.team,
      betrokken: z.betrokken || null,
      tijdlijn: (z.tijdlijn || []).filter(r => r.soort === 'bericht' || r.soort === 'stand')
    } };
  }

  /* WAT ER NOG NIET IS. De onderzoeker noemt per gevraagde capability of hij
     hem hier kan krijgen, en zo niet: waarom. Een lege lijst teruggeven zou
     hetzelfde zijn als "er valt niets te vragen", en dat is een ander antwoord. */
  function mag(zaakId, capabilities) {
    const z = zaken.vind(zaakId);
    if (!z) return { status: 404, error: 'Deze zaak kennen wij niet.' };
    const nodig = router.benodigd(z.team);
    const gevraagd = (Array.isArray(capabilities) ? capabilities : []).map(c => String(c || '').trim()).filter(Boolean);
    const uit = gevraagd.map(c => {
      if (ZWAAR[c]) return { capability: c, kan: false, waarom: 'Zwaar werk (' + ZWAAR[c] + ') vraagt een tweede MENS. Een AI kan die handtekening niet zetten, dus dit gaat langs een medewerker.' };
      if (!nodig.includes(c)) return { capability: c, kan: false, waarom: 'Het team ' + z.team + ' heeft dit voor deze zaak niet nodig. Zet de zaak eerst door.' };
      return { capability: c, kan: true, waarom: 'Dit kan, nadat het lid het in zijn app bevestigt.' };
    });
    return { ok: true, zaak: z.id, team: z.team, uitkomst: uit,
      teVragen: uit.filter(u => u.kan).map(u => u.capability) };
  }

  /* VRAGEN. Dezelfde weg als een medewerker, met de AI als zichtbare aanvrager.
     De reden is verplicht en wordt door het lid gelezen -- daarom draagt hij
     hier de zin dat er een machine vraagt, ook al staat de naam er los bij: een
     lid dat vlug leest, leest de reden. */
  function vraagToegang({ zaakId, capabilities, reden } = {}) {
    const k = mag(zaakId, capabilities);
    if (k.error) return k;
    if (!k.teVragen.length) {
      return { status: 403, error: 'Hier is voor de AI niets te vragen.', uitkomst: k.uitkomst };
    }
    const r = String(reden || '').trim();
    const v = bevestiging.vraag({
      zaakId, mens: NAAM, doel: 'Onderzoek door RTG AI',
      capabilities: k.teVragen,
      reden: 'RTG AI wil dit inzien om uw vraag te beantwoorden: ' + r
    });
    if (v.error) return v;
    /* Op de tijdlijn, en niet alleen in het bevestigingsregister: een lid dat
       later vraagt wie er in zijn zaak heeft gekeken, leest de tijdlijn.

       MAAR ALLEEN BIJ EEN NIEUW VERZOEK. De bevestiging hergebruikt een lopend
       verzoek; deze regel deed dat niet en schreef bij elke aanroep opnieuw.
       Gevonden met een kale ronde: de tweede aanroep veranderde de opslag
       terwijl er geen tweede verzoek ontstond -- een tijdlijn die vollooopt met
       een handeling die niet gebeurde. */
    if (v.hergebruikt) return Object.assign({}, v, { aanvrager: TOONNAAM, machine: true, nietGevraagd: k.uitkomst.filter(u => !u.kan) });
    try {
      const z = zaken.vind(zaakId);
      if (z) loop.noteer(z, { soort: 'notitie', van: 'systeem', wie: TOONNAAM,
        tekst: 'RTG AI heeft om toegang gevraagd (' + k.teVragen.join(', ') + '). Het lid beslist.' });
      if (z) save();
    } catch (e) {}
    return Object.assign({}, v, { aanvrager: TOONNAAM, machine: true, nietGevraagd: k.uitkomst.filter(u => !u.kan) });
  }

  /* LEZEN. Precies een aanroep, en hij gaat door dezelfde poort als een mens:
     `magNu()` rekent verval, intrekking en de tweede handtekening uit. De
     onderzoeker houdt er geen eigen oordeel naast -- dat is de plek waar een
     tweede waarheid ontstaat. */
  function poort(machtigingId, capability, { zaakId } = {}) {
    const p = machtigingen.magNu(machtigingId, capability, { zaakId });
    if (!p || !p.mag) return p;
    if (p.mens !== NAAM) {
      return { mag: false, waarom: 'Deze machtiging staat op naam van een mens. De AI leent die niet.' };
    }
    return p;
  }

  return { stof, mag, vraagToegang, poort, NAAM, TOONNAAM };
};
