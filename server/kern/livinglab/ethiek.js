/* RTF Living Lab, deel "ethiek": de laag die bepaalt of een onderzoek mensen
   mag benaderen, en zo ja onder welke voorwaarden.

   Het uitgangspunt is niet "alles mag mits een vinkje", maar: de zwaarte van de
   waarborg volgt de zwaarte van het onderzoek. Een prullenbaktest heeft niets
   nodig; onderzoek rond kinderen, schulden of mentale gezondheid heeft een
   review met twee handtekeningen, een privacytoets, ouderlijke toestemming en
   gescheiden opslag nodig. Wat elke klasse eist staat in ./kader.js; dit
   bestand doet niets anders dan dat NAREKENEN en weigeren zolang het niet af is.

   VIER DINGEN DIE DE AI HIER NIET MAG, en waarom ze in code staan en niet in
   een systeemprompt:

   1. de risicoklasse verlagen -- alleen een mens met tekenbevoegdheid;
   2. een review tekenen -- `door` moet een tekenaar van het lab zijn, en bij
      twee vereiste handtekeningen twee VERSCHILLENDE;
   3. een studie vrijgeven waarvan de klasse nog niet is vastgesteld;
   4. een stilgelegde studie weer aanzetten.

   Een systeemprompt is een verzoek. Dit is een poort.

   DE VERDELING MET ./waarborg.js. Dit bestand doet het OORDEEL: de risicoklasse
   en de ethische review, oftewel of dit onderzoek mag. De waarborgen die daarna
   gelden -- privacytoets, toestemming, stopcriteria, stilleggen, klachten --
   staan in ./waarborg.js. Ze delen dezelfde context en worden in ./index.js tot
   één `ethiek` samengevoegd, zodat de rest van de map en de routes één naam
   houden. `gebreken()` hieronder leest beide kanten uit het dossier en is dus de
   plek waar de twee helften weer bij elkaar komen. */
'use strict';

const kader = require('./kader');

module.exports = (ctx) => {
  const { nu, rid, schoon, audit, vindStudie, save, bestuur } = ctx;

  const eis = s => kader.klasse(s.dossier.ethiek.klasse) || kader.klasse('laag');

  /* ---------- de klasse vaststellen ----------
     Een mens kijkt naar de bodem die het systeem berekende en stelt vast. Hoger
     mag altijd; lager alleen door iemand die in dit lab mag tekenen, en met een
     reden die in het auditspoor terechtkomt. */
  function klasseZet(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const doel = kader.klasse(b.klasse);
    if (!doel) return { status: 400, error: 'Kies een geldige risicoklasse.' };
    const huidig = eis(s);
    const door = schoon(b.door, 80);
    if (door.length < 2) return { status: 400, error: 'Een risico-inschatting draagt altijd de naam van de mens die hem maakt.' };
    if (doel.rang < huidig.rang) {
      const t = bestuur.tekenaarVan(s.labId, door);
      if (!t) return { status: 403, error: 'Alleen een tekenbevoegde van dit lab kan de risicoklasse verlagen; ' + door + ' staat niet in het register.' };
      const reden = schoon(b.reden, 300);
      if (reden.length < 10) return { status: 400, error: 'Verlagen kan alleen met een reden die uitlegt waarom het lichtere regime volstaat.' };
      audit(s.labId, 'ethiek.verlaag', door, s.id, huidig.klasse + ' -> ' + doel.klasse + ': ' + reden);
      s.dossier.ethiek.review = [];       // een lichter regime hertoetst de review
      s.dossier.logboek.unshift({ id: rid(), tekst: 'Risicoklasse verlaagd naar ' + doel.naam + ' door ' + door + '. De review is opnieuw open.', wie: door, at: nu() });
    } else {
      audit(s.labId, 'ethiek.klasse', door, s.id, huidig.klasse + ' -> ' + doel.klasse);
      s.dossier.logboek.unshift({ id: rid(), tekst: 'Risicoklasse vastgesteld op ' + doel.naam + ' door ' + door + '.', wie: door, at: nu() });
    }
    s.dossier.ethiek.klasse = doel.klasse;
    s.dossier.ethiek.vastgesteld = true;
    save();
    return { ok: true, ethiek: s.dossier.ethiek, eist: doel };
  }

  /* ---------- de ethische review ----------
     Elke handtekening is er één van een geregistreerde tekenbevoegde van dit
     lab. Bij twee vereiste handtekeningen moeten dat twee verschillende mensen
     zijn, en minstens één ervan onafhankelijk -- anders tekent een projectleider
     samen met zijn eigen collega zijn eigen onderzoek af. */
  function reviewTeken(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    if (!s.dossier.ethiek.vastgesteld)
      return { status: 409, error: 'Stel eerst de risicoklasse vast; zonder klasse is niet te zeggen wat de review moet dekken.' };
    const door = schoon(b.door, 80);
    const t = bestuur.tekenaarVan(s.labId, door);
    if (!t) return { status: 403, error: 'Alleen een tekenbevoegde van dit lab tekent de review; ' + (door || 'deze naam') + ' staat niet in het register.' };
    if (s.dossier.ethiek.review.some(r => r.door === door)) return { status: 409, error: 'Deze tekenaar heeft de review al getekend.' };
    const oordeel = ['akkoord', 'afgewezen', 'voorwaarden'].includes(b.oordeel) ? b.oordeel : null;
    if (!oordeel) return { status: 400, error: 'Kies akkoord, voorwaarden of afgewezen.' };
    const notitie = schoon(b.notitie, 500);
    if (oordeel !== 'akkoord' && notitie.length < 10)
      return { status: 400, error: 'Een afwijzing of voorwaarde zonder uitleg is voor de onderzoekers niet te repareren.' };
    s.dossier.ethiek.review.push({ id: rid(), door, rol: t.rol, onafhankelijk: !!t.onafhankelijk, oordeel, notitie, at: nu() });
    audit(s.labId, 'ethiek.review', door, s.id, oordeel);
    s.dossier.logboek.unshift({ id: rid(), tekst: 'Ethische review: ' + oordeel + ' door ' + door + '.', wie: door, at: nu() });
    save();
    return { ok: true, ethiek: s.dossier.ethiek, klaar: reviewKlaar(s) };
  }

  /* Is de review rond? Genoeg handtekeningen, allemaal akkoord, en bij twee
     vereiste handtekeningen minstens één onafhankelijke. Eén afwijzing telt
     zwaarder dan tien akkoorden: die blokkeert. */
  function reviewKlaar(s) {
    const k = eis(s);
    if (!k.review) return { ok: true, reden: 'Deze klasse vraagt geen review.' };
    const r = s.dossier.ethiek.review;
    if (r.some(x => x.oordeel === 'afgewezen')) return { ok: false, reden: 'De review is afgewezen.' };
    const akkoord = r.filter(x => x.oordeel === 'akkoord');
    if (akkoord.length < k.tekenaars) return { ok: false, reden: 'Er zijn ' + k.tekenaars + ' akkoorden nodig; er staan er ' + akkoord.length + '.' };
    if (k.tekenaars >= 2 && !akkoord.some(x => x.onafhankelijk))
      return { ok: false, reden: 'Bij deze klasse tekent minstens één onafhankelijke reviewer mee.' };
    const voorw = r.filter(x => x.oordeel === 'voorwaarden');
    if (voorw.length) return { ok: false, reden: 'Er staan nog ' + voorw.length + ' voorwaarden open uit de review.' };
    return { ok: true, reden: 'De review is rond.' };
  }

  /* ---------- de poort ----------
     Dit is wat ./cyclus.js aanroept voor de stap `deelnemers`. Hij geeft alle
     openstaande gebreken terug, niet alleen de eerste: een onderzoeker die er
     vijf keer achter elkaar op wordt gestuurd, gaat vinkjes zetten. */
  function gebreken(s) {
    const k = eis(s), e = s.dossier.ethiek, uit = [];
    if (e.stilgelegd) uit.push('Dit onderzoek is stilgelegd door ' + e.stilgelegd.door + '.');
    if (!e.vastgesteld) uit.push('De risicoklasse is nog niet door een mens vastgesteld.');
    if (k.review) { const r = reviewKlaar(s); if (!r.ok) uit.push(r.reden); }
    if (k.privacy && !e.privacytoets) uit.push('De privacytoets ontbreekt.');
    if (k.rang >= 1 && e.toestemming.regime === 'geen') uit.push('Er is geen toestemmingsregime gekozen.');
    if (k.ouderlijk && !e.toestemming.ouderlijk) uit.push('Ouderlijke toestemming staat uit terwijl deze klasse hem vraagt.');
    if (k.rang >= 1 && !e.stopcriteria.length) uit.push('Er is geen enkel stopcriterium beschreven.');
    if (e.klachten.some(c => c.status === 'open')) uit.push('Er staat een onafgehandelde klacht open.');
    return uit;
  }

  return { klasseZet, reviewTeken, reviewKlaar, gebreken, eis };
};
