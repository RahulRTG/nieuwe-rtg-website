
  /* ---------- planeten, en de vlucht ernaartoe ----------

     Het ontwerp vroeg om werelden als planeten die om de klok draaien, en om
     inzoomen dat voelt als vliegen in plaats van openen. Allebei zijn ze hier
     gebouwd, maar niet zoals ze op papier stonden -- en dat verschil is een
     besluit dat uitleg verdient.

     WAT ER NIET GEBEURT: de merken gaan niet vrij in banen om de klok draaien.
     Een bezel leest zijn stand af aan een VAST punt (de gouden index op twaalf
     uur); merken die elk hun eigen baan hebben, hebben geen stand meer, en dan
     is het geen horloge maar een mobiel. Dat zou ook de meting breken die
     bewaakt dat ze op EEN cirkel liggen -- en die meting bewaakt een echte
     fout, geen smaak.

     WAT ER WEL GEBEURT, en wat het idee eigenlijk vraagt:

     1. Elke wereld krijgt zijn EIGEN LICHT. De merken waren identieke grijze
        schijven; nu draagt elk de tint van zijn eigen wereld
        (dezelfde tint als zijn gloed op de grond, uit MOTIEVEN). Daardoor lees
        je de ring als een stelsel van lichamen in plaats van als een rij
        knoppen -- en je herkent een wereld aan zijn kleur voordat je de glyf
        leest.

     2. Inzoomen is een VLUCHT. De andere werelden schieten naar buiten weg
        alsof je er langs komt, en pas als ze weg zijn staan de onderdelen er.
        Uitzoomen is dezelfde beweging terug. Het is een overgang en geen tweede
        scherm: er komt geen stand bij, alleen tijd tussen twee standen.

     3. Binnen een wereld krijgt de grond een HORIZON die meeschuift als je
        draait. Dat is wat "een stad" hier kan betekenen zonder er een te
        tekenen: je merkt dat je je ergens doorheen beweegt in plaats van door
        een lijst te bladeren. */

  // de tint van een wereld: dezelfde als zijn gloed, uit de tabel in deel 5b
  function wereldTint(sleutel) {
    var m = MOTIEVEN[sleutel];
    return (m && m[0] && m[0][3]) || TINT.goud;
  }

  /* Het licht van een merk. Staat als custom property op de knop zelf, zodat
     het blad hem kan gebruiken zonder dat hier kleuren worden geschilderd --
     schilderen doet de CSS, hier staat alleen WELKE. */
  function merkLicht(b, item) {
    if (!item || !item.sleutel) return;
    var t = wereldTint(item.sleutel);
    if (!t) return;
    b.style.setProperty('--planeet', t[0] + ',' + t[1] + ',' + t[2]);
  }

  /* ---------- de vlucht ----------
     Twee stappen met een pauze ertussen: eerst wegschieten, dan pas de nieuwe
     ring. Zonder die pauze wisselt de inhoud terwijl de oude nog in beeld is,
     en dan is het geen vlucht maar een flikkering.

     Bewegingsarm slaat de vlucht over. Wie geen beweging wil, wil hem ook hier
     niet -- en de FUNCTIE (je staat in de wereld) is dezelfde. */
  var VLUCHT_MS = 300;
  var vluchtBezig = null;

  function vlieg(naarBinnen, klaar) {
    if (!el.kring) { klaar(); return; }
    if (RUSTIG || sleepStil()) { klaar(); return; }
    if (vluchtBezig) { w.clearTimeout(vluchtBezig); vluchtBezig = null; }
    el.kring.setAttribute('data-vlucht', naarBinnen ? 'in' : 'uit');
    vluchtBezig = w.setTimeout(function () {
      vluchtBezig = null;
      klaar();
      /* Het attribuut moet ER NOG STAAN als de nieuwe merken worden gemaakt,
         anders beginnen ze niet aan de rand maar staan ze er meteen. Een frame
         later halen we hem weg; dan speelt de terugkomst. */
      w.requestAnimationFrame(function () {
        w.requestAnimationFrame(function () {
          if (el.kring) el.kring.setAttribute('data-vlucht', 'nee');
        });
      });
    }, VLUCHT_MS);
  }

  /* ---------- de horizon binnen een wereld ----------
     Een band onderin die met de ring meeschuift. Hij is er alleen als je IN een
     wereld staat: buiten kijk je naar het stelsel, binnen sta je ergens. */
  function horizon(c, W, H, t) {
    if (!st.diep) return;
    var tint = wereldTint((st.werelden[st.wereldIdx] || {}).sleutel);
    var schuif = (st.hoek / 360) * W * 0.5;
    var basis = H * 0.78;
    c.save();
    c.globalCompositeOperation = 'lighter';
    /* Drie lagen op verschillende diepte, zodat de dichtstbije het hardst
       meeschuift. Dat is wat je van een plek verwacht als je erlangs beweegt --
       en het is hetzelfde parallax-idee als bij de sterren, alleen dichterbij. */
    for (var laag = 0; laag < 3; laag++) {
      var diep = 0.35 + laag * 0.32;
      var hoogte = H * (0.05 + laag * 0.022);
      var a = (0.05 - laag * 0.012) * (0.6 + 0.4 * Math.sin(t * 0.4 + laag));
      c.fillStyle = 'rgba(' + tint[0] + ',' + tint[1] + ',' + tint[2] + ',' + a.toFixed(4) + ')';
      c.beginPath();
      c.moveTo(0, H);
      for (var x = 0; x <= W; x += W / 24) {
        var u = (x + schuif * diep) / W;
        var y = basis + laag * H * 0.03 - hoogte * (0.5 + 0.5 * Math.sin(u * 6.28 * 1.5 + laag * 2.1));
        c.lineTo(x, y);
      }
      c.lineTo(W, H);
      c.closePath();
      c.fill();
    }
    c.restore();
  }
