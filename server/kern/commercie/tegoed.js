/* AI-TEGOED: capaciteit kopen, niet een model.

   Regel 5 en 6 van de eigenaar stonden tot nu toe in PRIJZEN.md als NIET
   afgedwongen, en dat was eerlijk: de laag bestond niet.

     5. AI boven de inbegrepen capaciteit vraagt een bundel, expliciete
        toestemming of een vooraf ingestelde aanvulling.
     6. Geen abonnement veroorzaakt ooit ONGEMERKT variabele kosten.

   Regel 6 is de strengste en bepaalt de vorm van dit bestand. "Ongemerkt" is het
   sleutelwoord: het gaat er niet om DAT er kosten zijn, maar dat een klant ze
   nooit ontdekt nadat ze zijn gemaakt. Vandaar dat `mag()` VOORAF antwoordt en
   niet achteraf meldt, en dat het antwoord bij een plafond niet "nee" is maar
   "nee, en dit is wat je kunt doen".

   DE VIER STANDEN BIJ HET PLAFOND, en het is een keuze van de klant zelf:

     STOP           er worden geen extra kosten gemaakt, punt
     VRAAG_MIJ      melding bij 80% en 100%, met een bundel binnen handbereik
     AUTO_AANVULLEN een gekozen bundel erbij zodra het tegoed op is, met een
                    maandmaximum
     CONTRACT       enterprise: het overschot loopt op het contract

   AUTO_AANVULLEN is er voor bedrijven. Een restaurant hoort niet op
   vrijdagavond te ontdekken dat de menukaartvertaling stilstaat. Maar het
   maandmaximum is niet optioneel: automatisch bijkopen zonder bovengrens IS
   ongemerkte variabele kosten, alleen met een vriendelijker naam. Zonder
   maximum weigert deze module de stand.

   EEN KLANT KOOPT CAPACITEIT, GEEN MODEL. Extern bestaan er RTG AI-credits en
   bundels (S, M, L, XL); nergens staat welk model erachter draait. Zo kan een
   beter of goedkoper model erin zonder dat er een contract opengebroken hoeft te
   worden. Intern mag alles in tokens en modelkosten gerekend worden -- die
   vertaling hoort in de meter en niet in het gesprek met de klant.

   EN NOOIT TOKENS TONEN. Niet "nog 1.293.582 tokens" maar "AI-tegoed deze
   maand: 72% gebruikt". `stand()` geeft daarom percentages en bundelnamen; het
   rauwe getal staat er wel in voor wie het nodig heeft, maar de vorm die een
   scherm hoort te gebruiken staat vooraan.

   WAT DIT NIET IS: een prijstabel voor bundels. De verkoopprijs van een bundel
   wordt gerekend en niet gekozen (inkoopkosten -> veiligheidsmarge ->
   platformmarge -> verkoopprijs), en die berekening hoort bij de inkoopkant die
   nog niet bestaat. Hier staat WAT een bundel is en hoeveel capaciteit hij
   geeft; wat hij kost, komt er later bij en staat als open punt in COMMERCIE.md. */
'use strict';

/* Tijd komt uit de tijdmachine en niet van het besturingssysteem: alleen zo is
   "wat gebeurt er op 29 februari" een vraag die je kunt stellen (server/lib/klok.js).
   De injecteerbare `nu` blijft bestaan -- toetsen zetten hem -- maar de TERUGVAL
   is de klok en niet Date.now(). */
const klok = require('../../lib/klok');

const caps = require('./capaciteiten');

/* Het inbegrepen tegoed per trede, in credits per maand. Nul betekent: deze
   trede heeft geen AI-tegoed, en dan is `mag()` altijd nee -- niet "onbeperkt".
   `null` betekent contractueel: de hoogte staat op het contract. */
const INBEGREPEN = {
  gratis: 0,
  rtg: 2000,
  'business-lite': 20000,
  business: null,        // contractueel
  lifestyle: null        // contractueel
};

/* De bundels. Alleen capaciteit en een naam -- geen model, geen tokens. De
   prijs ontbreekt met opzet: die wordt gerekend uit de inkoopkant, en die laag
   bestaat nog niet. Een verzonnen bedrag hier zou precies de fout zijn die
   PRIJZEN.md par. 4.12 beschrijft. */
const BUNDELS = {
  'ai-s': { id: 'ai-s', naam: 'AI Extra S', credits: 5000, wat: 'een kleine aanvulling' },
  'ai-m': { id: 'ai-m', naam: 'AI Extra M', credits: 20000, wat: 'een normale zakelijke aanvulling' },
  'ai-l': { id: 'ai-l', naam: 'AI Extra L', credits: 100000, wat: 'zwaar gebruik' },
  'ai-xl': { id: 'ai-xl', naam: 'AI Enterprise', credits: null, wat: 'overeengekomen capaciteit' }
};

const BELEID = { STOP: 'STOP', VRAAG_MIJ: 'VRAAG_MIJ', AUTO_AANVULLEN: 'AUTO_AANVULLEN', CONTRACT: 'CONTRACT' };

// bij welk deel van het tegoed er gewaarschuwd wordt
const WAARSCHUWING = 0.8;

function inbegrepenVoor(pas) {
  const v = INBEGREPEN[String(pas || '')];
  return v === undefined ? 0 : v;
}

function maakTegoed({ db, save, nu }) {
  const tijd = nu || klok.nu;
  function alles() {
    if (!db.data) db.data = {};
    if (!db.data.aiTegoed || typeof db.data.aiTegoed !== 'object') db.data.aiTegoed = {};
    return db.data.aiTegoed;
  }
  const maandVan = t => new Date(t).toISOString().slice(0, 7);

  /* De rij van een houder (een lid op codenaam, of een zaak op code). Rolt bij
     een nieuwe maand vanzelf om: verbruik is per maand, en een tegoed dat
     blijft staan zou "inbegrepen per maand" tot een leugen maken. */
  function rijVan(houder, pas, contractCredits) {
    const a = alles();
    const sleutel = String(houder || '');
    const maand = maandVan(tijd());
    let r = a[sleutel];
    if (!r || r.maand !== maand) {
      r = a[sleutel] = { houder: sleutel, pas, maand, verbruikt: 0, bijgekocht: 0,
        beleid: (r && r.beleid) || BELEID.VRAAG_MIJ,
        autoBundel: (r && r.autoBundel) || null,
        maandMaxCenten: (r && r.maandMaxCenten) || null,
        autoDezeMaandCenten: 0,
        gewaarschuwdOp: null, bundels: [] };
      save();
    }
    if (pas) r.pas = pas;
    const basis = Number.isFinite(contractCredits) ? contractCredits : inbegrepenVoor(r.pas);
    r.inbegrepen = Number.isFinite(basis) ? basis : null;
    return r;
  }

  /* DE VRAAG DIE VOORAF WORDT GESTELD. Geeft altijd een antwoord met een reden
     en, als het nee is, met wat de klant kan doen -- want "nee" zonder uitweg is
     precies het moment waarop een restaurant op vrijdagavond vastloopt. */
  function mag(houder, pas, kosten, opties) {
    const c = Math.max(0, Math.round(Number(kosten) || 1));
    const r = rijVan(houder, pas, (opties || {}).contractCredits);

    if (!caps.mag(r.pas, 'can_use_ai'))
      return { mag: false, reden: 'geen-ai', uitleg: 'Dit abonnement bevat geen AI-assistent.', bundels: [] };

    // contractueel: de hoogte staat op het contract, en zonder contractwaarde is
    // er geen plafond dat deze laag kent
    if (r.inbegrepen === null)
      return { mag: true, reden: 'contract', uitleg: 'De capaciteit staat op het contract.', rest: null };

    const beschikbaar = r.inbegrepen + r.bijgekocht - r.verbruikt;
    if (c <= beschikbaar) {
      const na = beschikbaar - c;
      const deel = r.inbegrepen + r.bijgekocht > 0 ? 1 - na / (r.inbegrepen + r.bijgekocht) : 1;
      return { mag: true, reden: 'binnen-tegoed', rest: na, gebruiktDeel: Math.min(1, Math.max(0, deel)),
        waarschuwing: deel >= WAARSCHUWING };
    }

    /* Over het plafond. Wat er nu gebeurt, is de KEUZE van de klant en niet van
       ons -- dat is regel 6. */
    const bundelsUit = Object.values(BUNDELS).filter(b => b.credits).map(b => ({ ...b }));
    if (r.beleid === BELEID.AUTO_AANVULLEN && r.autoBundel && BUNDELS[r.autoBundel]) {
      /* De prijs van de bundel telt mee in het maandmaximum. Stond hier nul
         zolang de inkoopkant niet bestond -- en een maximum waar niets tegenaan
         telt, is geen maximum. `prijsVan` komt via opties mee, want deze module
         kent de boardroom-instelling niet. */
      const kosten2 = Number.isFinite(((opties || {}).bundelPrijs || {}).centen) ? opties.bundelPrijs.centen : 0;
      const overMax = Number.isFinite(r.maandMaxCenten) &&
        (r.autoDezeMaandCenten + kosten2) > r.maandMaxCenten;
      if (overMax)
        return { mag: false, reden: 'maandmaximum', tekort: c - beschikbaar,
          uitleg: 'Het maandmaximum voor automatisch bijkopen is bereikt. Koop handmatig bij of verhoog het maximum.',
          bundels: bundelsUit };
      return { mag: true, reden: 'auto-aangevuld', bundel: r.autoBundel, tekort: c - beschikbaar,
        uitleg: 'Het tegoed is aangevuld met ' + BUNDELS[r.autoBundel].naam + '.' };
    }
    if (r.beleid === BELEID.CONTRACT)
      return { mag: true, reden: 'contract-overschot',
        uitleg: 'Het overschot loopt op het contract en wordt achteraf verrekend.' };

    return { mag: false, reden: r.beleid === BELEID.STOP ? 'gestopt' : 'plafond',
      tekort: c - beschikbaar,
      uitleg: r.beleid === BELEID.STOP
        ? 'Het tegoed is op en dit abonnement staat op "stoppen bij de limiet"; er worden geen extra kosten gemaakt.'
        : 'Het tegoed is op. Koop een bundel bij of zet automatisch aanvullen aan.',
      bundels: bundelsUit };
  }

  /* Verbruik boeken. Gebeurt NA `mag()` en niet in plaats daarvan: wie hier
     rechtstreeks binnenkomt, boekt verbruik dat niemand heeft toegestaan. Dat is
     geen theoretisch risico -- het is precies hoe ongemerkte kosten ontstaan. */
  function verbruik(houder, pas, kosten, opties) {
    const c = Math.max(0, Math.round(Number(kosten) || 0));
    const r = rijVan(houder, pas, (opties || {}).contractCredits);
    const oordeel = mag(houder, pas, c, opties);
    if (!oordeel.mag) return { ...oordeel, geboekt: 0 };

    if (oordeel.reden === 'auto-aangevuld') {
      const b = BUNDELS[r.autoBundel];
      r.bijgekocht += b.credits;
      r.bundels.unshift({ bundel: b.id, credits: b.credits, automatisch: true, at: tijd() });
    }
    r.verbruikt += c;
    if (oordeel.waarschuwing && !r.gewaarschuwdOp) r.gewaarschuwdOp = tijd();
    save();
    return { ...oordeel, geboekt: c, rest: restVan(r) };
  }

  function restVan(r) {
    if (r.inbegrepen === null) return null;
    return r.inbegrepen + r.bijgekocht - r.verbruikt;
  }

  /* Handmatig een bundel bijkopen. `prijs` is de gerekende verkoopprijs
     (kern/commercie/bundelprijs.js) en komt van de aanroeper, want alleen die
     kent de boardroom-instelling.

     ZONDER PRIJS GEEN VERKOOP. Staat de inkoopkant niet ingesteld, dan is er
     geen prijs, en dan hoort er niets verkocht te worden -- credits weggeven
     omdat een som ontbreekt, is de duurste manier om een gat te verbergen. */
  function koopBundel(houder, pas, bundelId, prijs) {
    const b = BUNDELS[String(bundelId || '')];
    if (!b) return { status: 404, error: 'Deze bundel bestaat niet.' };
    if (!b.credits) return { status: 400, error: b.naam + ' is een contractafspraak en wordt niet los gekocht.' };
    const centen = prijs && Number.isFinite(prijs.centen) ? prijs.centen : null;
    if (centen === null)
      return { status: 409, error: (prijs && prijs.reden) ||
        'Voor deze bundel is nog geen prijs vastgesteld; hij is daarom niet te koop.' };
    const r = rijVan(houder, pas);
    r.bijgekocht += b.credits;
    r.bundels.unshift({ bundel: b.id, credits: b.credits, centen, automatisch: false, at: tijd() });
    save();
    return { status: 200, ok: true, bundel: b.naam, centen, rest: restVan(r) };
  }

  /* Het beleid zetten. AUTO_AANVULLEN VRAAGT EEN MAANDMAXIMUM -- automatisch
     bijkopen zonder bovengrens is ongemerkte variabele kosten met een
     vriendelijker naam, en dat is precies wat regel 6 verbiedt. */
  function zetBeleid(houder, pas, data) {
    data = data || {};
    const beleid = String(data.beleid || '');
    if (!BELEID[beleid]) return { status: 400, error: 'Kies: stoppen bij de limiet, eerst vragen, automatisch aanvullen, of via het contract.' };
    const r = rijVan(houder, pas);
    if (beleid === BELEID.AUTO_AANVULLEN) {
      const b = BUNDELS[String(data.bundel || '')];
      if (!b || !b.credits) return { status: 400, error: 'Kies welke bundel er automatisch bij mag komen.' };
      const max = Math.round(Number(data.maandMaxCenten));
      if (!Number.isFinite(max) || max <= 0)
        return { status: 400, error: 'Automatisch aanvullen vraagt een maandmaximum: zonder bovengrens zijn het onzichtbare kosten.' };
      r.autoBundel = b.id;
      r.maandMaxCenten = max;
    }
    r.beleid = beleid;
    save();
    return { status: 200, ok: true, beleid: r.beleid, bundel: r.autoBundel, maandMaxCenten: r.maandMaxCenten };
  }

  /* De stand, in de vorm die een scherm hoort te tonen. Percentage vooraan,
     rauwe getallen erachter -- nooit tokens. */
  function stand(houder, pas, opties) {
    const r = rijVan(houder, pas, (opties || {}).contractCredits);
    if (r.inbegrepen === null)
      return { contractueel: true, tekst: 'AI-capaciteit volgens contract', beleid: r.beleid };
    const totaal = r.inbegrepen + r.bijgekocht;
    const deel = totaal > 0 ? Math.min(1, r.verbruikt / totaal) : 1;
    return {
      contractueel: false,
      gebruiktPct: Math.round(deel * 100),
      tekst: 'AI-tegoed deze maand: ' + Math.round(deel * 100) + '% gebruikt',
      waarschuwing: deel >= WAARSCHUWING,
      maand: r.maand, beleid: r.beleid, autoBundel: r.autoBundel, maandMaxCenten: r.maandMaxCenten,
      inbegrepen: r.inbegrepen, bijgekocht: r.bijgekocht, verbruikt: r.verbruikt, rest: restVan(r),
      bundels: Object.values(BUNDELS).map(b => ({ id: b.id, naam: b.naam, credits: b.credits, wat: b.wat }))
    };
  }

  /* Alle rijen, voor de ronde die waarschuwingen meldt. Geeft de rauwe rijen en
     niet een kopie: de ronde zet `gemeldOp` erop, en een kopie zou dat stempel
     kwijtraken -- en dan meldt hij elke ronde opnieuw hetzelfde. */
  function alleRijen() { return Object.values(alles()); }

  return { BELEID, BUNDELS, INBEGREPEN, mag, verbruik, koopBundel, zetBeleid, stand, rijVan, alleRijen };
}

module.exports = { maakTegoed, BELEID, BUNDELS, INBEGREPEN, inbegrepenVoor, WAARSCHUWING };
