/* Het gesprek van de Butler (kern/fluister): fluisterZeg verstaat de vraag,
   antwoordt (Claude of eigen regels) en handelt met de drempel: alles met
   geld of een poolclaim wordt eerst een voorstel dat u met "ja" bevestigt.
   Verbatim afgesplitst uit acties.js; voerUit komt via de context binnen. */
module.exports = (ctx) => {
  const { db, save, schoon, anthropic, notify, reserveerTafel, annuleerReservering,
    assetGebruik, zorgVoor, pay, acties, nu, wieBen, lijsten, van,
    fluisterOnthoud, fluisterVergeet, teSnel, fluisterSeintjes, standVan, topFocus, eur, datumInZin,
    butlerExtra, voerReisUit, voerKledingUit, voerUit, sparHouding, sparParkeer } = ctx;
  // sparren: waaraan Rahul herkent dat je wil meedenken over een idee
  const SPAR = /\b(spar(ren)?|brainstorm|denk (even )?met me mee|wat vind je van (mijn |het )?idee|help me (na)?denken)\b/i;
  const intent = require('./intent')(ctx);
  /* Het gesprek. Eerst de eigen commando's (onthouden, opvragen, vergeten);
     daarna Claude met het volledige persoonlijke beeld, of de eigen regels. */
  async function fluisterZeg(key, codenaam, qIn, sess) {
    const q = String(qIn || '').trim().slice(0, 600);
    if (!q) return { status: 400, error: 'Zeg iets.' };
    if (teSnel(key)) return { status: 429, error: 'Even op adem komen: te veel berichten achter elkaar. Probeer het over een minuutje weer.' };
    const p = van(key);
    // het antwoord gaat ook het gespreksgeheugen in (laatste 5 beurten);
    // voorstel=true betekent: er staat iets klaar dat op "ja" wacht
    const klaar = (antwoord, gedaan, voorstel) => {
      p.gesprek.push({ u: q, a: String(antwoord).slice(0, 400), at: nu() });
      p.gesprek = p.gesprek.slice(-5);
      save();
      return { ok: true, antwoord, gedaan: !!gedaan, voorstel: !!voorstel, pakte: true };
    };
    if (/^onthoud\b/i.test(q)) {
      const r = fluisterOnthoud(key, q);
      if (r.error) return r;
      return { ok: true, antwoord: 'Onthouden: "' + r.weetjes[r.weetjes.length - 1].tekst + '". U kunt dit altijd terugzien of wissen met "wat weet je over mij".', geleerd: true, pakte: true };
    }
    if (/vergeet alles/i.test(q)) {
      fluisterVergeet(key, 'alles');
      p.gesprek = [];
      p.focus = {};
      p.wacht = null;
      save();
      return { ok: true, antwoord: 'Alles gewist: uw weetjes, ons gesprek en de gebruikstellers. We beginnen met een schone lei.', geleerd: true, pakte: true };
    }
    if (/wat (weet|onthoud) je (over|van) mij/i.test(q)) {
      const regels = [];
      if (p.weetjes.length) regels.push('U vertelde me: ' + p.weetjes.map(w => '"' + w.tekst + '"').join(', ') + '.');
      const top = topFocus(p, 3);
      if (top.length) regels.push('En ik zie dat u het meest werkt met: ' + top.join(', ') + '.');
      if (!regels.length) regels.push('Nog niets. Vertel me iets met "onthoud dat..." of gebruik de app; ik leer vanzelf wat u belangrijk vindt.');
      if (p.gesprek.length) regels.push('Verder onthoud ik alleen de laatste ' + p.gesprek.length + ' beurt(en) van ons gesprek.');
      regels.push('Wissen kan per weetje of in een keer ("vergeet alles").');
      return { ok: true, antwoord: regels.join(' '), pakte: true };
    }
    // "wat kun je": een eerlijk overzicht van alles wat hij kan
    if (/\bwat (kun|kan) (je|jij|u)\b/i.test(q) || /^help[!?.]?$/i.test(q)) {
      const basis = 'Ik onthoud wat u vertelt ("onthoud dat..."), vertel precies wat ik weet ("wat weet je over mij"), wis alles op verzoek en geef seintjes bij alles wat nadert.';
      if (!sess) return { ok: true, antwoord: basis + ' Vraag me gerust naar de actuele stand van uw dienst.', pakte: true };
      return { ok: true, antwoord: basis + ' En ik regel het ook: zoeken door het hele aanbod ("zoek sushi"), uw dag plannen ("plan mijn dag"), een tafel reserveren of annuleren, bestellen en afrekenen ("bestel 2 sangria bij Sunset Ibiza"), tickets boeken ("boek 2 tickets voor de sunset cruise morgen"), een behandeling in de spa of kliniek boeken ("boek een massage bij Zenith morgen om 15:00"), een taxi of transfer regelen, uw 24-uursblok plannen, uw saldo opvragen, een Tik sturen, en betaalverzoeken maken, tonen en betalen. Alles met geld of een poolclaim vraagt altijd eerst uw "ja".', pakte: true };
    }
    /* Sparren: Rahul denkt mee om het idee samen beter te maken, niet om zijn
       gelijk te halen. De gedachte wordt geparkeerd, zodat hij er op een rustig
       moment (thuis, lege agenda) uit zichzelf op terug kan komen. */
    let sparModus = false;
    if (SPAR.test(q)) {
      sparModus = true;
      const idee = q.replace(SPAR, '').replace(/^\s*(kun je|wil je|kunnen we|laten we|even|met me|over)\b/gi, '').replace(/\s+/g, ' ').trim().slice(0, 200);
      if (sparParkeer && idee) try { sparParkeer(key, idee, 'gesprek'); } catch (e) {}
      if (!anthropic) return klaar('Goed, laten we samen sparren. Ik denk mee om het beter te maken, niet om mijn gelijk te halen. Wat wil je met dit idee bereiken, en waar zit nu je grootste twijfel? Dan noem ik een kans en een risico. Ben je nu druk? Ik heb het geparkeerd en kom er op een rustig moment op terug.');
    }
    /* De reislaag (kern/fluister/reis.js): een hele reis op een vraag,
       kleding en voorspellen voor leden, en de servicedag voor zaak en
       personeel (zonder sessie). "ja"/"nee" matcht hier bewust niet, dus
       de bevestigingsdrempel hieronder blijft de baas. */
    if (butlerExtra) {
      const extra = await butlerExtra(q, p, sess, klaar, key);
      if (extra) return extra;
    }
    /* ---- doen: Fluister voert het ook echt uit, alleen voor het lid zelf
       (sess reist alleen mee op de leden-route, nooit voor personeel).
       Boven de drempel (geld, of een claim op een gedeeld object) eerst
       een voorstel; pas op "ja" gebeurt het echt. ---- */
    if (sess && !sparModus) {
      // de doe-laag (kern/fluister/intent.js): loopt de intent-handlers langs
      // en voert uit (met de bevestigingsdrempel voor geld/poolclaims); geeft
      // null terug als geen handler pakt, dan valt dit door naar de AI hieronder.
      // In sparmodus slaan we dit over: dan wil je meedenken, niet iets doen.
      const gedaan = await intent.doeActie({ q, p, klaar, key, codenaam, sess });
      if (gedaan) return gedaan;
    }

    const stand = standVan(key);
    const seintjes = fluisterSeintjes(key);
    if (anthropic) {
      try {
        const ctx = 'Lid: ' + codenaam + '. ' +
          (p.weetjes.length ? 'Weetjes die het lid zelf deelde: ' + p.weetjes.map(w => w.tekst).join('; ') + '. ' : '') +
          (topFocus(p, 3).length ? 'Gebruikt het meest: ' + topFocus(p, 3).join(', ') + '. ' : '') +
          (stand.length ? 'Actuele stand: ' + stand.join('; ') + '. ' : '') +
          (seintjes.length ? 'Actuele seintjes: ' + seintjes.map(x => x.tekst).join('; ') + '.' : '');
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 300,
          system: require('../rahul').rahulLeadVoor(key) + 'je bent de persoonlijke rechterhand in de RTG-app. Antwoord kort, warm en concreet, in de taal van de vraag. Gebruik het persoonlijke beeld alleen als het helpt. ' + (sparHouding ? sparHouding() + ' ' : '') + 'Context: ' + ctx,
          messages: [...p.gesprek.flatMap(g => [{ role: 'user', content: g.u }, { role: 'assistant', content: g.a }]), { role: 'user', content: q }]
        });
        return klaar(response.content[0].text);
      } catch (e) { /* val terug op de eigen regels */ }
    }
    // de eigen regels: persoonlijk waar het kan, eerlijk waar het moet
    const groet = p.weetjes.length ? 'Ik denk aan uw ' + p.weetjes.length + ' weetje(s). ' : '';
    const fluistert = seintjes.length ? ' Mijn seintjes: ' + seintjes.map(x => x.icoon + ' ' + x.tekst).join(' | ') + '.' : '';
    if (stand.length || seintjes.length) return klaar(groet + (stand.length ? 'Dit speelt er nu voor u: ' + stand.join('; ') + '.' : 'Er staat niets open.') + fluistert + ' Vraag gerust door, of leer me iets met "onthoud dat...".');
    // niets persoonlijks te melden: pakte=false, zodat de app dit gesprek
    // aan de gewone gesprekslaag kan geven (het brein deed hier niets mee)
    const r = klaar(groet + 'Ik ben ' + wieBen(key) + '. Leer me kennen met "onthoud dat..." en vraag "wat weet je over mij" wanneer u wilt; wissen kan altijd. Ik kan ook zoeken en regelen: reserveren, uw 24 uur plannen, een Tik of een betaalverzoek.');
    r.pakte = false;
    return r;
  }



  return { fluisterZeg };
};
