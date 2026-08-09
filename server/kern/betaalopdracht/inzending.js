/* De betaalopdracht, deel "inzending": hem aanbieden bij de rail, opgeven als
   de rail blijft weigeren, en dan het geld terugdraaien. Dit is de kant die met
   de buitenwereld praat; wat een opdracht IS staat in ./index, de verzameling in
   ./rij. Krijgt de gedeelde ctx van ./index. */
'use strict';

module.exports = (ctx) => {
  const { save, nu, klacht, publiek, zet, wacht, maxPogingen, STATUS, AF, DEFINITIEF, railInzenden, terugboeken } = ctx;

  /* Eén poging bij de rail. Slaagt hij, dan is de opdracht ingediend (of meteen
     afgewikkeld als de rail dat zelf al meldt). Mislukt hij, dan telt de poging
     en schuift de volgende kans op; bij de laatste poging gaat hij naar MISLUKT
     en volgt de terugboeking. De fout wordt altijd bewaard: een opdracht die
     zonder reden stilstaat is hetzelfde probleem als daarvoor. */
  async function dienIn(opdracht) {
    const o = typeof opdracht === 'string' ? ctx.vind(opdracht) : opdracht;
    if (!o) return { status: 404, error: 'Die betaalopdracht bestaat niet.' };
    if (AF.has(o.status)) return publiek(o);
    if (o.status === STATUS.MISLUKT) { o.status = STATUS.INGEDIEND; o.pogingen = 0; } // met de hand opnieuw; zie OVERGANG
    o.pogingen += 1;
    o.laatstePogingAt = nu();
    let uit = null, fout = null;
    try { uit = await railInzenden(o); }
    catch (e) { fout = e; }

    if (fout) {
      o.laatsteFout = String((fout && fout.message) || fout || 'onbekende fout').slice(0, 300);
      if (o.pogingen >= maxPogingen) {
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
    return publiek(o);
  }

  /* De terugboeking na opgeven. De aanroeper levert hem, want alleen die weet
     welk grootboek en welke tegenrekening erbij horen. Slaagt hij niet, dan
     gaat de opdracht NIET dicht: hij blijft op MISLUKT en dus in openstaand(),
     zodat het kantoor het ziet in plaats van dat het geld zoekraakt. */
  async function draaiTerug(o) {
    if (typeof terugboeken !== 'function') {
      klacht('geen terugboeking ingesteld; het geld staat nog van de rekening af', { id: o.id, ledgerRef: o.ledgerRef });
      return false;
    }
    let r = null, fout = null;
    try { r = await terugboeken(o); }
    catch (e) { fout = e; }
    if (fout || !r || r.error || r.ok === false) {
      o.terugboekFout = String((fout && fout.message) || (r && r.error) || 'de terugboeking lukte niet').slice(0, 300);
      save();
      klacht('TERUGBOEKING MISLUKT -- geld staat van de klant af zonder bestemming', { id: o.id, ledgerRef: o.ledgerRef, fout: o.terugboekFout });
      return false;
    }
    zet(o, STATUS.TERUGGEBOEKT, { terugboekRef: (r && r.boeking && r.boeking.id) || null, terugboekFout: null });
    save();
    return true;
  }

  return { dienIn, draaiTerug };
};
