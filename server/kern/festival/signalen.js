/* RTG Festival (deelmodule): DE SIGNALEN VAN BUITEN.

   ./uitzondering.js rekent met wat het festival zelf meet: bezetting en
   instroom. Hier komt de tweede bron binnen -- wat ANDERE domeinen al
   bijhouden, en waar deze wereld niets van nabouwt (FESTIVAL.md par. 7).

   DRIE REGELS, EN ZE ZIJN ALLE DRIE EEN GRENS:

   1. ALLEEN VAN EEN BEVESTIGDE PARTNER, EN ALLEEN WAT HIJ DEELT. Een band
      bestaat pas als beide kanten hem sluiten, en de partner noemt zelf welke
      posten of lijnen het festival mag zien (./partner.js). Wie niets deelt,
      levert hier niets -- ook als de band bevestigd is.

   2. ER WORDT NIETS NAGEREKEND WAT EEN DOMEIN AL TELT. De open plekken komen
      uit bevRooster(), de storing uit storingLijst(). Dat is de graaf-regel uit
      PLATFORM.md, en hij is hier extra scherp: een tweede telling van een
      rooster gaat op de dag zelf uit de pas lopen met de echte.

   3. DE KERN WORDT LAAT GELEZEN. Deze laag hangt aan domeinen die in dezelfde
      ronde worden samengesteld; hij pakt ze dus op AANROEPMOMENT uit de kern en
      niet bij het opbouwen. Zelfde reden als bij de wereldlagen in
      opzet/kernlaag3w.js -- wie ze vroeg uitpakt, houdt een undefined vast.

   WAT ER NIET IN ZIT, EN WAAROM DAT ZO BLIJFT TOT HET BESTAAT:

     VOORRAAD. "Bar West raakt naar verwachting pilsvoorraad kwijt om 21:42" is
     een van de mooiste uitzonderingen die een festival kan tonen, en hij staat
     hier NIET. Reden: er is geen horeca-voorraadlaag om te lezen. kern/retail.js
     houdt voorraad bij voor mode (maten, collecties, drops) en niet voor een
     fust achter een bar. Een schatting op omzet zou een getal opleveren dat
     nergens vandaan komt, en dat is precies de schijnzekerheid waar dit huis
     niet aan doet (LAT-regel 3). Hij komt erbij zodra die laag er is.

     WEER. Zelfde verhaal: FESTIVAL.md par. 9 zegt dat deze wereld geen
     weersvoorspeller wordt. Zonder bron geen regel. */
'use strict';

module.exports = (ctx) => {
  const { editieVind, partnersVan } = ctx;

  /* De kern komt binnen als functie zodat hij LAAT wordt gelezen; bij het
     opbouwen bestaat de helft nog niet. */
  const kern = () => (typeof ctx.kern === 'function' ? ctx.kern() : ctx.kern) || {};

  /* ---------- beveiliging: onbezette posten ---------- */
  function bewaking(e, datum, uit) {
    const k = kern();
    if (typeof k.bevRooster !== 'function' || typeof k.findSupplier !== 'function') return;
    for (const p of partnersVan(e, 'beveiliging')) {
      const deelt = p.deelt || [];
      if (!deelt.length) continue;                 // bevestigd, maar niets vrijgegeven
      let zaak;
      try { zaak = k.findSupplier(p.zaak); } catch (err) { zaak = null; }
      if (!zaak) continue;
      let r;
      try { r = k.bevRooster(zaak, datum, 1); } catch (err) { continue; }
      const dag = ((r || {}).dagen || [])[0];
      if (!dag) continue;
      for (const post of (dag.posten || [])) {
        /* ALLEEN DE POSTEN DIE DE PARTNER HEEFT VRIJGEGEVEN. De rest van zijn
           rooster gaat over andere klanten en hoort een festival niet aan. */
        if (!deelt.includes(post.postId)) continue;
        if (!post.open) continue;
        uit.push({ bron: 'beveiliging', naam: post.post, ernst: post.open > 1 ? 'hoog' : 'aandacht', over: 0,
          zin: 'Post ' + post.post + ' mist ' + post.open + ' bewaker'
            + (post.open === 1 ? '' : 's') + ' op ' + datum + '.',
          herkomst: { zaak: p.zaak, post: post.postId, open: post.open } });
      }
    }
  }

  /* ---------- vervoer: een gemelde storing ----------

     DE VERTRAGING KOMT VAN DE VERVOERDER EN NIET VAN ONS. kern/mobiliteit/
     storing.js zegt dat met zoveel woorden: wij hebben posities maar geen
     dienstregeling per halte, dus "hoeveel te laat" kunnen wij niet berekenen.
     Deze laag meldt daarom DAT er een storing loopt en op welke lijn, en
     verzint geen minuten. */
  function vervoer(e, moment, uit) {
    const k = kern();
    if (typeof k.storingLijst !== 'function' || typeof k.findSupplier !== 'function') return;
    const nu = Date.parse(moment);
    if (!Number.isFinite(nu)) return;
    for (const p of partnersVan(e, 'vervoer')) {
      const deelt = p.deelt || [];
      if (!deelt.length) continue;
      let zaak;
      try { zaak = k.findSupplier(p.zaak); } catch (err) { zaak = null; }
      if (!zaak) continue;
      let r;
      try { r = k.storingLijst(zaak); } catch (err) { continue; }
      for (const st of ((r || {}).storingen || [])) {
        if (!deelt.includes(st.lijnId)) continue;
        const van = Date.parse(st.van), tot = Date.parse(st.tot);
        if (!Number.isFinite(van) || !Number.isFinite(tot)) continue;
        if (nu < van || nu > tot) continue;        // niet nu aan de hand
        uit.push({ bron: 'vervoer', naam: st.lijnNaam, ernst: 'hoog', over: 0,
          zin: st.lijnNaam + ': storing gemeld door de vervoerder'
            + (st.oorzaak ? ' (' + st.oorzaak + ')' : '') + '.',
          herkomst: { zaak: p.zaak, lijn: st.lijnId, soort: st.soort, van: st.van, tot: st.tot } });
      }
    }
  }

  /* Alles wat van buiten komt, op een hoop. De rangschikking gebeurt in
     ./uitzondering.js, samen met wat het festival zelf meet -- twee lijsten
     naast elkaar zou de leiding laten kiezen welke ze eerst leest. */
  function signalen(fid, eid, vraag) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const v = vraag || {};
    const datum = String(v.datum || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return { status: 400, error: 'Geef de datum als jjjj-mm-dd.' };
    const tijd = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v.tijd || '')) ? String(v.tijd) : '00:00';
    const uit = [];
    bewaking(e, datum, uit);
    vervoer(e, datum + 'T' + tijd + ':00.000Z', uit);
    return { ok: true, signalen: uit,
      /* Hoeveel bevestigde partners er MEEDOEN, en hoeveel er wel bevestigd
         zijn maar niets delen. Dat tweede getal is een bevinding: een band
         zonder gedeelde stukken levert stilte op, en stilte is geen rust. */
      partners: partnersVan(e).length,
      zonderDeling: partnersVan(e).filter(p => !(p.deelt || []).length).length };
  }

  return { signalen };
};
