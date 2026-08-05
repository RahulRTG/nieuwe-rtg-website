/* Onboarding (deelmodule): het paspoort.

   Apart van ./lid.js omdat het een eigen onderwerp is, en dat werd zichtbaar op
   de weegschaal: lid.js kwam met dit blok erbij op 10,8 KB, en keuringsregel 13
   zegt daarover dat een bestand boven de lat meestal een tweede onderwerp
   draagt. Dat is hier letterlijk zo -- de rest van lid.js gaat over de intake en
   het contract, dit gaat over wat de scan van een reisdocument oplevert. */
module.exports = (ctx) => {
  const { accounts, save, schoon, nu, profielVan, profielId } = ctx;

  function bewaarPaspoort(sess, info) {
    info = info || {};
    const p = profielVan(profielId(sess));
    if (!p.paspoort) p.paspoort = {};
    const datum = (x) => (x && /^\d{4}-\d{2}-\d{2}$/.test(String(x)) ? String(x) : null);
    if (datum(info.vervaldatum)) p.paspoort.vervaldatum = datum(info.vervaldatum);
    if (info.nummer) p.paspoort.nummer = schoon(String(info.nummer), 40);
    if (info.nationaliteit) p.paspoort.nationaliteit = schoon(String(info.nationaliteit), 60);
    if (datum(info.geboortedatum)) p.paspoort.geboortedatum = datum(info.geboortedatum);
    p.paspoort.at = nu();
    /* HET LEDENDOSSIER IS WAAR DE GEGEVENSPOORT KIJKT. Die krijgt alleen de
       accountrij en het dossier mee, niet dit onboarding-profiel; wat hier
       blijft staan bestaat voor hem dus niet, en dan zou hij blijven vragen om
       een paspoort dat we net gescand hebben. Het dossier gaat versleuteld en
       gebonden de kluis in (zie de kop van kern/gegevenspoort.js), dus dit is
       geen tweede, lossere bewaarplaats maar dezelfde. */
    const acc = sess && sess.account;
    if (acc && accounts.saveMemberState && accounts.getMemberState) {
      try {
        const md = accounts.getMemberState(acc.id) || {};
        md.paspoort = Object.assign({}, md.paspoort, {
          nummer: p.paspoort.nummer || (md.paspoort || {}).nummer || null,
          vervaldatum: p.paspoort.vervaldatum || (md.paspoort || {}).vervaldatum || null,
          nationaliteit: p.paspoort.nationaliteit || (md.paspoort || {}).nationaliteit || null,
          geboortedatum: p.paspoort.geboortedatum || (md.paspoort || {}).geboortedatum || null
        });
        // de losse velden blijven bestaan voor wie ze al gebruikte (ledenregister)
        if (p.paspoort.nationaliteit && !md.nationaliteit) md.nationaliteit = p.paspoort.nationaliteit;
        if (p.paspoort.geboortedatum && !md.geboren) md.geboren = p.paspoort.geboortedatum;
        accounts.saveMemberState(acc.id, md);
      } catch (e) { /* geen dossier: de paspoort-kant staat er hoe dan ook */ }
    }
    save();
    return { ok: true, paspoort: { vervaldatum: p.paspoort.vervaldatum || null,
      nationaliteit: p.paspoort.nationaliteit || null } };
  }

  // Het contract ondertekenen: getypte naam + akkoord -> bewijs met vingerafdruk.

  return { bewaarPaspoort };
};
