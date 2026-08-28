/* WAT EEN HANDELING WEEGT, EN WAT DAT KOST AAN ZEKERHEID.

   De trappen staan in shared/adaptief/grammatica.js; dit is wat er gebeurt als
   iemand tikt. Vijf wegen, en het verschil is de bedoeling:

     licht     het gebeurt. Nul extra handelingen.
     terug     het gebeurt, en er staat "Ongedaan maken" in de rail.
     bewust    je ziet eerst WIE het krijgt en WELKE classificatie eraan hangt.
     zwaar     vasthouden om te bevestigen, met een reden.
     plechtig  klaarzetten, nakijken, en een mens bevestigt.

   DE REGEL DIE HIERONDER LIGT: ONGEDAAN VOOR BEVESTIGEN. Vragen of iemand het
   zeker weet is de duurste oplossing en meestal de slechtste -- hij kost een
   handeling bij ELKE keer, ook de negenennegentig keer dat het klopte, en hij
   leert mensen op ja drukken. Een weg terug kost alleen iets in het ene geval
   dat het misging. Bevestigen blijft daarom voor wat NIET terug kan.

   EN DE REGEL DIE DAAROP VOLGT: `terug` ZONDER WEG TERUG BESTAAT NIET. Wie
   `terug` declareert en geen `ongedaan` meelevert, belooft iets wat er niet is.
   Dat wordt hier geen stille tik maar een trap hoger: dan maar vooraf vragen.
   Zo kan de belofte niet leeglopen zonder dat iemand het merkt.

   WAT DEZE LAAG NIET DOET: iets vastleggen. Bij `zwaar` en `plechtig` wordt de
   reden GEVRAAGD en doorgegeven aan de handeling zelf; of hij in een journaal
   belandt, weet alleen het scherm dat de handeling uitvoert. Hier doen alsof dat
   geregeld is, zou de zwaarste belofte van dit hele stuk tot decor maken.

   Levert window.RTGGewicht. */
(function (w, d) {
  'use strict';
  if (w.RTGGewicht) return;
  var gram = w.RTGGrammatica;
  if (!gram) return;

  function rail() { return w.RTGRail || null; }
  function lagen() { return w.RTGLagen || null; }

  function regel(lijf, tekst, klasse) {
    var p = d.createElement('p');
    p.className = klasse || 'gw-regel';
    p.textContent = tekst;
    lijf.appendChild(p);
    return p;
  }
  function paar(lijf, kop, waarde) {
    var r = d.createElement('div');
    r.className = 'gw-paar';
    var k = d.createElement('span'); k.className = 'gw-kop'; k.textContent = kop;
    var v = d.createElement('span'); v.className = 'gw-waarde'; v.textContent = waarde;
    r.appendChild(k); r.appendChild(v);
    lijf.appendChild(r);
    return r;
  }

  /* De melding achteraf. Hij staat in de rail en niet in een blokje dat over het
     scherm schuift: "Gearchiveerd" is een toestand van je werk, net als
     "Opgeslagen", en hoort op de plek waar je die toestand toch al leest. */
  function naMelding(it, ongedaan) {
    var r = rail();
    var tekst = it.gedaan || (it.naam + ' gedaan');
    if (!r) return;
    r.meld({ tekst: tekst, ongedaan: ongedaan });
  }

  function draai(it, extra) {
    var f = it.doe || (w.RTGAdaptief && function (a) { return w.RTGAdaptief.doe(it.id, a); });
    if (typeof f !== 'function') return false;
    try { f(extra); } catch (e) { if (w.console) w.console.error('[gewicht] ' + it.id, e); return false; }
    return true;
  }

  /* ------------------------------------------------------------- bewust --
     Een vraag met INHOUD. Niet "weet u het zeker?" maar: dit gaat naar deze
     ontvanger, dit stuk draagt deze classificatie. Wie dat leest kan een fout
     zien; wie "weet u het zeker?" leest kan dat niet. */
  function bewust(it, bev) {
    var L = lagen();
    if (!L) return draai(it, {});
    L.lade({ titel: it.naam, inhoud: function (lijf) {
      if (bev.watGebeurt) regel(lijf, bev.watGebeurt, 'gw-uitleg');
      if (bev.ontvanger) paar(lijf, 'Gaat naar', bev.ontvanger);
      if (bev.classificatie) paar(lijf, 'Classificatie', bev.classificatie);
      if (bev.omvang) paar(lijf, 'Omvang', bev.omvang);
      var rij = d.createElement('div');
      rij.className = 'gw-knoppen';
      var af = d.createElement('button');
      af.type = 'button'; af.className = 'gw-af';
      af.textContent = 'Annuleren';
      af.onclick = function () { L.sluit(); };
      var ga = d.createElement('button');
      ga.type = 'button'; ga.className = 'gw-ga';
      ga.textContent = bev.knop || it.naam;
      ga.onclick = function () {
        L.sluit();
        if (draai(it, {})) naMelding(it, it.ongedaan);
      };
      rij.appendChild(af); rij.appendChild(ga);
      lijf.appendChild(rij);
    } });
    return true;
  }

  /* --------------------------------------------------------------- zwaar --
     De reden is verplicht en de knop gaat pas aan als hij er staat. Dat is geen
     formaliteit: de reden is wat een mens over een half jaar terugleest als
     iemand vraagt waarom dit is gebeurd, en een leeg veld beantwoordt die vraag
     niet. */
  function zwaar(it, bev, plechtigStap) {
    var L = lagen();
    if (!L) return false;
    var titel = plechtigStap ? (it.naam + ' · nakijken') : it.naam;
    L.lade({ titel: titel, inhoud: function (lijf) {
      if (bev.watGebeurt) regel(lijf, bev.watGebeurt, 'gw-uitleg');
      if (bev.ontvanger) paar(lijf, 'Gaat naar', bev.ontvanger);
      if (bev.bedrag) paar(lijf, 'Bedrag', bev.bedrag);
      if (bev.omvang) paar(lijf, 'Omvang', bev.omvang);
      if (bev.classificatie) paar(lijf, 'Classificatie', bev.classificatie);
      if (plechtigStap) {
        regel(lijf, 'Deze handeling wordt door een mens bevestigd. RTG zet hem klaar; ' +
          'afmaken doet u zelf.', 'gw-plechtig');
      }
      var lab = d.createElement('label');
      lab.className = 'gw-redenlabel';
      lab.textContent = 'Waarom doet u dit?';
      var veld = d.createElement('textarea');
      veld.className = 'gw-reden';
      veld.rows = 2;
      veld.maxLength = 400;
      veld.placeholder = 'In één zin, voor wie dit later terugleest.';
      lab.appendChild(veld);
      lijf.appendChild(lab);

      var vak = d.createElement('div');
      vak.className = 'gw-knoppen';
      var af = d.createElement('button');
      af.type = 'button'; af.className = 'gw-af';
      af.textContent = 'Annuleren';
      af.onclick = function () { L.sluit(); };
      vak.appendChild(af);
      var houd = w.RTGVasthoud({
        duur: gram.VASTHOUD[plechtigStap ? 'plechtig' : 'zwaar'],
        tekst: bev.knop || 'Houd vast om te bevestigen',
        klaar: function () {
          L.sluit();
          if (draai(it, { reden: veld.value.trim(), gewicht: it.gewicht, bevestigd: true })) {
            var r = rail();
            if (r) r.meld({ tekst: it.gedaan || (it.naam + ' bevestigd') });
          }
        }
      });
      houd.disabled = true;
      veld.addEventListener('input', function () { houd.disabled = !veld.value.trim(); });
      vak.appendChild(houd);
      lijf.appendChild(vak);
    } });
    return true;
  }

  /* ------------------------------------------------------------ plechtig --
     Twee stappen, met een echte tussenstand. Stap één zet klaar en verandert nog
     niets; stap twee is een mens die bevestigt. Dat is dezelfde grens die GELD.md
     trekt -- geld verlaat het huis nooit vanzelf -- en LIFE.md: samenstellen en
     klaarzetten mag, bevestigen doet de mens.

     Daarom mag hier ook geen enkele automatische stap tussen zitten. Wie deze
     weg vanuit de orb aanroept, komt op precies dezelfde twee lades uit. */
  function plechtig(it, bev) {
    var L = lagen();
    if (!L) return false;
    L.lade({ titel: it.naam + ' · klaarzetten', inhoud: function (lijf) {
      regel(lijf, bev.watGebeurt || 'RTG zet deze handeling klaar. Er verandert nu nog niets.',
        'gw-uitleg');
      if (bev.ontvanger) paar(lijf, 'Gaat naar', bev.ontvanger);
      if (bev.bedrag) paar(lijf, 'Bedrag', bev.bedrag);
      (bev.regels || []).forEach(function (r) { paar(lijf, r[0], r[1]); });
      var vak = d.createElement('div');
      vak.className = 'gw-knoppen';
      var af = d.createElement('button');
      af.type = 'button'; af.className = 'gw-af';
      af.textContent = 'Annuleren';
      af.onclick = function () { L.sluit(); };
      var door = d.createElement('button');
      door.type = 'button'; door.className = 'gw-ga';
      door.textContent = 'Nakijken';
      door.onclick = function () { L.sluit(); w.setTimeout(function () { zwaar(it, bev, true); }, 60); };
      vak.appendChild(af); vak.appendChild(door);
      lijf.appendChild(vak);
    } });
    return true;
  }

  /* ------------------------------------------------------------- de ingang --
     Eén functie, en elke tik in het dock loopt er langs. Dat is de reden dat het
     gewicht niet omzeild kan worden door ergens anders een knop te maken: wie de
     capability aanroept, krijgt zijn trap mee. */
  function voer(it, bevestiging) {
    if (!it) return false;
    if (it.verhinderd) {                    // grijs is nooit stil: waarom.js legt uit
      if (w.RTGWaarom) w.RTGWaarom.leguit(it);
      return false;
    }
    var g = it.gewicht || 'licht';
    var bev = bevestiging || it.bevestiging || {};
    if (g === 'terug' && typeof it.ongedaan !== 'function') {
      if (w.console && w.console.warn) {
        w.console.warn('[gewicht] ' + it.id + ': gewicht "terug" zonder ongedaan; wordt "bewust"');
      }
      g = 'bewust';
    }
    if (g === 'licht') return draai(it, {});
    if (g === 'terug') { var ok = draai(it, {}); if (ok) naMelding(it, it.ongedaan); return ok; }
    if (g === 'bewust') return bewust(it, bev);
    if (g === 'plechtig') return plechtig(it, bev);
    return zwaar(it, bev, false);
  }

  w.RTGGewicht = { voer: voer };
})(window, document);
