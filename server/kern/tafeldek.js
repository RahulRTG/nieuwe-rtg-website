/* De gedekte tafel: wijst de zaak een tafel toe aan een reservering, dan
   staat stoel 1 meteen klaar op de tafellijst -- codenaam, allergenen en
   wensen uit het zorgprofiel dat het lid deelt. De vloer typte dit tot nu
   toe over uit de reservering, of vergat het; het bord met noten hoort bij
   de juiste stoel te landen zonder dat iemand zijn allergie hardop herhaalt.

   Beide kanten bestonden al: het zorgprofiel reist met toestemming mee op de
   reservering (kern/gastzorg.js, routes/member/handel/uitjes.js) en de
   tafellijst met stoelen is er voor events (kern/tafelwensen.js). Alleen het
   moment van dekken verbond ze niet.

   De toestemming wordt OP HET MOMENT ZELF opnieuw gevraagd (zorgVoor, live)
   en niet uit de momentopname op de reservering gelezen: wie het delen
   intrekt tussen reserveren en dekken, staat nergens. Zelfde regel als de
   vriendencontrole in kern/kletspraat.

   De tafelplanning roept dit aan via een laat gebonden, optionele haak
   (tafeldekVan); zonder deze laag werkt het toewijzen gewoon door. */
function maakTafeldek({ tafelwensen, zorgVoor }) {

  function dekUitReservering(zaakCode, r) {
    if (!r || !r.customerKey || !r.tafel) return { gedekt: false };
    const zorg = zorgVoor(r.customerKey);
    if (!zorg) return { gedekt: false };
    /* Het zorgprofiel is vrije tekst, de tafellijst kent vaste woorden: wat
       daar niet in past gaat leesbaar mee in de notitie in plaats van stil
       te verdwijnen -- een allergie die wegvalt is erger dan een dubbele. */
    const laag = s => String(s || '').toLowerCase().trim();
    const allergenen = (zorg.allergenen || []).map(laag).filter(a => tafelwensen.ALLERGENEN.includes(a));
    const restAllergie = (zorg.allergenen || []).map(laag).filter(a => a && !tafelwensen.ALLERGENEN.includes(a));
    const dieet = laag(zorg.dieet);
    const wensen = tafelwensen.WENSEN.filter(w => dieet.includes(w));
    const notitie = [
      restAllergie.length ? 'allergie: ' + restAllergie.join(', ') : '',
      dieet && !wensen.length ? dieet : '',
      zorg.medisch ? 'medisch: ' + zorg.medisch : ''
    ].filter(Boolean).join(' · ');
    if (!allergenen.length && !wensen.length && !notitie) return { gedekt: false };

    const gast = { stoel: 1, naam: r.customerCodename || 'gast', allergenen, wensen, notitie };
    /* Bestaat de tafel al op de lijst van die dag (de gastvrouw was ons
       voor), dan schuift deze gast erbij zonder iets van haar werk te
       overschrijven; anders begint de lijst hier. */
    const lijst = tafelwensen.tafelLijst(zaakCode, { wanneer: r.datum });
    const bestaand = (lijst.tafels || []).find(t => String(t.tafel) === String(r.tafel));
    let gasten;
    if (bestaand) {
      gasten = (bestaand.gasten || []).filter(g => g.naam !== gast.naam);
      const bezet = new Set(gasten.map(g => g.stoel));
      while (bezet.has(gast.stoel)) gast.stoel += 1;
      gasten = gasten.concat([gast]);
    } else gasten = [gast];
    const res = tafelwensen.tafelZet(zaakCode, {
      tafel: String(r.tafel), wanneer: r.datum, gasten,
      event: bestaand ? bestaand.event : null,
      gastvrouw: bestaand ? bestaand.gastvrouw : null,
      notitie: bestaand ? bestaand.notitie : ''
    }, bestaand ? bestaand.id : null);
    if (res.error) return { gedekt: false };
    return { gedekt: true, tafelwensId: res.tafel.id, stoel: gast.stoel };
  }

  return { tafeldek: { dekUitReservering } };
}

module.exports = { maakTafeldek };
