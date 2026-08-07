/* HET DOORGEEFJOURNAAL: wat er binnenkwam en wat er de deur uitging.

   WAAROM DIT ER KOMT. In een nacht gingen drie dingen mis die allemaal
   ONZICHTBAAR faalden: de sleutels verzonnen zichzelf opnieuw, de herstel-link
   lag op straat, en de sms met de herstelcode viel stil op de grond terwijl het
   antwoord `tweestaps: true` meldde. Bij alle drie was de vraag "wat gebeurde er
   eigenlijk?" niet te beantwoorden zonder in de code te duiken.

   Verzoeken werden al gelogd (server/log.js): id, methode, pad, status, duur.
   Twee dingen ontbraken. Ten eerste een plek om het te LEZEN -- het techniek-
   scherm toonde er alleen een grafiekje van. Ten tweede de UITGAANDE kant: post,
   sms, push en aanroepen naar buiten stonden nergens, en juist daar zat de
   storing.

   WAAROM NIET ELKE FUNCTIE. Er is gevraagd om een regel per functie. Dat is drie
   keer verkeerd: het zijn duizenden aanroepen per seconde (ruis waarin je een
   storing juist kwijtraakt), het kost snelheid op elke aanroep, en functies
   krijgen echte namen en adressen als argument -- die in een logboek schrijven
   breekt de merkregel dat klantdata op codenamen draait. Een regel per
   BINNENKOMEND verzoek en per UITGAAND bericht geeft hetzelfde inzicht zonder
   een van die drie prijzen.

   WAT ER NOOIT IN KOMT: een naam, een e-mailadres, een telefoonnummer, een
   documentnummer, een wachtwoord, een token of een herstelsleutel. Wie er iets
   deed staat op codenaam of op sleutel. test/loghygiene.test.js bewaakt dat voor
   het bestaande logboek; test/doorgeefjournaal.test.js doet het voor dit.

   TWEE LAGEN, met opzet:
   - een VENSTER in het geheugen (de laatste VENSTER regels): gratis, snel, en
     wat het scherm laat zien.
   - een BEWAARD journaal in db.data: zodat je morgen kunt terugkijken wat er
     vannacht misging. Met een termijn, via de bestaande bewaartabel -- geen
     tweede opruimmechanisme naast server/bewaarveger.js. */
'use strict';

const VENSTER = 4000;          // regels in het geheugen; genoeg voor een werkdag kijken
const BEWAARD_MAX = 20000;     // harde bovengrens op schijf, los van de termijn

/* Een pad zonder de veranderlijke stukken: /api/lid/42/pas wordt /api/lid/:id/pas.
   Zo tellen honderd verzoeken naar honderd leden als EEN regel in een overzicht,
   en staat er bovendien geen id in het journaal dat naar een persoon leidt. */
function padVorm(p) {
  return String(p || '')
    .replace(/\/[0-9a-f]{16,}/gi, '/:sleutel')
    .replace(/\/\d+/g, '/:id')
    .slice(0, 120);
}

/* Een bestemming zonder de persoon erin: 'sms:+31612345678' wordt 'sms', en een
   e-mailadres wordt het domein. Het journaal moet laten zien DAT er post uitging
   en of het lukte, niet aan wie. */
function bestemmingVorm(naar) {
  const s = String(naar || '');
  if (s.startsWith('sms:')) return 'sms';
  const at = s.indexOf('@');
  if (at > 0) return 'mail:' + s.slice(at + 1).slice(0, 40);
  return s.slice(0, 40) || 'onbekend';
}

function maakDoorgeefjournaal({ db, save, nu }) {
  const klok = nu || (() => new Date().toISOString());
  const venster = [];

  const rij = () => {
    if (!Array.isArray(db.data.doorgeefjournaal)) db.data.doorgeefjournaal = [];
    return db.data.doorgeefjournaal;
  };

  /* Schrijven doet twee dingen: het venster bijwerken (altijd) en de regel
     bewaren (alleen als hij het waard is). Alles bewaren zou de database laten
     ontploffen; niets bewaren maakt terugkijken onmogelijk. De grens: alles wat
     MISLUKT is, plus alles wat de deur uitging, plus schrijvende verzoeken.
     Een geslaagde GET van een lijstje is morgen niemand iets waard. */
  function bewaarWaard(r) {
    if (r.mislukt) return true;
    if (r.richting === 'uit') return true;
    return r.methode && r.methode !== 'GET';
  }

  function schrijf(r) {
    const regel = {
      t: klok(),
      richting: r.richting === 'uit' ? 'uit' : 'in',
      wat: String(r.wat || '').slice(0, 120),
      wie: String(r.wie || '').slice(0, 60) || null,
      methode: r.methode || null,
      status: Number.isFinite(r.status) ? r.status : null,
      ms: Number.isFinite(r.ms) ? Math.round(r.ms) : null,
      bytes: Number.isFinite(r.bytes) ? r.bytes : null,
      mislukt: !!r.mislukt,
      reden: r.reden ? String(r.reden).slice(0, 140) : null
    };
    venster.push(regel);
    if (venster.length > VENSTER) venster.splice(0, venster.length - VENSTER);
    if (bewaarWaard(regel)) {
      const lijst = rij();
      lijst.push(regel);
      if (lijst.length > BEWAARD_MAX) lijst.splice(0, lijst.length - BEWAARD_MAX);
      /* NIET bij elke regel save(): dat zou van elk verzoek een schrijfactie
         maken. De veger en de gewone save-momenten pakken het mee; bij een
         MISLUKKING schrijven we wel meteen weg, want juist die regel wil je
         terugvinden als de server daarna omvalt. */
      if (regel.mislukt) { try { save(); } catch (e) {} }
    }
    return regel;
  }

  const binnen = (r) => schrijf(Object.assign({ richting: 'in' }, r));
  const buiten = (r) => schrijf(Object.assign({ richting: 'uit' }, r, { wat: r.wat, wie: bestemmingVorm(r.naar) }));

  /* Lezen: het venster is de bron voor "wat gebeurt er nu", het bewaarde deel
     voor "wat gebeurde er gisteren". Standaard het venster, want dat is waar
     iemand naar kijkt als hij het scherm opent. */
  function lees({ bron, richting, alleenMislukt, zoek, max } = {}) {
    const uit = (bron === 'bewaard' ? rij() : venster).slice();
    const f = uit.filter(r =>
      (!richting || r.richting === richting) &&
      (!alleenMislukt || r.mislukt) &&
      (!zoek || (r.wat + ' ' + (r.wie || '')).toLowerCase().includes(String(zoek).toLowerCase())));
    const n = Math.min(Math.max(Number(max) || 200, 1), 1000);
    return { ok: true, bron: bron === 'bewaard' ? 'bewaard' : 'venster', totaal: f.length, regels: f.slice(-n).reverse() };
  }

  /* Een samenvatting waar je in een oogopslag aan ziet of er iets speelt: hoeveel
     erin, hoeveel eruit, en vooral hoeveel er MISLUKTE. Dat laatste getal is het
     hele punt van dit journaal. */
  function beeld() {
    const tel = (f) => venster.filter(f).length;
    return {
      ok: true,
      venster: venster.length,
      bewaard: rij().length,
      in: tel(r => r.richting === 'in'),
      uit: tel(r => r.richting === 'uit'),
      mislukt: tel(r => r.mislukt),
      uitMislukt: tel(r => r.richting === 'uit' && r.mislukt),
      oudste: venster.length ? venster[0].t : null
    };
  }

  /* Aanmelden bij de haak (server/journaalhaak.js), zodat de lagen ONDER de kern
     kunnen melden zonder naar boven te hoeven reiken: mail.js meldt wat de deur
     uitgaat, de verzoekketen wat er binnenkomt. Voor die aanmelding doet melden
     niets, en dat is precies goed -- een script of een toets hoeft geen journaal. */
  try { require('../journaalhaak').zet((r) => (r && r.richting === 'uit' ? buiten(r) : binnen(r))); } catch (e) {}

  return { journaalBinnen: binnen, journaalBuiten: buiten, journaalLees: lees, journaalBeeld: beeld, journaalPadVorm: padVorm };
}

module.exports = { maakDoorgeefjournaal, padVorm, bestemmingVorm };
