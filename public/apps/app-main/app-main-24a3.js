  /* Afgesplitst van app-main-24a2.js toen dat over de 10 KB ging. De snede loopt
     langs een echte grens, en het is dezelfde grens waar WERELDEN.md over gaat:
     hierboven staat WAAR iets is (de werelden), hier staat WIE het mag zien (de
     pas). Wereld en pas zijn twee loodrechte assen; ze horen niet in hetzelfde
     bestand omdat ze toevallig allebei over tegels gaan. */

  /* De premium-suite (De Rechterhand) bestaat alleen voor Lifestyle en
     Business. De registry kent de apps voor iedereen; hier staat wie ze mag
     zien, zodat een RTG-pas ze niet in zijn mappen of in Spotlight tegenkomt.

     DIT IS DE TWEEDE PLEK WAAR STAAT WAT EEN PAS KRIJGT, en sinds vandaag
     weten die twee van elkaar. De server weigert /api/member/rechterhand aan
     wie geen Lifestyle of Business heeft; dezelfde veertien sleutels staan als
     `apps` op de functie `rechterhand` in het register, en
     test/wereldregister.test.js legt ze naast deze set. Wie er een vijftiende
     bij zet, zet hem op beide plekken of de bouw zakt.

     De korrel blijft wel verschillen, en dat is geen slordigheid: de server
     schakelt op FUNCTIE en per doelgroep, deze set verbergt APPS en kent geen
     verschil tussen Lifestyle en Business. Wat ze nu delen is de inhoud, niet
     de vorm. */
  const PREMIUM = new Set(['rechterhand', 'reisboek', 'cellier', 'table', 'maison', 'garderobe',
    'mecenaat', 'nalatenschap', 'logboek', 'cercle', 'hangar', 'entourage', 'attenties', 'rendezvous']);
  const premiumPas = pas === 'lifestyle' || pas === 'business';

  /* DE WERKROL: de derde as naast wereld en pas. Een ingang met `werkrol` in
     LINKS verschijnt alleen voor een account dat die rol in zijn sleutelbos
     heeft (/api/account/rollen, dezelfde lijst als de Werk-kiezer). Routedossier,
     RTG One, Decision Room en Project Room openen alleen met een kantoorsessie;
     zonder kantoorsleutel stuurden ze elk lid door naar de kantoordeur
     (APPWERKT.json, 24 september 2026). Een zichtbare ingang naar een functie
     die niet te bereiken is, is een productdefect (BETROUWBAARHEID.md).
     Zolang de sleutelbos niet geladen is, blijft de ingang weg: wie dat niet
     weet, verbergt liever dan dat hij iets belooft. */
  let werkrollen = null;
  const werkrolOk = (def) => !def || !def.werkrol || (!!werkrollen && werkrollen.has(def.werkrol));
  (function laadWerkrollen() {
    let tok = null; try { tok = localStorage.getItem('rtg_member_token'); } catch (e) {}
    if (!tok) return;
    fetch('/api/account/rollen', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: '{}' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { werkrollen = new Set(((d && d.rollen) || []).map((r) => r.rol)); if (werkrollen.size) bouw(); })
      .catch(() => {});
  })();
