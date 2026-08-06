/* Foundation OS, deel "geld-uitgaven": de aanvraag en het besluit.

   HIER STAAN DE DRIE GRENDELS DIE DE GELDSTROOM DRAGEN. Ze doen alle drie iets
   anders, en het weglaten van elk van de drie geeft een ander soort ongeluk:

   1. HET OORMERK. Een uitgave kan alleen bronnen aanspreken die bij dit project
      horen: het geoormerkte geld van dit project, of het niet-geoormerkte geld
      van deze stad. Zonder deze grendel betaalt de voedselhulp in Amsterdam
      stilletjes met het jongerengeld van Haarlem, en merkt niemand het tot de
      subsidieverantwoording.

   2. DE LIMIET. Een projectleider keurt tot 250 euro goed, een stadsbestuur tot
      2.500, daarboven het landelijke bestuur. Het getal komt uit basis.js
      (limietVan) en is per stad te verlagen, nooit te verhogen. Belangrijk:
      hij hangt aan de rol van wie BESLUIT, niet aan wie aanvraagt.

   3. VIER OGEN. Wie aanvraagt, besluit niet. Ook niet als hij daar de
      bevoegdheid voor heeft, en ook niet als het om vijf euro gaat -- een
      drempel waaronder je jezelf wel mag goedkeuren, is de drempel waar alles
      voortaan net onder blijft.

   EN EEN VIERDE, DIE GEEN GRENDEL IS MAAR REKENWERK: het vrije saldo telt de
   nog niet besloten aanvragen mee (geld.js: gereserveerd). Anders kan dezelfde
   euro twee keer worden aangevraagd zolang beide aanvragen open staan, en
   ontdek je het pas bij het tweede besluit. */

module.exports = (ctx, eigen) => {
  const { nu, rid, schoon, centen, euro, S, audit, wie, rolIn, poort, limietVan, save } = ctx;
  const { vindBron, vrij } = eigen;

  const uitgaveBeeld = u => ({ id: u.id, stad: u.stad, projectId: u.projectId, bronId: u.bronId,
    omschrijving: u.omschrijving, bedrag: euro(u.centen), status: u.status, door: u.door,
    besluitDoor: u.besluitDoor || null, besluitRol: u.besluitRol || null, reden: u.reden || '',
    at: u.at, besluitAt: u.besluitAt || null });

  function aanvraag(req, b) {
    b = b || {};
    const w = wie(req);
    const p = S().projecten.find(x => x.id === String(b.projectId || ''));
    if (!p) return { status: 404, error: 'Dit project bestaat niet.' };
    const g = poort(w, p.stad, 'uitgave.aanvragen', p.vlag);
    if (!g.ok) return g;
    if (!['goedgekeurd', 'actief'].includes(p.status)) {
      return { status: 400, error: 'Dit project staat op "' + p.status + '". Er wordt pas geld uitgegeven als het is goedgekeurd.' };
    }
    const r = boekAanvraag(w, p, b);
    if (!r.ok) return r;
    return { ok: true, uitgave: r.uitgave, nodig: nodigVoor(g.stad, r.centen) };
  }

  /* De aanvraag zelf, zonder poort en zonder req. Hier staan de controles die
     ALTIJD gelden -- het bedrag, het oormerk, het vrije saldo -- en niet de
     vraag of deze persoon hier mag zijn; die is een verdieping hoger al
     beantwoord.

     WAAROM DIT APART STAAT: de gezamenlijke inkoop (netwerk/inkoop.js) zet bij
     het sluiten per deelnemende stad een aanvraag klaar. Die zou anders zijn
     eigen kopie van deze controles krijgen, en dan is er een tweede weg naar
     het uitgavenregister met een eigen mening over oormerken (LAT.md regel 4).
     Nu is er een weg, en loopt ook inkoop gewoon door de vier ogen en de
     limiet van de ontvangende stad. */
  function boekAanvraag(w, p, b) {
    const c = centen(b.bedrag);
    if (c === null || c === 0) return { status: 400, error: 'Wat is het bedrag?' };
    const oms = schoon(b.omschrijving, 200);
    if (oms.length < 3) return { status: 400, error: 'Waar is dit geld voor?' };
    const bron = vindBron(b.bronId);
    if (!bron) return { status: 404, error: 'Kies een bron waaruit dit betaald wordt.' };
    if (bron.stad !== p.stad) {
      return { status: 400, error: 'Deze bron hoort bij een andere stad. Geld verschuift niet tussen steden zonder besluit van het landelijke bestuur.' };
    }
    /* Het oormerk. De zin noemt met opzet BEIDE projecten: "die bron mag hier
       niet heen" laat de lezer raden waar het geld dan wel voor is. */
    if (bron.projectId && bron.projectId !== p.id) {
      const ander = S().projecten.find(x => x.id === bron.projectId);
      return { status: 403, error: 'Dit geld is geoormerkt voor "' + ((ander && ander.naam) || bron.projectId) +
        '" en kan niet naar "' + p.naam + '". Het landelijke bestuur kan een bron herbestemmen, met toestemming van de gever.' };
    }
    /* De herkomstgrendel. Hij zit op de BRON en niet op de aanvrager (LAT.md
       regel 7): wie het geld ook wil aanspreken, uit welke stad en met welke
       rol, hij stuit op hetzelfde. Een grote gift waarvan niemand weet waar hij
       vandaan komt, beweegt niet -- dat is het verschil met een waarschuwing. */
    if (bron.herkomst && bron.herkomst.status === 'open') {
      return { status: 403, error: 'Deze bron is een ' + bron.herkomst.reden + ' en wacht op de herkomstcontrole van het ' +
        'landelijke bestuur. Tot die af is, kan er niets uit worden uitgegeven.' };
    }
    if (bron.herkomst && bron.herkomst.status === 'geweigerd') {
      return { status: 403, error: 'Het landelijke bestuur heeft deze gift geweigerd. Er wordt niets uit besteed; ' +
        'teruggeven loopt via de penningmeester.' };
    }
    const beschikbaar = vrij(bron);
    if (c > beschikbaar) {
      return { status: 400, error: 'Er is nog ' + euro(beschikbaar) + ' euro vrij in deze bron (het niet-besloten deel telt mee).' };
    }
    if (S().uitgaven.length >= 200000) return { status: 400, error: 'Het uitgavenregister zit vol.' };
    const u = { id: rid(), stad: p.stad, projectId: p.id, bronId: bron.id, omschrijving: oms,
      centen: c, status: 'aangevraagd', door: w.key, doorNaam: schoon(b.naam, 60) || w.key,
      leverancier: schoon(b.leverancier, 120), factuur: schoon(b.factuur, 80),
      uitInkoop: b.uitInkoop || null, at: nu() };
    S().uitgaven.push(u);
    audit(w.key, 'uitgave.aanvraag', p.naam, euro(c) + ' euro: ' + oms);
    save();
    return { ok: true, uitgave: uitgaveBeeld(u), centen: c };
  }

  // Welke rol dit bedrag zelfstandig kan goedkeuren. Voor het scherm, zodat een
  // aanvrager meteen ziet waar zijn aanvraag heen moet.
  function nodigVoor(stad, c) {
    if (c <= limietVan(stad, 'projectleider')) return 'projectleider';
    if (c <= limietVan(stad, 'stadsbestuur')) return 'stadsbestuur';
    return 'landelijk';
  }

  function besluit(req, id, akkoord, reden) {
    const w = wie(req);
    const u = S().uitgaven.find(x => x.id === String(id || ''));
    if (!u) return { status: 404, error: 'Deze aanvraag bestaat niet.' };
    if (u.status !== 'aangevraagd') return { status: 400, error: 'Over deze aanvraag is al besloten (' + u.status + ').' };
    const p = S().projecten.find(x => x.id === u.projectId);
    const g = poort(w, u.stad, 'uitgave.besluit', p ? p.vlag : null);
    if (!g.ok) return g;
    // Vier ogen. Staat vóór de limiet: anders leest iemand die zijn eigen
    // aanvraag opent eerst "te groot voor u" en denkt dat een hoger bedrag het
    // probleem is.
    if (u.door === w.key) {
      return { status: 403, error: 'U heeft deze uitgave zelf aangevraagd. Een ander besluit erover -- dat is het vierogenprincipe.' };
    }
    const rol = rolIn(w, u.stad);
    const grens = limietVan(g.stad, rol);
    if (akkoord === true && u.centen > grens) {
      return { status: 403, error: 'Deze uitgave van ' + euro(u.centen) + ' euro gaat boven uw grens van ' +
        (grens === Infinity ? 'onbeperkt' : euro(grens) + ' euro') + '. ' +
        (nodigVoor(g.stad, u.centen) === 'landelijk'
          ? 'Het landelijke RTF-bestuur beslist hierover.'
          : 'Leg hem voor aan het stadsbestuur.') };
    }
    const bron = vindBron(u.bronId);
    if (akkoord === true) {
      if (!bron) return { status: 404, error: 'De bron van deze aanvraag bestaat niet meer.' };
      /* Nog een keer rekenen op het moment van besluiten. Tussen aanvraag en
         besluit kan er van alles langs dezelfde bron zijn gegaan; de controle
         bij de aanvraag zegt niets meer over dit moment. De reservering van
         DEZE aanvraag telt niet tegen zichzelf. */
      const beschikbaar = vrij(bron) + u.centen;
      if (u.centen > beschikbaar) {
        return { status: 400, error: 'Er is nog maar ' + euro(beschikbaar) + ' euro in deze bron; er is intussen meer aangevraagd dan er in zit.' };
      }
      bron.besteed += u.centen;
      u.status = 'goedgekeurd';
    } else {
      u.status = 'afgewezen';
    }
    u.besluitDoor = w.key;
    u.besluitRol = rol;
    u.besluitAt = nu();
    u.reden = schoon(reden, 300);
    audit(w.key, 'uitgave.besluit', (p && p.naam) || u.projectId, u.status + ' ' + euro(u.centen) + ' euro');
    save();
    return { ok: true, uitgave: uitgaveBeeld(u) };
  }

  return { aanvraag, besluit, nodigVoor, uitgaveBeeld, boekAanvraag };
};
