/* ============================================================================
   DE FESTIVALWERELD -- een editie met een dag, een terrein en een product.

   HET PROBLEEM. Vierenvijftig routes onder /api/festival/ zeggen precies
   hetzelfde: "Deze editie bestaat niet." De editie is de wortel van dit
   domein -- dagen, plekken, producten, passen, bezetting en bewijs hangen er
   allemaal onder.

   WAAROM DE OBJECTOOGST HIER NIET BIJ KON, en dat is een ANDERE reden dan bij
   de rtfos-wereld. Daar lag het aan de tak; hier aan de NAAM. De oogst
   herkent een maakroute aan de staart van zijn pad (maak, nieuw, zet...), en
   de deur naar een editie heet `/api/festival/editie` -- genoemd naar het
   ding, niet naar het werkwoord.

   Dat is geen incident, en er is gemeten hoe groot het is voor er iets werd
   gebouwd: over alle 2252 routes in FIXTURE_404 en _422 hebben er 141 een
   zusterroute die zo heet, en 56 daarvan zijn de rtfos-stad die al een wereld
   heeft. Een generiek mechanisme zou dus ~85 routes opleveren en een nieuwe
   klasse fouten introduceren; een sleepnet over alle lege takken was al
   gebouwd en weer weggegooid (zie de kop van ./objectoogst.js). Vandaar hier
   een wereld, met de hand, voor de 54 die het waard zijn.

   DE KETEN, en elke veldnaam is uit de bron gelezen en niet geraden:

     /api/festival/nieuw    de zaak begint een festival        -> festival.id
     /api/festival/editie   het jaar erbij                     -> editie.id
     /api/festival/dag      datum + open/SLUIT (niet `dicht`)  -> dag.id
     /api/festival/plek     eerst een `terrein` (de enige      -> plek.id
                            wortelsoort), dan een podium
                            DAARIN -- een plek zonder ouder
                            wordt geweigerd
     /api/festival/product  naam, prijs en minstens EEN recht  -> product.id
                            ("een product zonder rechten geeft
                            nergens toegang toe")
     /api/festival/pas      een `drager` (een codenaam) plus   -> pas.id
                            een product of losse rechten

   DE ZAAK MOET DEZELFDE ZIJN. mijn(req) eist `f.eigenaar === req.supplier
   .code`, dus dit loopt op de zaaksessie van de proef en niet op een andere.
   En de zaak moet de cap `tickets` dragen; de demo-zaak heeft die (gemeten:
   200 op /api/festival/nieuw), en zo niet dan komt dat MET REDEN terug.

   WAT DIT KLAARZET zijn zes velden. Wat het niet doet is iets verkopen of
   scannen: er staat een lege editie klaar, en wat de proef daarna meet blijft
   onaangeraakt. */
'use strict';

async function zetFestivalKlaar({ post, tokens }) {
  const stappen = [];
  const sup = (tokens || {}).supplier;
  if (!sup) {
    return { klaar: false, extra: {}, stappen,
      reden: 'zonder zaaksessie is er niemand die een festival kan beginnen' };
  }

  const doe = async (naam, pad, lijf) => {
    let a = null;
    try { a = await post(pad, lijf, sup); } catch (e) { a = null; }
    const ok = a && a.status >= 200 && a.status < 300;
    stappen.push({ naam, pad, status: a ? a.status : 0, ok,
      waarom: ok ? null : ((a && a.data && a.data.error) || 'geen antwoord') });
    return ok ? a.data : null;
  };

  const f = await doe('het festival beginnen', '/api/festival/nieuw', { naam: 'RTG Proeffestival' });
  const festival = f && f.festival && f.festival.id;
  if (!festival) return { klaar: false, extra: {}, stappen, reden: 'het festival kwam er niet; zie stappen' };

  const ed = await doe('de editie openen', '/api/festival/editie', { festival, jaar: 2026, naam: 'Proefeditie' });
  const editie = ed && ed.editie && ed.editie.id;
  if (!editie) return { klaar: false, extra: { festival }, stappen, reden: 'de editie kwam er niet; zie stappen' };

  const B = { festival, editie };
  const extra = { festival, editie };

  const d = await doe('een festivaldag', '/api/festival/dag',
    { ...B, datum: '2026-07-01', open: '12:00', sluit: '23:00', curfew: '22:45' });
  if (d && d.dag && d.dag.id) extra.dag = d.dag.id;

  /* Eerst het terrein: `terrein` is de enige soort die wortel mag zijn
     (kern/festival/soorten.js). Alles daarna hangt eraan. */
  const t = await doe('het terrein', '/api/festival/plek',
    { ...B, naam: 'Proefterrein', soort: 'terrein', capaciteit: 5000 });
  const terrein = t && t.plek && t.plek.id;
  if (terrein) {
    extra.terrein = terrein;
    const pk = await doe('een podium op het terrein', '/api/festival/plek',
      { ...B, naam: 'Mainstage', soort: 'podium', ouder: terrein, capaciteit: 2000 });
    if (pk && pk.plek && pk.plek.id) extra.plek = pk.plek.id;
  }

  const pr = await doe('een product met een recht', '/api/festival/product',
    { ...B, naam: 'Dagticket', prijs: 45, rechten: [{ soort: 'entree.terrein' }] });
  const product = pr && pr.product && pr.product.id;
  if (product) {
    extra.product = product;
    const ps = await doe('een pas op een codenaam', '/api/festival/pas',
      { ...B, soort: 'crew', drager: 'RTG-PROEF', productId: product });
    if (ps && ps.pas && ps.pas.id) extra.pas = ps.pas.id;
  }

  /* De wereld is KLAAR zodra de editie er is: dat is wat de 54 routes vroegen.
     Wat daarna niet lukte staat met reden in de stappen en verkleint alleen
     wat er daarachter te meten valt -- het maakt de wereld niet ongeldig. */
  return { klaar: true, extra, stappen, reden: null };
}

module.exports = { zetFestivalKlaar };
