/* Horeca (kern): EEN WIJK OVERDRAGEN terwijl er gasten aan tafel zitten.

   DE VRAAG VAN VLOER is niet "wat moet ik nu doen" maar "wie heeft ons nú
   nodig, en hoe verdelen we dat". Het eerste deel stond er al: het wijkbeeld
   telt per wijk hoeveel er open staat en wie hem draagt. Het tweede deel --
   opnieuw verdelen -- kon niet, en dat is precies het moment waarop een
   maître iets nodig heeft: iemand gaat pauzeren, iemand raakt achterop, er
   komt een groep binnen.

   HET GEVAAR ZIT IN HET GAT. Een wijk loslaten en hopen dat een collega hem
   oppakt, is een tafel die tussen twee mensen door valt -- en dat merkt niemand
   tot de gast het zegt. Dus is een overdracht geen "loslaten" maar een AANBOD:

   1. ALLEEN WIE HEM DRAAGT BIEDT HEM AAN. Een collega kan een wijk niet naar
      zichzelf toe trekken; dat zou de claim zijn die de pas juist oplost.
   2. TIJDENS HET AANBOD DRAAGT DE AANBIEDER HEM NOG. Het aanbod verandert niets
      aan wie verantwoordelijk is -- pas de aanvaarding doet dat. Zo bestaat er
      geen moment waarop een wijk van niemand is.
   3. ALLEEN DE GEVRAAGDE AANVAARDT. Een aanbod aan Sanne is geen aanbod aan de
      hele ploeg; anders is het alsnog een wedstrijdje wie het eerst drukt.
   4. INTREKKEN KAN, DOOR DE AANBIEDER OF DOOR EEN MANAGER. Een aanbod dat blijft
      hangen omdat de gevraagde naar huis is, hoort geen grendel te worden.
   5. EEN WIJK HEEFT HOOGSTENS EEN OPEN AANBOD. Twee aanbiedingen op dezelfde
      wijk geven twee antwoorden op "van wie wordt dit", en dan gaan er twee of
      geen.

   WAT DIT NIET IS: een dienstrooster. Wie wanneer werkt staat in de
   personeelslaag. Dit is de handeling van een halve seconde midden in een
   dienst, en meer moet het niet zijn. */
'use strict';

const MAXOPEN = 24;

function doos(h) {
  if (!Array.isArray(h.wijkOverdrachten)) h.wijkOverdrachten = [];
  return h.wijkOverdrachten;
}

module.exports = ({ horeca, schoon }) => {
  const { nu, id } = horeca;
  const wijklaag = require('./wijk')({ horeca, schoon });

  const open = (h) => doos(h).filter((o) => o.stand === 'aangeboden');
  const vanWijk = (h, wijkId) => open(h).find((o) => o.wijkId === String(wijkId || ''));

  /* Aanbieden. De wijk blijft van de aanbieder tot de ander hem aanvaardt
     (regel 2) -- er is dus geen moment waarop hij van niemand is. */
  function bied(h, { wijkId, naarId, naarNaam }, wie) {
    const w = wijklaag.lijst(h).find((x) => x.id === String(wijkId || ''));
    if (!w) return { status: 404, error: 'Deze wijk kennen we niet.' };
    if (!w.van) return { status: 409, error: 'Niemand draagt deze wijk; hij is al van iedereen.' };
    if (String(w.van.staffId) !== String(wie.staffId)) {
      return { status: 409, code: 'niet-van-jou',
        error: w.van.naam + ' draagt deze wijk; alleen hij biedt hem aan.' };
    }
    if (!naarId) return { status: 400, error: 'Aan wie wordt deze wijk aangeboden?' };
    if (String(naarId) === String(wie.staffId)) {
      return { status: 400, error: 'Een wijk aan jezelf aanbieden verandert niets.' };
    }
    if (vanWijk(h, w.id)) {
      return { status: 409, code: 'al-aangeboden',
        error: 'Deze wijk staat al bij iemand uit; trek dat aanbod eerst in.' };
    }
    if (open(h).length >= MAXOPEN) return { status: 409, error: 'Er staan te veel aanbiedingen open.' };
    const o = { id: id(4), wijkId: w.id, wijkNaam: w.naam,
      vanId: String(wie.staffId), vanNaam: wie.naam,
      naarId: String(naarId), naarNaam: schoon(naarNaam, 60) || null,
      stand: 'aangeboden', at: nu() };
    doos(h).unshift(o);
    if (doos(h).length > 200) doos(h).length = 200;
    return { ok: true, overdracht: o,
      let: 'U draagt deze wijk nog tot ' + (o.naarNaam || 'uw collega') + ' hem aanvaardt.' };
  }

  /* Aanvaarden. Pas HIER verhuist de verantwoordelijkheid. */
  function aanvaard(h, overdrachtId, wie) {
    const o = doos(h).find((x) => x.id === String(overdrachtId || ''));
    if (!o) return { status: 404, error: 'Deze overdracht kennen we niet.' };
    if (o.stand !== 'aangeboden') return { status: 409, error: 'Deze overdracht is al ' + o.stand + '.' };
    if (String(o.naarId) !== String(wie.staffId)) {
      return { status: 409, code: 'niet-voor-jou',
        error: 'Deze wijk is aan ' + (o.naarNaam || 'iemand anders') + ' aangeboden.' };
    }
    /* De dienst overschrijven en niet eerst loslaten: tussen loslaten en
       oppakken zou de wijk van niemand zijn, en dat is precies het gat. */
    const dienst = (h.wijkdienst && typeof h.wijkdienst === 'object') ? h.wijkdienst : (h.wijkdienst = {});
    dienst[o.wijkId] = { staffId: String(wie.staffId), naam: wie.naam, at: nu(),
      overgenomenVan: o.vanNaam };
    o.stand = 'aanvaard';
    o.aanvaardAt = nu();
    return { ok: true, overdracht: o, wijk: o.wijkNaam,
      let: o.wijkNaam + ' is nu van u, overgenomen van ' + o.vanNaam + '.' };
  }

  // intrekken: door de aanbieder, of door een manager die een aanbod moet opruimen
  function trekIn(h, overdrachtId, wie) {
    const o = doos(h).find((x) => x.id === String(overdrachtId || ''));
    if (!o) return { status: 404, error: 'Deze overdracht kennen we niet.' };
    if (o.stand !== 'aangeboden') return { status: 409, error: 'Deze overdracht is al ' + o.stand + '.' };
    if (String(o.vanId) !== String(wie.staffId) && !wie.manager) {
      return { status: 409, error: o.vanNaam + ' bood deze wijk aan; alleen hij of een manager trekt hem in.' };
    }
    o.stand = 'ingetrokken';
    o.ingetrokkenAt = nu();
    o.ingetrokkenDoor = wie.naam;
    return { ok: true, overdracht: o, let: 'Ingetrokken; ' + o.vanNaam + ' draagt de wijk nog steeds.' };
  }

  const minutenSinds = (at) => at ? Math.max(0, Math.round((Date.now() - Date.parse(at)) / 60000)) : 0;

  /* De open aanbiedingen, met hoe lang ze staan. Geen grens en geen kleur: een
     aanbod dat lang staat is een feit waar een maître op mag handelen, en er is
     nergens vastgelegd hoe lang dat mag duren. */
  function lijst(h) {
    return open(h).map((o) => Object.assign({}, o, { staat: minutenSinds(o.at) }));
  }

  return { bied, aanvaard, trekIn, lijst, vanWijk, MAXOPEN };
};
