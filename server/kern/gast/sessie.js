/* Hospitality Guest OS (deelmodule): DE TAFELSESSIE.

   HET PROBLEEM DAT DIT OPLOST. Een gast scant een QR en moet daarna precies
   genoeg zijn: hij hoort bij DEZE zaak, aan DEZE tafel, op DIE ene rekening die
   daar openstaat -- en zijn tafelgenoten horen daar vanaf hun eigen telefoon
   bij te kunnen. Zonder deze laag lost elk scherm dat zelf op, en dan is de
   eerste vraag die niemand beantwoordt: als er vier mensen aan tafel 12 zitten,
   op welke rekening komt de vijfde bestelling?

   DRIE DINGEN DIE HIER BEWUST ZO ZIJN.

   1. DE QR HOORT BIJ DE TAFEL, NIET BIJ DE REKENING. Een sticker op tafel 12
      wordt een keer gedrukt en moet jaren mee. Het token staat dus per tafel in
      de instellingen van de zaak en verandert niet als de rekening sluit. Wat
      WEL per rekening leeft, is de sessie van de gast.
   2. HET TOKEN WORDT GEHASHT BEWAARD. Wie de database leest, kan er geen
      tafelsessie mee openen. Dat is dezelfde gedachte als bij een wachtwoord:
      wij hoeven het niet te weten, we hoeven het alleen te herkennen. De sticker
      draagt het echte token; wij dragen de afdruk.
   3. EEN DEELNEMER IS EEN CODENAAM OF EEN VOORNAAM, NOOIT EEN ACCOUNT. De
      rekening draagt geen sleutel van een lid en geen echte naam -- de
      identiteitskluis blijft gescheiden (CLAUDE.md). Aan tafel zie je "Sam" of
      een codenaam, en dat is genoeg om te weten wie welk biertje bestelde. */
'use strict';

module.exports = ({ db, save, crypto, schoon, horeca }) => {
  const { H, nu, id } = horeca;

  const afdruk = (t) => crypto.createHash('sha256').update(String(t || '')).digest('hex');

  /* ---------- de QR van een PLEK ----------
     Een plek is een tafel of een hotelkamer. Ze delen de mechaniek -- een
     gedrukte sticker die jaren meegaat, een gehashte afdruk in de opslag -- en
     verschillen in wat er daarna geldt: een tafel opent een rekening, een kamer
     mag dat alleen zolang daar een gastrekening op staat.

     Waarom `soort` op de RIJ staat en niet in de sleutel: bestaande QR-codes uit
     de tijd dat er alleen tafels waren dragen geen soort, en die horen te
     blijven werken. Ze vallen terug op 'tafel'. Opnieuw uitgeven blijft een
     aparte handeling, want stil vernieuwen maakt elke gedrukte sticker dood. */
  const SOORTEN = ['tafel', 'kamer'];

  function plekToken(zaakcode, naam, { soort = 'tafel', vernieuw = false } = {}) {
    const h = H(zaakcode);
    if (!SOORTEN.includes(soort)) return { status: 400, error: 'Een QR hoort bij een tafel of een kamer.' };
    if (!h.instel) h.instel = {};
    if (!h.instel.qr) h.instel.qr = {};
    const sleutel = String(naam || '').trim();
    if (!sleutel) return { status: 400, error: soort === 'kamer' ? 'Voor welke kamer?' : 'Voor welke tafel?' };
    const bestaand = h.instel.qr[sleutel];
    if (bestaand && !vernieuw) return { plek: sleutel, tafel: sleutel, soort: bestaand.soort || 'tafel', token: bestaand.token, at: bestaand.at };
    const token = crypto.randomBytes(9).toString('hex');
    h.instel.qr[sleutel] = { token, hash: afdruk(token), soort, at: nu() };
    save();
    return { plek: sleutel, tafel: sleutel, soort, token, at: h.instel.qr[sleutel].at, vernieuwd: !!bestaand };
  }
  // de oude naam blijft bestaan: gastbeheer.js en de toetsen gebruiken hem
  const tafelToken = (zaakcode, tafel, opties) => plekToken(zaakcode, tafel, Object.assign({ soort: 'tafel' }, opties || {}));

  /* Zoek de zaak en de plek bij een gescand token. Loopt over de zaken die een
     QR hebben; dat zijn er in een gewone installatie enkele tientallen en de
     vergelijking gaat over de afdruk, niet over het token. */
  function zaakBijToken(token) {
    const t = String(token || '').trim();
    if (t.length < 12) return null;
    const h = afdruk(t);
    for (const [code, doos] of Object.entries(db.data.horeca || {})) {
      const qr = (doos.instel && doos.instel.qr) || {};
      for (const [plek, rij] of Object.entries(qr)) {
        if (rij && (rij.hash === h || rij.token === t)) {
          return { zaakcode: code, plek, tafel: plek, soort: rij.soort || 'tafel' };
        }
      }
    }
    return null;
  }

  /* ---------- de rekening van een plek ----------
     Er is er hooguit een open per plek; die regel staat al in de
     leveranciersroute en wordt hier NIET overgeschreven maar gevolgd. Bestaat
     hij nog niet, dan opent de eerste gast hem.

     EEN KAMER IS GEEN TAFEL, en dat verschil is de grendel van deze hele
     roomservice-laag: op een tafel mag altijd een rekening open, op een kamer
     alleen zolang daar een GASTREKENING (folio) op staat. Een kamer-QR die
     iemand op de gang fotografeert is dus niets waard zodra de gast uitcheckt
     -- en een bestelling kan nooit landen op een kamer die leegstaat. Dezelfde
     regel als de betaalwijze 'kamer' in horeca/betalen.js al hanteerde; hij
     staat nu ook voor de deur ervoor. */
  function rekeningVoorPlek(zaakcode, soort, naam, { open = true, folioVan = null } = {}) {
    const h = H(zaakcode);
    const kanaal = soort === 'kamer' ? 'roomservice' : 'tafel';
    /* DE FOLIO-GRENDEL GELDT VOOR DE PLEK EN NIET ALLEEN VOOR HET OPENEN. Dit
       stond eerst onder de zoekactie, en dat was een gat: na het uitchecken kan
       de roomservice-rekening nog OPEN staan (er stond geld op), en dan gaf
       deze functie hem gewoon terug -- waarna de volgende die de kamer-QR
       scant, op de rekening van de vorige gast landt. Geen open gastrekening,
       geen toegang tot die kamer, punt. Een toets houdt dat vast. */
    if (soort === 'kamer' && folioVan && !folioVan(zaakcode, naam)) {
      return { status: 409, code: 'geen-verblijf',
        error: 'Er staat geen open gastrekening op kamer ' + naam + '. Roomservice loopt via de receptie.' };
    }
    const bestaand = Object.values(h.rekeningen).find(r => r.status === 'open' && r.kanaal === kanaal
      && (soort === 'kamer' ? r.kamer === naam : r.tafel === naam));
    if (bestaand) return bestaand;
    if (!open) return null;
    if (soort === 'kamer' && !folioVan) {
      return { status: 409, code: 'geen-verblijf',
        error: 'Er staat geen open gastrekening op kamer ' + naam + '. Roomservice loopt via de receptie.' };
    }
    const r = { id: id(5), kanaal, tafel: soort === 'kamer' ? null : naam, naam: null, gasten: 1,
      status: 'open', regels: [], kortingen: [], betalingen: [], fooiCenten: 0,
      gastId: null, kamer: soort === 'kamer' ? naam : null, deelnemers: [], audit: [],
      geopendAt: nu(), door: 'gast', at: nu(), viaGast: true };
    h.rekeningen[r.id] = r;
    save();
    return r;
  }
  // de oude naam blijft: bestaande aanroepers vragen om een tafel
  const rekeningVoorTafel = (zaakcode, tafel, opties) => rekeningVoorPlek(zaakcode, 'tafel', tafel, opties);

  /* ---------- aanschuiven ----------
     Een deelnemer krijgt een nummer (dat is het `gastNr` dat de bestaande
     rekening al kent, dus de splitlaag per persoon werkt meteen) en een eigen
     sleutel. De sleutel gaat een keer over de lijn en wordt gehasht bewaard. */
  function schuifAan(zaakcode, plek, { naam, codenaam, lid, leeftijd, leeftijdGeverifieerd, soort, folioVan }) {
    const r = rekeningVoorPlek(zaakcode, soort || 'tafel', plek, { folioVan });
    if (r.error) return r;   // een kamer zonder open gastrekening: geen sessie
    if (!Array.isArray(r.deelnemers)) r.deelnemers = [];
    if (r.deelnemers.length >= 40) return { status: 409, error: 'Er zitten al veertig mensen op deze rekening.' };
    const sleutel = crypto.randomBytes(16).toString('hex');
    const nr = r.deelnemers.reduce((m, d) => Math.max(m, d.nr), 0) + 1;
    const deelnemer = {
      nr,
      handle: schoon(codenaam, 40) || schoon(naam, 40) || ('Gast ' + nr),
      lid: !!lid,
      /* De leeftijd staat hier als FEIT en niet als bewering: alleen een
         geverifieerde leeftijd telt bij de alcoholregel in beleid.js. */
      leeftijd: leeftijd == null ? null : Math.max(0, Math.min(120, parseInt(leeftijd, 10) || 0)),
      leeftijdGeverifieerd: !!leeftijdGeverifieerd,
      hash: afdruk(sleutel),
      at: nu()
    };
    r.deelnemers.push(deelnemer);
    r.gasten = Math.max(r.gasten || 1, r.deelnemers.length);
    save();
    return { rekening: r, deelnemer, sleutel };
  }

  /* Herken een terugkerende deelnemer aan zijn sleutel. Geeft de rekening en de
     deelnemer, of null -- nooit een half antwoord waarmee de aanroeper alsnog
     iets op de verkeerde rekening zet. */
  function herken(sleutel) {
    const h = afdruk(String(sleutel || ''));
    if (!sleutel || String(sleutel).length < 24) return null;
    for (const [zaakcode, doos] of Object.entries(db.data.horeca || {})) {
      for (const r of Object.values(doos.rekeningen || {})) {
        if (r.status !== 'open') continue;
        const d = (r.deelnemers || []).find(x => x.hash === h);
        if (d) return { zaakcode, rekening: r, deelnemer: d };
      }
    }
    return null;
  }

  return { SOORTEN, plekToken, tafelToken, zaakBijToken,
    rekeningVoorPlek, rekeningVoorTafel, schuifAan, herken, afdruk };
};
