/* DE DIGITALE TWEELING -- eerst simuleren, dan pas live.

   Twee dingen kun je hier doen:

   1. EEN WAT-ALS op de werkelijke aantallen: "wat gebeurt er als Amsterdam
      morgen 30% meer gebruikers krijgt?" Dat rekent door op de collecties die
      er nu zijn, met de aannames er zichtbaar bij.

   2. EEN VEILIGE WIJZIGING: een beleidsregel eerst door de simulatie halen en
      zien wat hij aan routering en herstel verandert vóórdat hij gezet wordt.

   DE AANNAMES STAAN IN DE UITSLAG, ALTIJD. Een simulatie zonder zichtbare
   aannames is een voorspelling, en een voorspelling zonder aannames is een
   mening met cijfers eromheen. Wie de uitslag leest, moet kunnen zien welke
   knop de uitkomst maakte -- en hem kunnen bestrijden.

   WAT DIT NIET IS. Geen verkeersmodel en geen economisch model. Het rekent
   lineair door op gemeten aantallen en zegt dat er ook bij. Een simulatie die
   meer stelligheid uitstraalt dan haar model draagt, is gevaarlijker dan geen
   simulatie -- dan wordt er beleid op gemaakt. */
'use strict';

const { s } = require('./register');

/* De vaste aannames van het model, benoemd zodat ze bespreekbaar zijn. Ze
   staan hier en niet verspreid door de formules. */
const AANNAMES = [
  { id: 'lineair', wat: 'Volume schaalt lineair mee met het aantal gebruikers', gevolg: 'onderschat piekgedrag' },
  { id: 'capaciteitVast', wat: 'De huidige capaciteit (voertuigen, zaken, medewerkers) blijft gelijk', gevolg: 'wachttijd loopt op zodra de bezetting boven 85% komt' },
  { id: 'foutkansGelijk', wat: 'De gemeten foutkans per object blijft gelijk', gevolg: 'meer volume geeft evenredig meer uitzonderingen' },
  { id: 'wachttijdKwadratisch', wat: 'Boven 85% bezetting groeit de wachttijd kwadratisch, niet lineair', gevolg: 'de knik zit bij 85%, niet bij 100%' }
];

function maakSimulatie({ db, runbooks, zaken, beleid, risico, register }) {
  const SOORTEN = register.SOORTEN;
  const rijen = (d, so) => register.rijen(d, so);
  /* De huidige stand waarop gesimuleerd wordt: per domein het volume en de
     gemeten foutkans (aandeel objecten dat nu een runbook-kandidaat is). */
  function grondslag(plaats) {
    const filter = plaats ? String(plaats).toLowerCase() : '';
    const per = new Map();
    for (const soort of SOORTEN) {
      const alle = rijen(db, soort);
      const raak = filter
        ? alle.filter(r => ['city', 'plaats', 'stad', 'place', 'from', 'to'].some(v => s(r[v]).toLowerCase().includes(filter)))
        : alle;
      const g = per.get(soort.domein) || { domein: soort.domein, objecten: 0, capaciteit: 0 };
      g.objecten += raak.length;
      if (soort.type === 'voertuig' || soort.type === 'rijksvoertuig' || soort.type === 'zaak') g.capaciteit += raak.length;
      per.set(soort.domein, g);
    }
    for (const rb of runbooks.lijst()) {
      const soort = SOORTEN.find(x => x.type === rb.type);
      if (!soort) continue;
      const g = per.get(soort.domein);
      if (g) g.storend = (g.storend || 0) + rb.kandidaten;
    }
    return [...per.values()].map(g => Object.assign(g, {
      foutkans: g.objecten ? g.storend / g.objecten || 0 : 0
    }));
  }

  /* WAT-ALS: groei in procenten, eventueel voor één plaats. */
  function watAls({ groeiProcent, plaats, capaciteitErbij }) {
    const groei = Number(groeiProcent || 0) / 100;
    const extraCap = Number(capaciteitErbij || 0);
    const basis = grondslag(plaats);
    const regels = basis.map(g => {
      const nieuwVolume = Math.round(g.objecten * (1 + groei));
      const nieuweCap = g.capaciteit + extraCap;
      const bezettingNu = g.capaciteit ? g.objecten / g.capaciteit : 0;
      const bezettingStraks = nieuweCap ? nieuwVolume / nieuweCap : 0;
      /* De knik bij 85%: daaronder groeit de wachttijd mee met de bezetting,
         daarboven kwadratisch. Dat is de aanname 'wachttijdKwadratisch', en
         hij staat in de uitslag zodat je hem kunt bestrijden. */
      const wacht = (b) => b <= 0.85 ? b : 0.85 + Math.pow((b - 0.85) / 0.15, 2) * 0.6;
      const uitzonderingenNu = Math.round(g.objecten * g.foutkans);
      const uitzonderingenStraks = Math.round(nieuwVolume * g.foutkans);
      return {
        domein: g.domein,
        volume: { nu: g.objecten, straks: nieuwVolume, erbij: nieuwVolume - g.objecten },
        capaciteit: { nu: g.capaciteit, straks: nieuweCap },
        bezetting: { nu: Math.round(bezettingNu * 100), straks: Math.round(bezettingStraks * 100) },
        wachtindex: { nu: Math.round(wacht(bezettingNu) * 100), straks: Math.round(wacht(bezettingStraks) * 100) },
        uitzonderingen: { nu: uitzonderingenNu, straks: uitzonderingenStraks,
          erbij: uitzonderingenStraks - uitzonderingenNu },
        knelpunt: g.capaciteit > 0 && bezettingStraks > 0.85
      };
    }).filter(r => r.volume.nu > 0);

    const menselijkPerUitzondering = 12;   // minuten; hetzelfde getal als in werkbesparing.js zijn bron
    const extraUitzonderingen = regels.reduce((n, r) => n + r.uitzonderingen.erbij, 0);
    return {
      vraag: (groeiProcent || 0) + '% groei' + (plaats ? ' in ' + plaats : '') +
        (extraCap ? ', ' + extraCap + ' capaciteit erbij' : ''),
      regels,
      knelpunten: regels.filter(r => r.knelpunt).map(r => r.domein),
      extraUitzonderingen,
      extraMensuren: Math.round(extraUitzonderingen * menselijkPerUitzondering / 60),
      aannames: AANNAMES,
      model: 'lineair volume, kwadratische wachttijd boven 85% bezetting, foutkans uit de huidige runbook-kandidaten'
    };
  }

  /* VEILIGE WIJZIGING: wat doet deze beleidswaarde met de routering? Zonder
     iets te zetten. Dit is de stap die vóór beleid.zet() hoort. */
  function beleidsproef(regelId, nieuweWaarde) {
    const id = String(regelId);
    const huidig = beleid.waarde(id, null);
    const rbs = runbooks.lijst();
    const voor = rbs.map(rb => ({ id: rb.id, naam: rb.naam, kandidaten: rb.kandidaten,
      niveau: rb.oordeel.niveau, score: rb.oordeel.score }));

    /* De proef schuift de grens NIET in het register maar rekent het oordeel
       opnieuw met de voorgestelde waarde. Zo raakt een simulatie nooit per
       ongeluk de echte regel -- de fout die dit soort proeven berucht maakt. */
    const schaduw = {
      getal: (k, d) => k === id ? Number(nieuweWaarde) : beleid.getal(k, d),
      waarde: (k, d) => k === id ? nieuweWaarde : beleid.waarde(k, d)
    };
    const proefRisico = require('./risico').maakRisico({ beleid: schaduw });
    const na = rbs.map(rb => {
      const vol = runbooks.OP_ID.get(rb.id);
      const o = proefRisico.beoordeel(vol.actie, { aantal: rb.kandidaten || 1,
        klantImpact: vol.klantImpact, onomkeerbaar: !vol.terugDraaibaar });
      return { id: rb.id, naam: rb.naam, kandidaten: rb.kandidaten, niveau: o.niveau, score: o.score };
    });

    const wijzigingen = na.filter((n, i) => n.niveau !== voor[i].niveau)
      .map(n => { const v = voor.find(x => x.id === n.id); return { runbook: n.id, naam: n.naam,
        van: v.niveau, naar: n.niveau, kandidaten: n.kandidaten }; });

    const meerAuto = wijzigingen.filter(w => w.naar === 'auto').reduce((n, w) => n + w.kandidaten, 0);
    const minderAuto = wijzigingen.filter(w => w.van === 'auto').reduce((n, w) => n + w.kandidaten, 0);

    return { regel: id, van: huidig, naar: nieuweWaarde,
      wijzigingen,
      gevolg: wijzigingen.length
        ? (meerAuto - minderAuto >= 0
          ? 'Netto ' + (meerAuto - minderAuto) + ' geval(len) meer autonoom herstelbaar.'
          : 'Netto ' + (minderAuto - meerAuto) + ' geval(len) minder autonoom; die gaan naar een mens.')
        : 'Deze waarde verandert de routering van geen enkel runbook.',
      voor, na,
      risicoWaarschuwing: Number(nieuweWaarde) > beleid.getal('risico.mensGrens', 70) && id === 'risico.autoGrens'
        ? 'De autogrens komt boven de mensgrens te liggen; dan is er geen tussengebied meer en handelt de machine alles zelf af.'
        : null };
  }

  return { watAls, beleidsproef, grondslag, AANNAMES };
}

module.exports = { maakSimulatie, AANNAMES };
