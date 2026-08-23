/* De onafhankelijke statusassen en klanttijdlijn van RTG Eten. */
'use strict';

const OPEN_KANALEN = ['bezorging', 'afhaal'];
const REGEL_STAND = ['besteld', 'gestart', 'bereid', 'klaar', 'uitgegeven'];
const bedrag = v => Math.round(Math.max(0, Number(v) || 0));
const tijd = v => v ? String(v).slice(11, 16) : null;
const laatste = (lijst, veld) => lijst.map(x => x && x[veld]).filter(Boolean).sort().pop() || null;

function totalen(rek) {
  const bruto = (rek.regels || []).reduce((n, r) => n + bedrag(r.centen) * Math.max(1, Number(r.aantal) || 1), 0);
  let korting = 0;
  for (const k of (rek.kortingen || [])) korting += k.procent ? Math.round(bruto * Number(k.procent) / 100) : bedrag(k.centen);
  korting = Math.min(bruto, korting);
  const fooi = bedrag(rek.fooiCenten);
  const betaald = (rek.betalingen || []).reduce((n, b) => n + bedrag(b.centen), 0);
  return { bruto, korting, fooi, totaal:bruto - korting + fooi, betaald,
    openstaand:bruto - korting + fooi - betaald, valuta:'EUR' };
}

function productieVan(regels) {
  const werk = regels.filter(r => !r.bezorgkosten);
  if (!werk.length) return 'wacht';
  if (werk.every(r => r.stand === 'uitgegeven')) return 'overgedragen';
  if (werk.every(r => r.stand === 'klaar' || r.stand === 'uitgegeven')) return 'klaar';
  if (werk.some(r => r.stand === 'klaar')) return 'bijna-klaar';
  if (werk.some(r => ['gestart','bereid'].includes(r.stand))) return 'in-bereiding';
  return 'wacht';
}

function acceptatieVan(rek, regels) {
  if (rek.status === 'oninbaar' || rek.status === 'geannuleerd') return 'geweigerd';
  if (regels.some(r => r.bevestiging === 'wacht')) return 'controle';
  if (rek.geaccepteerdAt || regels.some(r => ['gestart','bereid','klaar','uitgegeven'].includes(r.stand))) return 'geaccepteerd';
  return 'ontvangen';
}

function betalingVan(rek, t) {
  if (rek.status === 'terugbetaald' || rek.betaalStatus === 'terugbetaald') return 'terugbetaald';
  if (t.openstaand <= 0 || rek.betaalStatus === 'bevestigd') return 'betaald';
  if (rek.betaalSlot || ['wacht','processing','in-behandeling'].includes(rek.betaalStatus)) return 'in-behandeling';
  return 'openstaand';
}

function fulfillmentVan(rek, productie) {
  const expliciet = rek.fulfillment && rek.fulfillment.status;
  if (expliciet) return expliciet;
  const bron = rek.kanaal === 'bezorging' ? rek.bezorg : rek.afhaal;
  const stand = bron && bron.stand;
  if (['geleverd','bezorgd'].includes(stand)) return 'geleverd';
  if (stand === 'onderweg') return 'onderweg';
  if (['overgedragen','opgehaald','uitgegeven'].includes(stand)) return rek.kanaal === 'afhaal' ? 'opgehaald' : 'overgedragen';
  if (productie === 'klaar' || productie === 'overgedragen') return 'klaar-voor-overdracht';
  return rek.kanaal === 'bezorging' ? 'bezorging-gepland' : 'afhaal-gepland';
}

function incidentVan(rek, regels) {
  if (rek.incident && !rek.incident.opgelostAt) return 'open';
  if (regels.some(r => r.bevestiging === 'wacht')) return 'persoonlijke-controle';
  if (regels.some(r => Array.isArray(r.correcties) && r.correcties.length)) return 'gecorrigeerd';
  return 'geen';
}

function hoofdfase(assen) {
  if (assen.acceptatie === 'geweigerd') return 'geannuleerd';
  if (assen.fulfillment === 'geleverd' || assen.fulfillment === 'opgehaald') return 'geleverd';
  if (assen.fulfillment === 'onderweg') return 'onderweg';
  if (['overgedragen','klaar-voor-overdracht'].includes(assen.fulfillment)) return 'klaar';
  if (assen.productie === 'klaar' || assen.productie === 'bijna-klaar') return 'bijna-klaar';
  if (assen.productie === 'in-bereiding') return 'keuken';
  if (assen.acceptatie === 'geaccepteerd') return 'bevestigd';
  return 'ontvangen';
}

const FASE_TEKST = {
  ontvangen:['Ontvangen','De bestelling staat veilig bij de zaak.'],
  bevestigd:['Bevestigd','De zaak heeft de bestelling aangenomen.'],
  keuken:['In de keuken','De gerechten worden bereid en op elkaar afgestemd.'],
  'bijna-klaar':['Bijna klaar','De laatste onderdelen worden gecontroleerd en verpakt.'],
  klaar:['Klaar','De bestelling wacht op een zorgvuldige overdracht.'],
  onderweg:['Onderweg','De bezorger is met de bestelling onderweg.'],
  geleverd:['Geleverd','De bestelling is afgerond. Eet smakelijk.'],
  geannuleerd:['Niet doorgegaan','Deze bestelling is gestopt. Bekijk het logboek voor de reden.']
};

function tijdlijnVan(rek, assen, fase) {
  const regels = (rek.regels || []).filter(r => !r.bezorgkosten);
  const klaarAt = laatste(regels, 'klaarAt'), uitAt = laatste(regels, 'uitAt');
  const gebeurtenissen = [
    { id:'ontvangen', label:'Ontvangen', at:rek.geopendAt || rek.at, klaar:regels.length > 0 },
    { id:'bevestigd', label:'Bevestigd', at:rek.geaccepteerdAt || (assen.acceptatie === 'geaccepteerd' ? laatste(regels, 'at') : null), klaar:assen.acceptatie === 'geaccepteerd' },
    { id:'keuken', label:'Keuken', at:laatste(regels, 'startAt'), klaar:['in-bereiding','bijna-klaar','klaar','overgedragen'].includes(assen.productie) },
    { id:'bijna-klaar', label:'Bijna klaar', at:klaarAt, klaar:['bijna-klaar','klaar','overgedragen'].includes(assen.productie) },
    { id:'klaar', label:'Klaar', at:klaarAt, klaar:['klaar','overgedragen'].includes(assen.productie) },
    { id:'onderweg', label:rek.kanaal === 'afhaal' ? 'Afgehaald' : 'Onderweg', at:(rek.fulfillment && rek.fulfillment.onderwegAt) || (assen.fulfillment === 'opgehaald' ? uitAt : null), klaar:['onderweg','geleverd','opgehaald'].includes(assen.fulfillment) },
    { id:'geleverd', label:rek.kanaal === 'afhaal' ? 'Afgerond' : 'Geleverd', at:(rek.fulfillment && rek.fulfillment.geleverdAt) || (assen.fulfillment === 'opgehaald' ? uitAt : null), klaar:['geleverd','opgehaald'].includes(assen.fulfillment) }
  ];
  return gebeurtenissen.map(g => Object.assign(g, { actief:g.id === fase, om:tijd(g.at) }));
}

function resterendeMinuten(h, regels, menu) {
  const kaart = new Map((menu || []).map(m => [String(m.id), m]));
  let totaal = 0;
  for (const r of regels) {
    if (r.bezorgkosten || r.stand === 'klaar' || r.stand === 'uitgegeven') continue;
    const m = kaart.get(String(r.itemId || ''));
    const basis = Number(r.prepMin || (m && m.prepMin)) || (r.station === 'bar' ? 3 : 12);
    totaal += (r.stand === 'gestart' || r.stand === 'bereid' ? Math.ceil(basis / 2) : basis) * Math.max(1, Number(r.aantal) || 1);
  }
  return Math.max(0, Math.ceil(totaal / Math.max(1, Number((h.instel || {}).kokken) || 3)));
}

module.exports = { OPEN_KANALEN, REGEL_STAND, totalen, productieVan, acceptatieVan,
  betalingVan, fulfillmentVan, incidentVan, hoofdfase, FASE_TEKST, tijdlijnVan, resterendeMinuten };
