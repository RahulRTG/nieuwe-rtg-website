/* Stuur-deel "lus": Rahul aan het stuur -- de AI-tool-lus. Met een AI-sleutel
   verstaat Rahul een vrije vraag en voert hij hem ook uit, met twee gereedschappen:
   'kaart' (welke paden kan ik) en 'doe' (voer uit via het stuur, dus met de inlog
   en de remmen van kern/stuur.js). Een lichte taak krijgt een korte lus van 4
   stappen; een zware taak wordt in maximaal 3 deeltaken gesplitst binnen een
   budget van 24. Zonder sleutel geeft dit null terug en blijven de vaste antwoorden
   van de assistenten staan. Draait op de context die kern/stuur.js opbouwt. */
const { TOOLS } = require('./gereedschap');
const besmetting = require('./besmetting');
const maakLusstap = require('./lusstap');
const { maakSpoor } = require('./spoor');
const menscontext = require('./menscontext');
const { LUS_REGELS, CONTEXT_REGELS } = require('./lusregels');
const { inhoudswoorden } = require('./resolver-woorden');
const beleid = require('./beleid');
const { maakIsolatiefilter } = require('./isolatiefilter');

module.exports = ({ anthropic, app, log, stuurRoep, stuurPaden, classificeer, parseSubs, isolatie }) => {
  /* De isolatiecontext staat in ./luscontext.js: klein stuk, groot gevolg. */
  const isoContextVan = require('./luscontext')({ isolatie });
  /* De huisregels die met elke beurt meegaan staan in ./lusregels.js. */

  async function stuurLus(req, opties) {
    if (!anthropic) return null;
    const vraag = String((opties && opties.vraag) || '').trim().slice(0, 1200);
    if (!vraag) return null;
    const isoContext = () => isoContextVan(req);

    /* WAT ER AAN DIT GESPREK HEEFT BIJGEDRAGEN, per gesprek en niet per proces.
       Twee lussen tegelijk zouden elkaars boekhouding overschrijven, en dan
       versmalt het gesprek van de een op de invoer van de ander. */
    const vuil = besmetting.nieuw();
    /* Het spoor: observeert, beslist niets. Zie ./spoor.js. */
    const spoor = (opties && opties.spoor) || maakSpoor({ vraag });
    /* DE MENSELIJKE CONTEXT, gesaneerd voor hij ergens aankomt (./menscontext.js).
       Hij levert WOORDEN voor de resolver en EEN REGEL voor het gesprek -- nooit
       een pad, een rol of een bevoegdheid. De stand is die van ./spoor.js zelf:
       geen context is OVERGESLAGEN, context zonder bruikbare rest is NOT_RUN. En
       PASS zegt alleen dat er iets gesaneerd is; of de resolver hem GEBRUIKT
       heeft staat op INTENT_RESOLVED (./lusstap.js). */
    const ctx = menscontext.saneer(opties && opties.context);
    const verw = ctx.verwijzingenUitslag || [];
    spoor && spoor.mark('CONTEXT_SANITIZED', ctx.stand, { woorden: ctx.woorden.length,
      gewist: ctx.gewist.length, verwijzingen: verw.length,
      canoniek: verw.filter((v) => v.stand === 'CANONIEK').length });
    const ctxRegel = menscontext.handtekening(ctx);
    /* WAT DE CONTEXT TOEVOEGT BOVENOP DE VRAAG, en niet meer dan dat. Een woord
       dat de mens zelf al typte, bewijst niets over de context -- alleen het
       verschil maakt `contextGebruikt` in ./lusstap.js een echte bewering. */
    const gezegd = new Set(inhoudswoorden(vraag));
    const ctxEigen = ctx.woorden.filter((w) => !gezegd.has(w));
    const metContext = (t) => (ctxRegel ? t + '\n\nActieve context: ' + ctxRegel : t);
    /* MANDATE_EVALUATED valt hier: zie de kop van ./spoor.js. */
    const paden = () => {
      const alle = stuurPaden(app, opties.wereld, isoContext(), vuil.bronnen());
      const over = alle.filter(opties.filter || (() => true));
      spoor && spoor.mark('MANDATE_EVALUATED', opties.filter ? 'PASS' : 'NOT_RUN',
        { voor: alle.length, na: over.length });
      return over;
    };
    /* De poort bij `doe` velt HETZELFDE oordeel als de kaart, en dat kan alleen
       door dezelfde functie te gebruiken. Nabouwen zou twee waarheden geven die
       allebei 'werken' en na een jaar iets anders zeggen. */
    const laag = typeof isolatie === 'function' ? isolatie() : isolatie;
    const stap = maakLusstap({ stuurRoep, vuil, spoor,
      filter: laag ? maakIsolatiefilter({ isolatie: laag, beleid }) : null });
    // een streamende voortgangsmelding (optioneel): de route koppelt dit aan de
    // SSE-bus, zodat de UI live "Stap 4/24: taxi zoeken..." kan tonen
    const opStap = typeof (opties && opties.opStap) === 'function' ? opties.opStap : () => {};
    const systeem = (opties.systeem || '') + '\n' + LUS_REGELS +
      (ctxRegel ? '\n' + CONTEXT_REGELS : '');
    const acties = [];

    /* Eén tool-lus met een stappen-budget en een globale teller. Geeft de
       eindtekst (als de agent klaar is) en de nieuwe tellerstand terug. `label`
       is de menselijke kop die tijdens deze (deel)taak wordt gestreamd. */
    /* `deeltaak` gaat mee naar de resolver: bij een zware opdracht zegt de
       deelstap beter waar deze lus over gaat dan het hoofddoel. Beide wegen. */
    async function loop(messages, budget, tel, totaal, label, deeltaak) {
      /* De contextwoorden reizen mee NAAR DE RESOLVER en niet eromheen: die
         kan met woorden alleen een lijst kleiner maken die hij binnenkrijgt,
         dus context kan hier structureel geen vermogen toevoegen. */
      const kaartVraag = [vraag, deeltaak, ctxEigen.join(' ')].filter(Boolean).join(' ');
      for (let s = 0; s < budget; s++) {
        const resp = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 1400, system: systeem, tools: TOOLS, messages
        });
        const wilTools = resp.content.filter(c => c.type === 'tool_use');
        if (!wilTools.length || resp.stop_reason !== 'tool_use') {
          const tekst = resp.content.filter(c => c.type === 'text').map(c => c.text).join('').trim();
          return { tekst, tel, klaar: true };
        }
        messages.push({ role: 'assistant', content: resp.content });
        const uitkomsten = [];
        for (const t of wilTools) {
          const uit = await stap.voerUit(req, t,
            { wereld: opties.wereld, kaartVraag, paden, acties, ctxWoorden: ctxEigen });
          uitkomsten.push({ type: 'tool_result', tool_use_id: t.id, content: JSON.stringify(uit).slice(0, 6000) });
        }
        tel++;
        try { opStap({ stap: tel, totaal, bericht: label }); } catch (e) {}
        messages.push({ role: 'user', content: uitkomsten });
      }
      return { tekst: '', tel, klaar: false };
    }

    const cls = classificeer(vraag);
    try {
      // ---- lichte taak: één korte lus van 4 stappen ----
      if (!cls.zwaar) {
        const r = await loop([{ role: 'user', content: metContext(vraag) }], 4, 0, 4, 'Bezig...');
        spoor && spoor.mark('PROJECTED', r.tekst ? 'PASS' : 'NOT_RUN', { tekens: (r.tekst || '').length });
        return { tekst: r.tekst || 'Gedaan.', acties, zwaar: false, stappen: r.tel, spoor: spoor ? spoor.uitslag() : undefined };
      }

      // ---- zware taak: de hoofd-agent splitst in max 3 deeltaken, elk een
      //      eigen kleine lus; samen binnen een budget van 24 stappen ----
      const totaal = cls.maxStappen; // 24
      let subs = [];
      try {
        const plan = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 350,
          system: 'Je bent een planner. Verdeel de opdracht in maximaal 3 concrete, uitvoerbare deeltaken. ' +
            'Antwoord UITSLUITEND met een JSON-array van korte NL-strings, niets anders.',
          messages: [{ role: 'user', content: vraag }]
        });
        subs = parseSubs(plan.content.filter(c => c.type === 'text').map(c => c.text).join(''));
      } catch (e) { subs = []; }
      if (!subs.length) subs = [vraag]; // geen nette splitsing? dan als één klus

      let tel = 0; const deel = [];
      const perSub = Math.max(4, Math.floor(totaal / subs.length));
      for (let i = 0; i < subs.length && tel < totaal; i++) {
        const label = subs[i];
        try { opStap({ stap: tel, totaal, bericht: label }); } catch (e) {}
        const seed = [{ role: 'user', content:
          'Hoofddoel van de gebruiker: ' + metContext(vraag) + '\nVoer NU alleen deze deeltaak volledig uit: ' + label +
          '\nStop zodra deze deeltaak klaar is en meld kort het resultaat.' }];
        const r = await loop(seed, Math.min(perSub, totaal - tel), tel, totaal, label, label);
        tel = r.tel;
        deel.push('- ' + label + ': ' + (r.tekst || 'gedaan'));
      }

      // ---- synthese: één kort antwoord voor de gebruiker ----
      let eind = deel.join('\n');
      try {
        const synth = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 500, system: systeem,
          messages: [{ role: 'user', content: 'Vat voor de gebruiker kort en concreet samen wat er is gedaan ' +
            '(en wat niet lukte, eerlijk). Deelresultaten:\n' + deel.join('\n') }]
        });
        const st = synth.content.filter(c => c.type === 'text').map(c => c.text).join('').trim();
        if (st) eind = st;
      } catch (e) {}
      try { opStap({ stap: totaal, totaal, bericht: 'Klaar', klaar: true }); } catch (e) {}
      return { tekst: eind || 'Gedaan.', acties, zwaar: true, stappen: tel, deeltaken: subs };
    } catch (e) {
      try { log && log.warn && log.warn('stuurlus', { fout: (e && e.message || '').slice(0, 120) }); } catch (e2) {}
      return null; // de vaste antwoorden vangen het op
    }
  }

  return stuurLus;
};

module.exports.TOOLS = TOOLS;
