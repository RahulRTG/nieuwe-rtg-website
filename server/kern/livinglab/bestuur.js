/* RTF Living Lab, deel "bestuur": meerdere labs onder één RTF, met lokale
   autonomie en centrale kaders. Een lab in Haarlem werkt anders dan een lab in
   Nairobi of Dubai, en dat mag -- zolang het onder dezelfde codebase en dezelfde
   ondergrens blijft.

   DE VERDELING, want dit is de plek waar "autonomie" anders een leeg woord is:

   - CENTRAAL (RTF, niet lokaal te wijzigen): de onderzoekscyclus, de
     bewijsgraden, de risicoklassen en wat elke klasse aan waarborgen eist. Die
     staan in ./kader.js en er is hier geen enkele functie die eraan komt. Een
     lab kan de lat dus niet lager leggen dan de RTF hem legt.
   - LOKAAL (het lab zelf): welke projectsoorten het voert, de bewaartermijn
     BOVEN het centrale minimum, de taal, wie er tekenbevoegd is, en of het lab
     open of op uitnodiging werkt.

   Het verschil is niet cosmetisch. `bewaarMaanden` mag lokaal omhoog (een lab
   dat langer wil bewaren voor een longitudinale studie) maar nooit onder
   BEWAAR_MIN, want dat is de ondergrens waarop de RTF verantwoording aflegt. */
'use strict';

const kader = require('./kader');

const BEWAAR_MIN = 12;      // maanden; centraal, lokaal niet te onderschrijden
const BEWAAR_MAX = 120;

module.exports = (ctx) => {
  const { nu, rid, schoon, getal, lijst, S, audit, auditKeten, vindLab, save } = ctx;

  const pub = l => ({ id: l.id, stad: l.stad, naam: l.naam, land: l.land, actief: l.actief,
    soorten: l.soorten, bewaarMaanden: l.bewaarMaanden, toegang: l.toegang, taal: l.taal,
    tekenaars: l.tekenaars, budget: l.budget, partners: l.partners, at: l.at });

  function labs() {
    return { ok: true, labs: S().labs.map(pub), centraal: { bewaarMin: BEWAAR_MIN, bewaarMax: BEWAAR_MAX } };
  }

  function labMaak(b, wie) {
    b = b || {};
    const stad = schoon(b.stad, 60), naam = schoon(b.naam, 80);
    if (stad.length < 2) return { status: 400, error: 'In welke stad staat dit lab?' };
    if (naam.length < 2) return { status: 400, error: 'Hoe heet dit lab?' };
    if (S().labs.some(l => l.actief && l.stad.toLowerCase() === stad.toLowerCase()))
      return { status: 409, error: 'Deze stad heeft al een Living Lab; voeg er een afdeling aan toe in plaats van een tweede lab.' };
    if (S().labs.length >= 500) return { status: 400, error: 'Het labregister zit vol.' };
    const l = { id: rid(), stad, naam, land: schoon(b.land, 40) || 'Nederland', actief: true,
      // lokaal: welke soorten dit lab voert. Leeg = alle soorten die de RTF kent.
      soorten: lijst(b.soorten, 20, 20).filter(s => kader.soort(s)),
      bewaarMaanden: Math.max(BEWAAR_MIN, getal(b.bewaarMaanden || 36, 0, BEWAAR_MAX)),
      toegang: b.toegang === 'uitnodiging' ? 'uitnodiging' : 'open',
      taal: schoon(b.taal, 8) || 'nl',
      tekenaars: [], budget: { toegekend: 0, besteed: 0, bron: '' }, partners: [],
      at: nu() };
    S().labs.unshift(l);
    audit(l.id, 'lab.maak', wie, l.id, stad + ' / ' + naam);
    save();
    return { ok: true, lab: pub(l) };
  }

  function labZet(id, b, wie) {
    const l = vindLab(id); if (!l) return { status: 404, error: 'Dit lab bestaat niet.' };
    b = b || {};
    if (b.naam != null) l.naam = schoon(b.naam, 80) || l.naam;
    if (b.land != null) l.land = schoon(b.land, 40) || l.land;
    if (b.taal != null) l.taal = schoon(b.taal, 8) || l.taal;
    if (b.toegang != null) l.toegang = b.toegang === 'uitnodiging' ? 'uitnodiging' : 'open';
    if (b.soorten != null) l.soorten = lijst(b.soorten, 20, 20).filter(s => kader.soort(s));
    if (b.actief != null) l.actief = !!b.actief;
    if (b.bewaarMaanden != null) {
      const m = getal(b.bewaarMaanden, 0, BEWAAR_MAX);
      /* De ondergrens is geen advies. Wie hem probeert te onderschrijden krijgt
         een fout en niet stil een bijgestelde waarde: een lab dat denkt op zes
         maanden te staan terwijl het op twaalf staat, belooft zijn deelnemers
         iets anders dan er gebeurt. */
      if (m < BEWAAR_MIN) return { status: 400, error: 'De RTF-ondergrens is ' + BEWAAR_MIN + ' maanden bewaren; een lab kan daar lokaal niet onder.' };
      l.bewaarMaanden = m;
    }
    audit(l.id, 'lab.zet', wie, l.id, Object.keys(b).join(','));
    save();
    return { ok: true, lab: pub(l) };
  }

  /* Tekenbevoegden: wie in dit lab een ethische review of een besluit mag
     ondertekenen. Een naam alleen is geen bevoegdheid -- ./ethiek.js kijkt hier
     of de tekenaar bestaat en welke rol hij heeft. */
  function tekenaarZet(id, b, wie) {
    const l = vindLab(id); if (!l) return { status: 404, error: 'Dit lab bestaat niet.' };
    b = b || {};
    const naam = schoon(b.naam, 80);
    const rol = kader.rol(b.rol);
    if (naam.length < 2) return { status: 400, error: 'Wie is dit? Een handtekening draagt altijd een naam.' };
    if (!rol) return { status: 400, error: 'Kies een geldige rol.' };
    if (!rol.rechten.includes('tekenen')) return { status: 400, error: 'De rol ' + rol.naam + ' tekent niet; kies professional, reviewer of toezichthouder.' };
    if (b.weg) {
      l.tekenaars = l.tekenaars.filter(t => !(t.naam === naam && t.rol === rol.rol));
      audit(l.id, 'tekenaar.weg', wie, naam, rol.rol);
    } else {
      if (l.tekenaars.some(t => t.naam === naam && t.rol === rol.rol)) return { status: 409, error: 'Deze tekenaar staat er al.' };
      if (l.tekenaars.length >= 100) return { status: 400, error: 'Het tekenaarsregister van dit lab zit vol.' };
      l.tekenaars.push({ naam, rol: rol.rol, onafhankelijk: !!b.onafhankelijk, at: nu() });
      audit(l.id, 'tekenaar.bij', wie, naam, rol.rol);
    }
    save();
    return { ok: true, lab: pub(l) };
  }

  const tekenaarVan = (labId, naam, rol) => {
    const l = vindLab(labId); if (!l) return null;
    const n = schoon(naam, 80);
    return l.tekenaars.find(t => t.naam === n && (!rol || t.rol === rol)) || null;
  };

  /* Budget en partners: subsidie- en contractbeheer op labniveau. Geen
     betaalverkeer -- dat loopt langs de bestaande poorten waar een mens tekent;
     hier staat alleen wat er is toegekend en wat eraan besteed is. */
  function budgetZet(id, b, wie) {
    const l = vindLab(id); if (!l) return { status: 404, error: 'Dit lab bestaat niet.' };
    b = b || {};
    l.budget = { toegekend: getal(b.toegekend, 0, 100000000), besteed: getal(b.besteed, 0, 100000000),
      bron: schoon(b.bron, 120) };
    if (l.budget.besteed > l.budget.toegekend)
      return { status: 400, error: 'Er staat meer besteed dan toegekend; corrigeer eerst de toekenning.' };
    audit(l.id, 'budget.zet', wie, l.id, l.budget.toegekend + '/' + l.budget.besteed);
    save();
    return { ok: true, lab: pub(l) };
  }

  function partnerZet(id, b, wie) {
    const l = vindLab(id); if (!l) return { status: 404, error: 'Dit lab bestaat niet.' };
    b = b || {};
    const naam = schoon(b.naam, 80);
    if (naam.length < 2) return { status: 400, error: 'Hoe heet de partner?' };
    if (b.weg) { l.partners = l.partners.filter(p => p.naam !== naam); audit(l.id, 'partner.weg', wie, naam, ''); }
    else {
      if (l.partners.some(p => p.naam === naam)) return { status: 409, error: 'Deze partner staat er al.' };
      if (l.partners.length >= 200) return { status: 400, error: 'Het partnerregister van dit lab zit vol.' };
      l.partners.push({ naam, soort: schoon(b.soort, 40) || 'organisatie', contract: schoon(b.contract, 120), at: nu() });
      audit(l.id, 'partner.bij', wie, naam, '');
    }
    save();
    return { ok: true, lab: pub(l) };
  }

  /* Het auditspoor van een lab, nieuwste eerst. Filterbaar op studie, want een
     toezichthouder die één studie onderzoekt wil niet het hele lab doorspitten.

     `keten` gaat over het HELE spoor en niet over de gefilterde regels
     hieronder; zie de uitleg bij audit() in ./opslag.js. Dat is met opzet: een
     filter mag nooit bepalen of het bewijs klopt. */
  function auditlog(labId, over, max) {
    const l = vindLab(labId); if (!l) return { status: 404, error: 'Dit lab bestaat niet.' };
    let rijen = S().audit.filter(a => a.labId === l.id);
    if (over) rijen = rijen.filter(a => a.over === String(over));
    return { ok: true, totaal: rijen.length, regels: rijen.slice(0, getal(max || 200, 1, 1000)),
      keten: auditKeten() };
  }

  /* De bewaarveger van dit domein. Studies ouder dan de bewaartermijn van hun
     lab verliezen hun RUWE data (observaties, datasets, deelnemers) maar houden
     hun conclusies en het auditspoor: dat is precies de scheiding tussen
     persoonsgegevens minimaliseren en kennis niet weggooien.

     Hij wordt aangeroepen, hij draait niet uit zichzelf. Zie ./index.js. */
  function veeg(refDatum) {
    const ref = refDatum ? new Date(refDatum) : new Date();
    let geveegd = 0, regels = 0;
    for (const s of S().studies) {
      const l = vindLab(s.labId); if (!l) continue;
      const grens = new Date(ref); grens.setMonth(grens.getMonth() - l.bewaarMaanden);
      if (new Date(s.at) > grens || s.geveegd) continue;
      const d = s.dossier;
      regels += d.observaties.length + d.deelnemers.length + d.datasets.length;
      d.observaties = []; d.deelnemers = []; d.datasets = [];
      s.geveegd = nu();
      audit(l.id, 'bewaar.veeg', 'systeem', s.id, 'ruwe data gewist na ' + l.bewaarMaanden + ' maanden');
      geveegd++;
    }
    if (geveegd) save();
    return { ok: true, studies: geveegd, regels };
  }

  return { labs, labMaak, labZet, tekenaarZet, tekenaarVan, budgetZet, partnerZet, auditlog, veeg,
    BEWAAR_MIN, BEWAAR_MAX };
};
