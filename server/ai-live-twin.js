/* RTG Live Twin maakt van een AI-beurt een controleerbaar beslispakket.
   Alle vertrouwensvelden komen uit applicatieregels en sessiecontext, nooit uit
   modeltekst. Zo kan een model wel formuleren, maar geen bron, bevoegdheid,
   uitvoering of menselijke goedkeuring veinzen. */
'use strict';
const crypto = require('node:crypto');

const KENNIS = [
  { id: 'menselijke-grens', woorden: /betaal|geld|boek|public|toegang|contract|toezegg|goedkeur/i,
    titel: 'Menselijke beslisgrens', detail: 'Geld, publicatie, toegang en definitieve toezegging vereisen afzonderlijk akkoord.' },
  { id: 'omkeerbaar-voorbereiden', woorden: /plan|voorbereid|route|vergelijk|simuleer|optimaliseer/i,
    titel: 'Veilig voorbereiden', detail: 'Zoeken, vergelijken en voorbereiden mag binnen de huidige rol; uitvoering blijft apart.' },
  { id: 'minimale-context', woorden: /./,
    titel: 'Minimale context', detail: 'Alleen de actieve werkcontext en de gegevens binnen de huidige rol worden gecombineerd.' }
];

const DOMEINBRONNEN = [
  [/omzet|dagtotaal|kassa|revenue/i, 'Lokale dagomzet', 'Kassa- en ontvangstregister van deze organisatie'],
  [/kamer|room|schoon|vuil|defect/i, 'Lokale kamerstatus', 'Actuele operationele status binnen deze zaak'],
  [/klus|onderhoud|ticket/i, 'Lokaal onderhoudsregister', 'Open werk en storingen binnen deze zaak'],
  [/gast|onderweg|eta/i, 'Toegestane gaststatus', 'Alleen de live-status die met deze zaak is gedeeld'],
  [/bericht|chat|onbeantwoord/i, 'Lokale communicatie', 'Berichten binnen de huidige organisatie en rol'],
  [/minibar/i, 'Lokale minibarregistratie', 'Tellingen van vandaag binnen deze zaak'],
  [/bestelling|order|bon/i, 'Lokaal orderregister', 'Open operationele bestellingen van deze zaak'],
  [/rooster|dienst|schedule|shift/i, 'Lokaal rooster', 'Planning die voor deze organisatie beschikbaar is']
];

function kort(waarde, max) {
  return String(waarde == null ? '' : waarde).replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);
}

function veiligeContext(context, vraag) {
  if (context && typeof context === 'object') {
    const app = kort(context.app, 50), deel = kort(context.deel, 70), selectie = kort(context.selectie, 70);
    return [app, deel, selectie].filter(Boolean).join(' · ').slice(0, 160);
  }
  const hit = String(vraag || '').match(/Actieve context:\s*([^\n]{1,160})/i);
  return hit ? kort(hit[1], 160) : '';
}

function domeinBron(vraag, wereld) {
  if (wereld !== 'supplier' && wereld !== 'staff') return null;
  const hit = DOMEINBRONNEN.find(([patroon]) => patroon.test(vraag));
  return hit ? { id: 'operationele-bron', soort: 'lokale-data', label: hit[1], detail: hit[2], status: 'server-bepaald' } : null;
}

function maakLiveTwin({ vraag, context, wereld, actor, stand, gedaan, goedkeuringen }) {
  const tekst = kort(vraag, 500);
  const scherm = veiligeContext(context, tekst);
  const voorstellen = Array.isArray(goedkeuringen) ? goedkeuringen : [];
  const uitgevoerd = gedaan === true;
  const kompas = stand && stand.kompas || {};
  const route = kort(kompas.route || stand && stand.modus || 'regels', 40);
  const privacy = kort(kompas.privacy || stand && stand.verwerking || 'Geen inhoud naar een model', 140);
  const rol = kort(actor || wereld || 'huidige sessie', 70);
  const bronnen = [
    { id: 'rolgrens', soort: 'serverregel', label: 'Bevoegdheidsgrens', detail: 'Alleen toegang van ' + rol, status: 'server-bepaald' },
    { id: 'modelroute', soort: 'runtime', label: 'Verwerkingsroute', detail: privacy, status: 'server-bepaald' }
  ];
  if (scherm) bronnen.unshift({ id: 'schermcontext', soort: 'client-context', label: 'Actieve werkruimte', detail: scherm, status: 'context' });
  const domein = domeinBron(tekst, wereld);
  if (domein) bronnen.unshift(domein);
  const kennis = KENNIS.filter(k => k.woorden.test(tekst)).slice(0, 2).map(k => ({
    id: k.id, soort: 'rtg-beleid', label: k.titel, detail: k.detail, status: 'server-bepaald'
  }));
  for (const bron of kennis) if (!bronnen.some(b => b.id === bron.id)) bronnen.push(bron);

  const wacht = voorstellen.length > 0;
  const status = wacht ? 'menselijk-akkoord' : uitgevoerd ? 'uitgevoerd-en-gelogd' : 'voorbereid';
  const nu = wacht ? 'Exact voorstel klaar voor controle'
    : uitgevoerd ? 'Opdracht uitgevoerd via de toegestane workflow'
    : 'Antwoord en veilige route zijn voorbereid';
  const straks = wacht ? 'Controleer gevolg en bevestig éénmalig'
    : uitgevoerd ? 'Controleer het logboek en het resultaat'
    : 'Kies zelf of een vervolgstap nodig is';
  const letOp = wacht ? 'Uitvoering blijft geblokkeerd tot uw akkoord'
    : uitgevoerd ? 'Alleen de gemelde workflow is uitgevoerd'
    : 'Er is niets gewijzigd of definitief toegezegd';
  const idBasis = [wereld, route, scherm, tekst.slice(0, 120), status].join('|');

  return {
    schema: 'rtg.live-twin/1',
    pakketId: crypto.createHash('sha256').update(idBasis).digest('hex').slice(0, 12),
    status, route, autoriteit: 'mens',
    ritme: { nu, straks, letOp },
    reden: wacht ? 'De gevraagde route raakt een beschermde beslisgrens.'
      : uitgevoerd ? 'De applicatie bevestigt dat de toegestane workflow is afgerond.'
      : 'Voorbereiden en adviseren kan zonder een onomkeerbare stap te zetten.',
    gevolg: wacht ? voorstellen.length + ' voorstel(len) wachten; nog niets uitgevoerd.'
      : uitgevoerd ? 'De uitvoering is door de server bevestigd en hoort in het logboek.'
      : 'Geen wijziging, betaling, publicatie of toezegging is uitgevoerd.',
    voorgesteldeActie: wacht ? 'Controleer het exacte voorstel' : uitgevoerd ? 'Bekijk het resultaat' : 'Beslis of u verder wilt',
    mensBeslist: wacht || !uitgevoerd,
    uitvoering: { status: uitgevoerd ? 'bevestigd' : 'niet-uitgevoerd', voorstellen: voorstellen.length },
    bronnen: bronnen.slice(0, 5)
  };
}

module.exports = { maakLiveTwin, _intern: { veiligeContext, domeinBron } };
