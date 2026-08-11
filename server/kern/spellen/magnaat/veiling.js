/* Magnaat: DE VEILING -- wat er onder de hamer gaat, en wat er dan overgaat.

   Het GESPREK (inzetten, bieden, intrekken) staat in ./veiling-acties.js, op
   dezelfde naad als bij de contracten: dit bestand kent het OBJECT en de
   afloop, dat bestand kent wat een speler mag doen. De eerste verandert niet
   meer, de tweede groeit met elke fase.

   HET TWEEDE STUK VAN FASE B, en het is er om precies de reden die contracten
   NIET konden waarmaken. De strateeg mat dat een contract tussen twee spelers
   te klein is om een duel te kantelen: een restaurant koopt vijf procent van
   zijn omzet aan vervoer in. Een kavel is geen vijf procent. Wie een plek
   wegkaapt, kaapt hem HELEMAAL weg -- dat is de eerste plek in dit spel waar
   twee spelers echt om hetzelfde ding vechten.

   TWEE DINGEN GAAN ONDER DE HAMER, en het verschil zit in wie hem inzet:

     KAVEL      -- een vrije plek. Iedereen mag er een inzetten, en dat is met
                   opzet: zonder veiling is een goede plek een wedstrijdje
                   klikken, en dan wint wie toevallig online was.
     VESTIGING  -- je eigen zaak, inclusief de contracten die eraan hangen. Zo
                   kun je eruit stappen zonder de wereld kapot te maken (de
                   contracten van je afnemers blijven staan) en kan een ander
                   groeien zonder te bouwen.

   GESLOTEN BIEDINGEN, en dat is de reden dat `zicht` in fase A al een
   waarschuwing droeg. Zolang alles aan tafel lag klopte "iedereen ziet alles";
   met een veiling niet meer. Een bod is van de bieder tot de hamer valt --
   ../weergave.js laat het aantal biedingen zien en geen enkel bedrag. Zonder
   die geslotenheid is een veiling een aftelling waarin iedereen elkaar
   overbiedt met een euro, en dat is een geduldspel en geen inschatting.

   EERSTE PRIJS EN GEEN TWEEDE. Je betaalt wat je bood. Een tweedeprijsveiling
   is theoretisch netter -- eerlijk bieden wordt dan je beste zet -- maar aan
   tafel is "ik bood 300.000 en betaal 210.000" een regel die je drie keer moet
   uitleggen, en dit spel wordt gespeeld door mensen die geen veilingtheorie
   hebben gelezen. De prijs van die keuze is dat je jezelf kunt overbieden, en
   dat is een fout die je begrijpt.

   DE KLOK IS DE KLOK VAN DE PARTIJ. Een veiling loopt een aantal SPELMAANDEN en
   niet een aantal minuten: anders verliest wie slaapt, en dat is precies de
   ratel die GAMEHALL.md 12.6 verbiedt. Hij sluit bij het bijrekenen, dus
   deterministisch -- tien maanden in een keer sluit dezelfde veiling met
   dezelfde winnaar als tien maanden los. */
const rond = (n) => Math.round(n);

/* Hoe lang een veiling loopt, in spelmaanden. Kort genoeg dat een Quick van
   zesendertig maanden er meerdere kent, lang genoeg dat iemand die een dag niet
   kijkt nog mee kan doen. */
const LOOPTIJD = { kort: 2, normaal: 4, lang: 8 };
const MAX_LOPEND = 3;   // per speler; anders zet iemand de halve kaart in de etalage

module.exports = ({ K, wieHeeft, afkoopsom }) => {
  const lopende = (st) => (st.veilingen || []).filter(v => v.status === 'loopt');

  /* Wat er MINIMAAL geboden moet worden. Voor een kavel de bouwgrond, voor een
     vestiging de halve bouwsom -- precies wat sluiten zou opleveren, want
     anders is verkopen aan de sloop beter dan verkopen aan een collega. */
  function bodem(st, x) {
    if (x.soort === 'kavel') {
      const kavel = K(st).kavel.get(x.kavel);
      return kavel ? rond(kavel.eigenschappen.huur * 240) : 0;
    }
    const w = wieHeeft(st, x.vestiging);
    return w ? rond(w.v.gebouwdVoor * 0.5) : 0;
  }

  /* ---------- de hamer ----------
     Wordt bij het bijrekenen aangeroepen, VOOR de maand gerekend wordt: wie een
     zaak koopt hoort hem die maand ook te draaien. Geeft terug wat er gebeurd
     is, zodat het op het maandoverzicht van beide partijen komt. */
  function hameren(potje) {
    const st = potje.staat;
    const uit = [];
    for (const v of lopende(st)) {
      if (st.maand < v.sluitMaand) continue;
      /* De volgorde: hoogste bod eerst, en bij een gelijk bod wie het EERST
         bood. Dat laatste is geen willekeur maar de enige volgorde die niet van
         de sleutelvolgorde in een object afhangt -- en die zou per Node-versie
         kunnen verschillen. */
      const rij = v.biedingen.map((b, i) => Object.assign({ i }, b))
        .sort((a, b) => b.bedrag - a.bedrag || a.i - b.i);
      let gegund = null;
      const gemist = [];
      for (const bod of rij) {
        if (st.geld[bod.speler] >= bod.bedrag) { gegund = bod; break; }
        gemist.push(bod.speler);
      }
      v.status = 'gesloten';
      v.gemist = gemist;
      if (!gegund) { uit.push({ id: v.id, soort: v.soort, verkocht: false, gemist }); continue; }
      v.winnaar = gegund.speler;
      v.prijs = gegund.bedrag;
      uit.push(Object.assign({ id: v.id, soort: v.soort, verkocht: true, prijs: v.prijs,
        koper: v.winnaar, gemist }, gunnen(potje, v)));
    }
    return uit;
  }

  /* Wat er werkelijk overgaat. Bij een kavel: het geld gaat naar de POT (het is
     grond van de stad, niet van de inzetter) en de koper krijgt een bouwrecht
     dat hij zelf nog moet invullen. Bij een vestiging: het geld gaat naar de
     verkoper, en de zaak verhuist MET zijn contracten mee. */
  function gunnen(potje, v) {
    const st = potje.staat;
    st.geld[v.winnaar] -= v.prijs;
    if (v.soort === 'kavel') {
      /* Het kavel wordt gereserveerd, niet bebouwd: WAT er komt is nog steeds
         een keuze. De reservering is de hele koop -- daarom staat er ook geen
         bouwsom tegenover. */
      (st.kavelRecht = st.kavelRecht || {})[v.kavel] = v.winnaar;
      // de grondopbrengst gaat naar de Foundation-pot van de stad; zie ./foundation.js
      st.foundation.lokaal += v.prijs;
      return { kavel: v.kavel };
    }
    const w = wieHeeft(st, v.vestiging);
    if (!w) return { mislukt: 'die vestiging bestaat niet meer' };
    st.geld[w.speler] += v.prijs;
    st.vestigingen[w.speler] = st.vestigingen[w.speler].filter(x => x !== w.v);
    st.vestigingen[v.winnaar].push(w.v);
    st.kavelBezet[w.v.kavel] = v.winnaar;
    /* DE CONTRACTEN VERHUIZEN MEE, en dat is het hele punt van een vestiging
       kunnen verkopen. Zou een overname de contracten breken, dan is verkopen
       een manier om je verplichtingen kwijt te raken -- en dan is elke
       leverancier ineens een risico dat je niet kunt inschatten. Wie koopt,
       koopt de zaak met alles eraan. */
    let mee = 0;
    for (const c of st.contracten || []) {
      if (c.status !== 'loopt') continue;
      if (c.leverancierId === w.v.id) { c.leverancier = v.winnaar; mee++; }
      if (c.afnemerId === w.v.id) { c.afnemer = v.winnaar; mee++; }
    }
    /* Een contract met JEZELF kan niet bestaan: dan is er geen wederpartij meer
       die de boete int, en zou een speler zichzelf onbeperkt kunnen beboeten of
       betalen. Zo'n contract wordt afgekocht tegen de gewone som -- betaald
       door de koper, die dit wist toen hij bood. */
    for (const c of st.contracten || []) {
      if (c.status !== 'loopt' || c.leverancier !== c.afnemer) continue;
      const som = afkoopsom(c, st.maand);
      c.status = 'afgekocht'; c.eindMaand = st.maand; c.afkoop = som;
      mee--;
    }
    return { vestiging: w.v.id, naam: w.v.naam, verkoper: w.speler, contracten: mee };
  }

  /* WAT EEN SPELER VAN EEN VEILING ZIET: alles behalve andermans bod. Zijn
     eigen bod wel -- anders weet hij niet meer wat hij heeft geboden, en dat is
     geen spanning maar een geheugenspel. */
  function beeld(st, h, codenaamVan) {
    return (st.veilingen || []).map(v => {
      const mijn = v.biedingen.find(b => b.speler === h);
      const k = v.soort === 'kavel' ? K(st).kavel.get(v.kavel) : null;
      const w = v.soort === 'vestiging' ? wieHeeft(st, v.vestiging) : null;
      return {
        id: v.id, soort: v.soort, status: v.status, door: codenaamVan(v.door), vanMij: v.door === h,
        wat: k ? k.naam : (w ? w.v.naam + ' (' + w.v.sector + ', ' + w.v.omvang + ')' : '?'),
        kavel: v.kavel || null, vestiging: v.vestiging || null,
        bodem: v.bodem, sluitMaand: v.sluitMaand, nog: Math.max(0, v.sluitMaand - st.maand),
        // HET AANTAL wel, de BEDRAGEN niet -- zie de kop van dit bestand
        biedingen: v.biedingen.length, mijnBod: mijn ? mijn.bedrag : null,
        winnaar: v.winnaar ? codenaamVan(v.winnaar) : null,
        prijs: v.status === 'gesloten' ? v.prijs : null
      };
    });
  }

  return { lopende, bodem, hameren, beeld, LOOPTIJD, MAX_LOPEND };
};
