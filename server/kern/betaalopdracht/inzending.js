/* De betaalopdracht, deel "inzending": hem aanbieden bij de rail, opgeven als
   de rail blijft weigeren, en dan het geld terugdraaien. Dit is de kant die met
   de buitenwereld praat; wat een opdracht IS staat in ./index, de verzameling in
   ./rij. Krijgt de gedeelde ctx van ./index. */
'use strict';

module.exports = (ctx) => {
  const { save, nu, klacht, publiek, zet, wacht, maxPogingen, STATUS, AF, DEFINITIEF,
    railInzenden, terugboeken, verwerkAfwikkeling } = ctx;

  /* Eén poging bij de rail. Slaagt hij, dan is de opdracht ingediend (of meteen
     afgewikkeld als de rail dat zelf al meldt). Mislukt hij, dan telt de poging
     en schuift de volgende kans op; bij de laatste poging gaat hij naar MISLUKT
     en volgt de terugboeking. De fout wordt altijd bewaard: een opdracht die
     zonder reden stilstaat is hetzelfde probleem als daarvoor.

     MAAR NIET ELKE FOUT IS EEN MISLUKKING (MONEY-012). Een time-out of een
     verbroken verbinding NA het versturen zegt niet dat er niets is betaald;
     hij zegt dat wij het niet weten. Terugboeken op zo'n fout maakt geld uit
     niets zodra de rail hem wel uitvoerde. Daarom telt alleen een fout die de
     rail zelf als `nietVerstuurd` merkt (hij kwam niet verder dan onze kant van
     de deur) mee voor opgeven-en-terugboeken. Elke andere fout -- en elke fout
     op een opdracht die de rail eerder al had AANGENOMEN -- maakt de uitkomst
     onbekend: na de laatste poging gaat hij naar ONBEKEND, blijft openstaan en
     wacht op een uitspraak van de rail. Onbekend is geen mislukt. */
  async function dienIn(opdracht) {
    const o = typeof opdracht === 'string' ? ctx.vind(opdracht) : opdracht;
    if (!o) return { status: 404, error: 'Die betaalopdracht bestaat niet.' };
    if (AF.has(o.status)) return publiek(o);
    /* Heeft de rail hem al eens aangenomen? Vastgesteld VOOR de handmatige
       herstart hieronder, want die zet MISLUKT op INGEDIEND zonder dat de rail
       iets heeft gezegd. */
    const wasAangenomen = o.status === STATUS.INGEDIEND || !!o.settlementRef;
    if (o.status === STATUS.MISLUKT) { o.status = STATUS.INGEDIEND; o.pogingen = 0; } // met de hand opnieuw; zie OVERGANG
    o.pogingen += 1;
    o.laatstePogingAt = nu();
    let uit = null, fout = null;
    try { uit = await railInzenden(o); }
    catch (e) { fout = e; }

    if (fout) {
      o.laatsteFout = String((fout && fout.message) || fout || 'onbekende fout').slice(0, 300);
      /* `misschienVerstuurd` gaat nooit meer uit. Daarom blijft een ONBEKENDE
         opdracht die met de hand opnieuw wordt aangeboden en weer geen antwoord
         krijgt vanzelf ONBEKEND: hij kan via deze weg niet meer bij opgeven-en-
         terugboeken komen, alleen via een uitspraak van de rail (bevestig). */
      if (wasAangenomen || !(fout && fout.nietVerstuurd === true)) o.misschienVerstuurd = true;
      if (o.pogingen >= maxPogingen && o.misschienVerstuurd) {
        zet(o, STATUS.ONBEKEND, { volgendeAt: null });
        save();
        klacht('betaalopdracht ONBEKEND na ' + o.pogingen + ' pogingen: de rail kan hem hebben uitgevoerd, er wordt NIET teruggeboekt', { id: o.id, ledgerRef: o.ledgerRef, fout: o.laatsteFout });
      } else if (o.pogingen >= maxPogingen) {
        zet(o, STATUS.MISLUKT, { volgendeAt: null });
        save();
        klacht('betaalopdracht opgegeven na ' + o.pogingen + ' pogingen, geld wordt teruggeboekt', { id: o.id, ledgerRef: o.ledgerRef, fout: o.laatsteFout });
        await draaiTerug(o);
      } else {
        o.volgendeAt = nu() + wacht(o.pogingen);
        save();
        klacht('betaalopdracht mislukt, nieuwe poging ingepland', { id: o.id, poging: o.pogingen, over: wacht(o.pogingen), fout: o.laatsteFout });
      }
      return publiek(o);
    }

    const railStatus = String((uit && uit.status) || '').toLowerCase();
    zet(o, DEFINITIEF.has(railStatus) ? STATUS.AFGEWIKKELD : STATUS.INGEDIEND,
      { settlementRef: (uit && uit.id) || null, railStatus, laatsteFout: null, volgendeAt: null });
    save();
    if (o.status === STATUS.AFGEWIKKELD) await verwerkAfwikkeling(o);
    return publiek(o);
  }

  /* De terugboeking na opgeven. De aanroeper levert hem, want alleen die weet
     welk grootboek en welke tegenrekening erbij horen. Slaagt hij niet, dan
     gaat de opdracht NIET dicht: hij blijft op MISLUKT en dus in openstaand(),
     zodat het kantoor het ziet in plaats van dat het geld zoekraakt. */
  async function draaiTerug(o) {
    let r = null, fout = null;
    try { r = await terugboeken(o); }
    catch (e) { fout = e; }
    if (fout || !r || r.error || r.ok === false) {
      o.terugboekFout = String((fout && fout.message) || (r && r.error) || 'de terugboeking lukte niet').slice(0, 300);
      save();
      klacht('TERUGBOEKING MISLUKT -- geld staat van de klant af zonder bestemming', { id: o.id, ledgerRef: o.ledgerRef, fout: o.terugboekFout });
      return false;
    }
    const voor = Object.assign({}, o);
    zet(o, STATUS.TERUGGEBOEKT, { terugboekRef: (r && r.boeking && r.boeking.id) || null, terugboekFout: null });
    try { save(); }
    catch (e) {
      /* De teruggang zelf hoort economisch idempotent te zijn. Zet bij een
         opslagfout de opdracht terug, zodat de retry diezelfde teruggang met
         dezelfde opdracht-id opnieuw kan bewijzen en daarna bewaren. */
      for (const sleutel of Object.keys(o)) if (!Object.prototype.hasOwnProperty.call(voor, sleutel)) delete o[sleutel];
      Object.assign(o, voor);
      throw e;
    }
    return true;
  }

  return { dienIn, draaiTerug };
};
