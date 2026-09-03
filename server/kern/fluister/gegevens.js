/* De gegevenspoort in het gesprek met Rahul (kern/fluister).

   De poort zelf stond al overal: een handeling met een derde partij gaat niet
   door zolang die partij het lid niet kan bereiken (kern/gegevenspoort.js). In de
   app vraagt Rahul het dan in beeld en gaat de handeling daarna vanzelf door. In
   het gesprek kon hij dat nog niet: hij zei wat er nodig was en verwees naar de
   app. Dat werkte, maar het is raar -- je zit in een gesprek met iemand die de
   vraag wel kan stellen en het toch niet doet.

   Dus doet hij het hier gewoon zelf. Hij vraagt het, u antwoordt in dezelfde
   zin, en daarna doet hij alsnog wat u vroeg. Wat er ondertussen op de plank
   ligt, staat in het profiel (p.wachtGeg): de openstaande vraag en de handeling
   die erop wacht.

   Het gesprek zelf komt UIT kern/gegevensgesprek.js -- dezelfde stappenmachine
   als de app gebruikt. Dat is geen luiheid maar de bedoeling: wat er gevraagd
   wordt, hoe het gecontroleerd wordt en waar het landt, hoort niet af te hangen
   van het kanaal waarin je toevallig zit. Ook "waarom?" en "laat maar" doen het
   daardoor hier precies zo. */
module.exports = (ctx) => {
  const { van, save, nu, reserveerTafel, zorgMee, gegevensStart, gegevensZeg, voerUit } = ctx;
  const VERS_MS = 10 * 60 * 1000;      // even lang als een openstaand voorstel

  const vers = (p) => !!(p && p.wachtGeg && Date.now() - Date.parse(p.wachtGeg.at) < VERS_MS);

  /* Vraagt de poort iets voor deze handeling? Dan begint hier het gesprek en
     gaat de handeling op de plank. Geeft de vraag terug, of null als er niets
     nodig is -- dan gaat de aanroeper gewoon door. */
  function poortVraag(key, sess, soort, actie) {
    if (!gegevensStart || !sess) return null;
    const s = gegevensStart(sess, soort);
    if (!s || s.klaar || !s.id) return null;
    const p = van(key);
    p.wachtGeg = { id: s.id, soort, actie, at: nu() };
    save();
    return s.tekst;
  }

  /* De geparkeerde handeling alsnog doen. */
  async function voerActieUit(key, codenaam, sess, actie) {
    if (actie && actie.soort === 'voorstel' && voerUit) return voerUit(key, codenaam, actie.w, sess);
    if (actie && actie.soort === 'reservering' && reserveerTafel) {
      const b = actie.r;
      const r = reserveerTafel({ key, tier: sess.tier }, codenaam,
        { supplierCode: b.supplierCode, datum: b.datum, tijd: b.tijd, personen: b.personen });
      if (r.error) return { tekst: 'Dat lukt niet: ' + r.error };
      const z = zorgMee && zorgMee(key, { zaak: b.supplierCode, reden: 'zorgprofiel meegegeven bij een tafelreservering' });
      if (z) { r.reservering.zorg = z; save(); }
      return { tekst: 'Aangevraagd: ' + b.naam + ', ' + b.datum + ' om ' + r.reservering.tijd +
        ' voor ' + b.personen + '. De zaak bevestigt zo; u ziet het in de bel.', gedaan: true };
    }
    return { tekst: 'Genoteerd.' };
  }

  /* De intent-handler. Staat er een vraag open, dan is dit bericht het antwoord
     erop -- daarom staat hij vooraan in de keten. Geeft null als er niets
     openstaat, en dan gaat het gesprek zijn gewone gang. */
  async function gegevensAntwoord({ q, p, klaar, klaarStil, key, codenaam, sess }) {
    /* stil, niet gewoon: wat hier binnenkomt is het antwoord op zijn vraag, en
       dat hoort in de kluis en niet in het gespreksgeheugen (zie gesprek.js) */
    const zeg = klaarStil || klaar;
    if (!vers(p) || !gegevensZeg || !sess) return null;
    const w = p.wachtGeg;
    // een kaal "nee" is hier hetzelfde als "laat maar"; de machine kent dat woord
    const tekst = /^(nee|nope)[.!]?$/i.test(q.trim()) ? 'laat maar' : q;
    const d = gegevensZeg(sess, w.id, tekst);

    if (d.status && d.status >= 400) {          // gesprek verlopen of niet meer van u
      p.wachtGeg = null; save();
      return zeg(d.error + ' Zeg gerust opnieuw wat ik moet regelen.');
    }
    if (d.gestopt) { p.wachtGeg = null; save(); return zeg(d.tekst); }
    if (!d.klaar) { w.at = nu(); save(); return zeg(d.tekst); }

    // alles binnen: van de plank af en alsnog doen wat er gevraagd was
    const actie = w.actie;
    p.wachtGeg = null; save();
    const r = await voerActieUit(key, codenaam, sess, actie);
    return zeg('Genoteerd. ' + r.tekst, r.gedaan);
  }

  return { poortVraag, gegevensAntwoord, versGeg: vers };
};
