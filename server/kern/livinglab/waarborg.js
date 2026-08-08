/* RTF Living Lab, deel "waarborg": de privacytoets, het toestemmingsregime, de
   stopcriteria, het stilleggen en de klachtenprocedure.

   ./ethiek.js ernaast doet de risicoklasse en de ethische review -- het OORDEEL
   over of dit onderzoek mag. Dit bestand doet de waarborgen die daarna gelden:
   wat er wordt vastgelegd, wat de deelnemer is verteld, waarbij het onderzoek
   stopt, en wat er gebeurt als iemand klaagt.

   Vier dingen die hier worden GEWEIGERD, elk uit dezelfde gedachte -- een
   waarborg die je kunt afvinken zonder hem in te vullen, is geen waarborg:

   1. een privacytoets zonder "wat laten we bewust WEG" (gegevensminimalisatie
      begint bij die vraag, niet bij de opsomming van wat je wel verzamelt);
   2. een toestemmingsregime dat lichter is dan de risicoklasse vraagt;
   3. een klacht afsluiten zonder antwoord -- dat is hem wegklikken;
   4. een stilgelegd onderzoek hervatten door iemand anders dan de ethisch
      toezichthouder, en nooit zonder reden.

   Afgesplitst uit ./ethiek.js toen die de 10 KB passeerde. De naad zit tussen
   "mag dit onderzoek" en "onder welke voorwaarden loopt het". */
'use strict';

const kader = require('./kader');

module.exports = (ctx) => {
  const { nu, rid, schoon, lijst, audit, vindStudie, save, bestuur } = ctx;

  const eis = s => kader.klasse(s.dossier.ethiek.klasse) || kader.klasse('laag');

  /* ---------- de privacytoets ----------
     Gegevensminimalisatie is hier een RIJ die je invult, geen belofte. Wat
     verzamel je, waarom, hoe lang, en wat verzamel je bewust NIET. Dat laatste
     veld is er met opzet: het dwingt de vraag "wat laten we weg". */
  function privacytoets(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const velden = lijst(b.velden, 80, 40);
    const grondslag = schoon(b.grondslag, 200), weggelaten = schoon(b.weggelaten, 300);
    const door = schoon(b.door, 80);
    if (door.length < 2) return { status: 400, error: 'Wie voert deze privacytoets uit?' };
    if (!velden.length) return { status: 400, error: 'Welke gegevens verzamelt dit onderzoek? Noem ze bij naam.' };
    if (grondslag.length < 10) return { status: 400, error: 'Op welke grondslag verzamelt u die gegevens?' };
    if (weggelaten.length < 5) return { status: 400, error: 'Wat laat dit onderzoek bewust WEG? Gegevensminimalisatie begint bij die vraag.' };
    s.dossier.ethiek.privacytoets = { velden, grondslag, weggelaten, bewaarMaanden: Math.max(0, Math.min(120, Math.round(Number(b.bewaarMaanden) || 0))),
      door, at: nu() };
    audit(s.labId, 'ethiek.privacy', door, s.id, velden.length + ' velden');
    save();
    return { ok: true, privacytoets: s.dossier.ethiek.privacytoets };
  }

  /* ---------- toestemming en stopcriteria ---------- */
  function toestemmingZet(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const regime = ['geen', 'mondeling', 'schriftelijk'].includes(b.regime) ? b.regime : null;
    if (!regime) return { status: 400, error: 'Kies geen, mondeling of schriftelijk.' };
    const k = eis(s);
    if (k.rang >= 1 && regime === 'geen')
      return { status: 400, error: 'Vanaf klasse ' + k.naam + ' is er altijd toestemming nodig; "geen" kan hier niet.' };
    if (k.rang >= 2 && regime !== 'schriftelijk')
      return { status: 400, error: 'Bij klasse ' + k.naam + ' is de toestemming schriftelijk.' };
    const tekst = schoon(b.tekst, 1000);
    if (regime !== 'geen' && tekst.length < 20)
      return { status: 400, error: 'Zet erbij wat u de deelnemer precies vertelt; een toestemming zonder tekst is geen toestemming.' };
    s.dossier.ethiek.toestemming = { regime, ouderlijk: !!b.ouderlijk || k.ouderlijk, tekst };
    audit(s.labId, 'ethiek.toestemming', wie, s.id, regime);
    save();
    return { ok: true, toestemming: s.dossier.ethiek.toestemming };
  }

  function stopcriteriumZet(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    if (b.weg) {
      s.dossier.ethiek.stopcriteria = s.dossier.ethiek.stopcriteria.filter(c => c.id !== String(b.criteriumId || ''));
      save();
      return { ok: true, stopcriteria: s.dossier.ethiek.stopcriteria };
    }
    const tekst = schoon(b.tekst, 300);
    if (tekst.length < 10) return { status: 400, error: 'Beschrijf waarbij dit onderzoek stopt, concreet genoeg om te herkennen.' };
    if (s.dossier.ethiek.stopcriteria.length >= 20) return { status: 400, error: 'Twintig stopcriteria is genoeg; scherp ze liever aan.' };
    s.dossier.ethiek.stopcriteria.push({ id: rid(), tekst, at: nu() });
    audit(s.labId, 'ethiek.stopcriterium', wie, s.id, '');
    save();
    return { ok: true, stopcriteria: s.dossier.ethiek.stopcriteria };
  }

  /* ---------- stilleggen ----------
     Alleen een toezichthouder, en een stilgelegde studie komt niet vanzelf weer
     op gang: hervatten vraagt dezelfde rol plus een reden. Dit is de knop die
     bij een stopcriterium hoort. */
  function stilleggen(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const door = schoon(b.door, 80);
    const t = bestuur.tekenaarVan(s.labId, door, 'toezichthouder');
    if (!t) return { status: 403, error: 'Alleen de ethisch toezichthouder van dit lab legt een onderzoek stil.' };
    const reden = schoon(b.reden, 300);
    if (reden.length < 10) return { status: 400, error: 'Waarom wordt dit onderzoek stilgelegd?' };
    if (b.hervat) {
      if (!s.dossier.ethiek.stilgelegd) return { status: 409, error: 'Dit onderzoek loopt gewoon.' };
      s.dossier.ethiek.stilgelegd = null;
      audit(s.labId, 'ethiek.hervat', door, s.id, reden);
      s.dossier.logboek.unshift({ id: rid(), tekst: 'Onderzoek hervat door ' + door + ': ' + reden, wie: door, at: nu() });
    } else {
      s.dossier.ethiek.stilgelegd = { door, reden, at: nu() };
      audit(s.labId, 'ethiek.stilleg', door, s.id, reden);
      s.dossier.logboek.unshift({ id: rid(), tekst: 'Onderzoek STILGELEGD door ' + door + ': ' + reden, wie: door, at: nu() });
    }
    save();
    return { ok: true, stilgelegd: s.dossier.ethiek.stilgelegd };
  }

  /* ---------- de klachtenprocedure ----------
     Een klacht kan van een deelnemer komen die verder geen rechten heeft, dus
     hij vraagt geen tekenbevoegdheid. Wat hij wél doet: in het auditspoor
     belanden en zichtbaar blijven tot iemand hem afhandelt. Een klacht die je
     kunt wegklikken is geen procedure. */
  function klacht(id, b) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const tekst = schoon(b.tekst, 1000);
    if (tekst.length < 10) return { status: 400, error: 'Beschrijf waar de klacht over gaat.' };
    if (s.dossier.ethiek.klachten.length >= 500) return { status: 400, error: 'Er staan te veel klachten open op dit onderzoek.' };
    const k = { id: rid(), tekst, van: schoon(b.alias, 40) || 'anoniem', status: 'open', antwoord: '', at: nu() };
    s.dossier.ethiek.klachten.unshift(k);
    audit(s.labId, 'ethiek.klacht', k.van, s.id, '');
    save();
    return { ok: true, klacht: { id: k.id, status: k.status, at: k.at } };
  }

  function klachtAf(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    b = b || {};
    const k = s.dossier.ethiek.klachten.find(x => x.id === String(b.klachtId || ''));
    if (!k) return { status: 404, error: 'Deze klacht bestaat niet.' };
    const door = schoon(b.door, 80);
    if (!bestuur.tekenaarVan(s.labId, door)) return { status: 403, error: 'Een klacht wordt afgehandeld door een tekenbevoegde van dit lab.' };
    const antwoord = schoon(b.antwoord, 1000);
    if (antwoord.length < 10) return { status: 400, error: 'Een klacht afsluiten zonder antwoord is hem wegklikken.' };
    k.status = 'afgehandeld'; k.antwoord = antwoord; k.doorWie = door; k.afAt = nu();
    audit(s.labId, 'ethiek.klachtAf', door, s.id, k.id);
    save();
    return { ok: true, klacht: { id: k.id, status: k.status } };
  }

  return { privacytoets, toestemmingZet, stopcriteriumZet, stilleggen, klacht, klachtAf };
};
