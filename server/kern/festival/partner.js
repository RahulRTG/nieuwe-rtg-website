/* RTG Festival (deelmodule): DE PARTNER. Een band die twee kanten kent.

   WAAROM DIT ER MOEST KOMEN, en waarom de voor de hand liggende weg fout is.

   De cockpit hoort te weten dat er twee beveiligingsposten onbezet zijn en dat
   de pendeldienst een storing heeft gemeld. Dat staat er allemaal al -- in
   kern/beveiliging/ en in kern/mobiliteit/ -- maar het staat bij een ANDERE
   ZAAK. Een festival is een orkestratie over derden, en die derden zijn eigen
   ondernemingen met eigen personeel en eigen roosters.

   DE VERLEIDING WAS OM TE MATCHEN OP NAAM. Een beveiligingspost draagt een
   `klant`, en dat lijkt de koppeling. Het is vrije tekst (kern/beveiliging.js:
   `schoon(data.klant, 80) || 'Klant'`), dus dat zou "Testival", "testival" en
   "Testival 2027" tot drie verschillende klanten maken -- en erger: wie zijn
   post "Testival" noemt, leest mee. Een naam is geen sleutel en zeker geen
   toegangsbewijs.

   EN EEN ENKELZIJDIGE VERWIJZING IS ERGER DAN GEEN. Zou een festival zelf
   mogen opschrijven "SECUR-BV doet mijn beveiliging", dan opent het daarmee het
   rooster van SECUR-BV -- door een regel in zijn eigen data te zetten. Dat is
   geen koppeling maar een inbraak met een formulier.

   DUS: EEN BAND BESTAAT PAS ALS BEIDE KANTEN HEM BEVESTIGEN. Hetzelfde patroon
   als kern/levensband/ (LIFE.md par. 4.2), en om precies dezelfde reden. Het
   festival stelt voor, de zaak bevestigt, en allebei kunnen ze opzeggen. Een
   voorstel opent NIETS.

   WAT ER DAARNA OPENGAAT IS SMAL, EN DE PARTNER BEPAALT HET ZELF. Bij het
   bevestigen noemt de zaak WELKE stukken van haar het festival mag zien --
   welke posten, welke lijnen. Zonder die lijst is de band bevestigd en deelt
   hij niets.

   Dat is met opzet omgekeerd aan de voor de hand liggende vorm. Het festival
   zou kunnen zeggen "laat mij de posten van dit object zien", maar het KENT de
   posten van een ander bedrijf niet -- en zou dus moeten raden of matchen op
   een naam. De partner kent ze wel. Wie de gegevens bezit, beslist wat eruit
   gaat (LIFE.md par. 4.2, delen per stuk).

   En wat er dan gedeeld wordt, blijft een GETAL: hoeveel plekken onbezet zijn,
   en dat er een storing is gemeld. Geen namen van bewakers, geen diensten, geen
   omzet. Wie een uitzondering wil zien, heeft een getal nodig en geen dossier. */
'use strict';

const ROLLEN = ['beveiliging', 'vervoer', 'horeca', 'techniek', 'zorg', 'schoonmaak'];
const ACTIEF = ['voorgesteld', 'bevestigd'];

module.exports = (ctx) => {
  const { save, crypto, schoon, editieVind } = ctx;

  const bak = (e) => {
    if (!e.partners || typeof e.partners !== 'object') e.partners = {};
    return e.partners;
  };
  const nuIso = () => new Date().toISOString();

  function partnerVoorstel(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const d = data || {};
    const rol = ROLLEN.includes(String(d.rol)) ? String(d.rol) : null;
    if (!rol) return { status: 400, error: 'Kies een rol: ' + ROLLEN.join(', ') + '.' };
    const zaak = schoon(d.zaak, 40);
    if (!zaak) return { status: 400, error: 'Welke zaak doet dit?' };
    const door = schoon(d.door, 60);
    if (!door) return { status: 400, error: 'Wie stelt dit voor?' };

    const b = bak(e);
    /* Een tweede voorstel voor dezelfde zaak in dezelfde rol is geen nieuwe
       band maar een herhaling; die zou de eerste stil kunnen overschrijven. */
    const al = Object.values(b).find(p => p.rol === rol && p.zaak === zaak && ACTIEF.includes(p.stand));
    if (al) return { status: 409, error: 'Deze zaak staat al als ' + rol + ' (' + al.stand + ').', partner: al };
    if (Object.keys(b).length >= 200) return { status: 400, error: 'Tot tweehonderd partners per editie.' };

    const p = { id: 'prt' + crypto.randomBytes(4).toString('hex'), rol, zaak, stand: 'voorgesteld',
      voorgesteldDoor: door, at: nuIso(), bevestigd: null, beeindigd: null };
    b[p.id] = p;
    save();
    return { ok: true, partner: p };
  }

  /* Bevestigen of weigeren kan ALLEEN de zaak die genoemd is. De aanroeper
     geeft zijn eigen code mee; die komt op de route uit de sessie en nooit uit
     het lichaam -- anders is deze hele tweezijdigheid een formulier. */
  function partnerAntwoord(fid, eid, data, ja) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const d = data || {};
    const p = bak(e)[String(d.id || '')];
    if (!p) return { status: 404, error: 'Deze band bestaat niet.' };
    const zaakCode = schoon(d.zaakCode, 40);
    /* EEN 404 EN GEEN 403: wie niet de genoemde zaak is, hoort niet te weten
       dat deze band bestaat. Zelfde regel als bij het festival zelf. */
    if (!zaakCode || zaakCode !== p.zaak) return { status: 404, error: 'Deze band bestaat niet.' };
    if (p.stand !== 'voorgesteld') return { status: 409, error: 'Deze band staat al op ' + p.stand + '.' };
    const door = schoon(d.door, 60);
    if (!door) return { status: 400, error: 'Wie antwoordt er namens de zaak?' };

    /* `deelt` is de lijst stukken die de PARTNER vrijgeeft -- postId's,
       lijnId's. Hij komt van de bevestigende zaak en van niemand anders, en
       zonder hem deelt een bevestigde band niets. Dat laatste is geen omissie:
       een band mag bestaan zonder dat er data doorheen gaat. */
    const deelt = Array.isArray(d.deelt)
      ? d.deelt.map(x => schoon(x, 40)).filter(Boolean).slice(0, 200) : [];
    p.stand = ja ? 'bevestigd' : 'geweigerd';
    p.bevestigd = { door, at: nuIso() };
    if (ja) p.deelt = deelt;
    if (!ja) p.reden = schoon(d.reden, 200) || null;
    save();
    return { ok: true, partner: p };
  }

  const partnerBevestig = (fid, eid, data) => partnerAntwoord(fid, eid, data, true);
  const partnerWeiger = (fid, eid, data) => partnerAntwoord(fid, eid, data, false);

  /* Opzeggen mag ALLEBEI de kanten, en zonder toestemming van de ander. Een
     band die maar een kant kan verbreken, is geen band maar een vergunning. */
  function partnerOpzeg(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const d = data || {};
    const p = bak(e)[String(d.id || '')];
    if (!p) return { status: 404, error: 'Deze band bestaat niet.' };
    const wie = schoon(d.zaakCode, 40);
    const magOpzeggen = wie === p.zaak || d.eigenaar === true;
    if (!magOpzeggen) return { status: 404, error: 'Deze band bestaat niet.' };
    if (!ACTIEF.includes(p.stand)) return { status: 409, error: 'Deze band staat al op ' + p.stand + '.' };
    p.stand = 'opgezegd';
    p.beeindigd = { door: schoon(d.door, 60) || null, kant: wie === p.zaak ? 'partner' : 'festival', at: nuIso() };
    save();
    return { ok: true, partner: p };
  }

  /* De partner past aan wat hij deelt, zonder de band opnieuw te sluiten. */
  function partnerDeelt(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const d = data || {};
    const p = bak(e)[String(d.id || '')];
    if (!p) return { status: 404, error: 'Deze band bestaat niet.' };
    const zaakCode = schoon(d.zaakCode, 40);
    if (!zaakCode || zaakCode !== p.zaak) return { status: 404, error: 'Deze band bestaat niet.' };
    if (p.stand !== 'bevestigd') return { status: 409, error: 'Deze band staat op ' + p.stand + '.' };
    p.deelt = Array.isArray(d.deelt)
      ? d.deelt.map(x => schoon(x, 40)).filter(Boolean).slice(0, 200) : [];
    save();
    return { ok: true, partner: p };
  }

  /* De bevestigde partners, en alleen die. Elke lezer in ./signalen.js loopt
     hierlangs; een voorstel of een opgezegde band opent dus nergens iets. */
  function partnersVan(e, rol) {
    if (!e) return [];
    return Object.values(e.partners || {})
      .filter(p => p.stand === 'bevestigd' && (!rol || p.rol === rol));
  }

  function partnerLijst(fid, eid) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    return { ok: true, partners: Object.values(e.partners || {}) };
  }

  return { partnerVoorstel, partnerBevestig, partnerWeiger, partnerOpzeg, partnerDeelt,
    partnersVan, partnerLijst, PARTNER_ROLLEN: ROLLEN };
};

module.exports.PARTNER_ROLLEN = ROLLEN;
