/* ============================================================================
   WAT WE OVER DE AI AAN SCHERMEN EN ROUTES VERTELLEN.

   EEN EERLIJK CONTRACT, EN DAAROM APART. ./ai.js kiest een aanbieder en wijkt
   uit; dat is doen. Dit is VERANTWOORDEN: welke modus draait er, waar wordt
   verwerkt, kan dit huis beeld aan, en via welke aanbieder loopt dat dan.

   De belangrijkste regel staat in de eerste zin hieronder en is makkelijk te
   vergeten: beschikbaarheid zegt alleen of vrije modelverrijking mogelijk is,
   NOOIT of de onderliggende app werkt. Zonder model blijven alle kernprocessen
   in handmatige werkmodus beschikbaar -- daarom draagt dit antwoord ook
   `kernprocessen: 'beschikbaar'` en een `uitwijk` per soort werk. Een scherm
   dat hierop "de AI is uit, dus dit kan niet" bouwt, leest het verkeerd.

   PRIVACY IS HIER GEEN BIJZIN. Een eigen modelserver op dit apparaat, een eigen
   modelserver op het eigen netwerk en een externe aanbieder zijn drie
   verschillende beloftes aan een lid, en ze staan hier alle drie apart. Zodra
   er ook maar EEN externe aanbieder in de keten zit is het 'kan-extern-
   verwerken' -- niet 'lokaal met een randje'.
   ========================================================================== */
'use strict';
const { kompasStatus } = require('./ai-kompas');

/* Eén eerlijk contract voor schermen en routes. Beschikbaarheid zegt alleen of
   vrije modelverrijking mogelijk is; nooit of de onderliggende app werkt. */
function beschikbaarheid(ai) {
  const beschikbaar = !!(ai && ai.messages && typeof ai.messages.create === 'function');
  const kan = (params) => beschikbaar && (typeof ai.kan !== 'function' || ai.kan(params));
  const infos = beschikbaar && Array.isArray(ai.providerInfo) ? ai.providerInfo : [];
  const heeftLokaal = infos.some(x => x.lokaal) || (beschikbaar && ai.bron === 'lokaal');
  const heeftExtern = infos.some(x => !x.lokaal) || (beschikbaar && !infos.length && ai.bron !== 'lokaal');
  const lokaalViaNetwerk = infos.some(x => x.lokaal && x.verwerking === 'eigen-netwerk');
  const route = params => beschikbaar
    ? (typeof ai.routes === 'function' ? ai.routes(params) : (kan(params) ? (ai.aanbieders || []) : []))
    : [];
  const pTekst = { messages: [{ role: 'user', content: 'x' }] };
  const pTools = { tools: [{ name: 'doe' }], messages: [{ role: 'user', content: 'x' }] };
  const pBeeld = { messages: [{ role: 'user', content: [{ type: 'image' }, { type: 'text', text: 'x' }] }] };
  const hybride = heeftLokaal && heeftExtern;
  const lokaleGrens = lokaalViaNetwerk ? 'eigen-netwerk' : 'op-dit-apparaat';
  const modus = hybride ? 'hybride' : heeftLokaal ? 'lokaal' : beschikbaar ? 'ondersteund' : 'handmatig';
  const verwerking = hybride ? 'lokaal-met-externe-uitwijk' : heeftLokaal ? lokaleGrens : beschikbaar ? 'externe-provider' : 'geen-model';
  return {
    beschikbaar,
    modus,
    verwerking,
    privacy: hybride ? 'kan-extern-verwerken' : heeftLokaal ? lokaleGrens : beschikbaar ? 'externe-provider' : 'geen-model',
    aanbieders: beschikbaar && Array.isArray(ai.aanbieders) ? ai.aanbieders.slice() : [],
    mogelijkheden: {
      tekst: kan(pTekst),
      hulpmiddelen: kan(pTools),
      beeld: kan(pBeeld)
    },
    routes: { tekst: route(pTekst), hulpmiddelen: route(pTools), beeld: route(pBeeld) },
    kernprocessen: 'beschikbaar',
    uitwijk: {
      navigatie: 'menu-en-zoeken',
      uitvoering: 'schermen-en-workflows',
      samenvatten: 'lokale-extractie',
      beslissingen: 'menselijk-akkoord'
    },
    kompas: kompasStatus({ hybride, heeftLokaal, lokaleGrens, beschikbaar })
  };
}

module.exports = { beschikbaarheid };
