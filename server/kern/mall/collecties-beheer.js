/* RTG Mall, deelbestand "collecties-beheer": SAMENSTELLEN EN WEGHALEN.

   De schrijfkant van ./collecties.js, apart gezet toen dat bestand tegen de
   tienkilobytegrens liep. Lezen en beheren zijn hier ook werkelijk twee dingen:
   de leeskant draait bij elke Mall-pagina, de schrijfkant een paar keer per dag
   vanuit het kantoor of een leveranciersscherm.

   DE REGEL DIE HIER WORDT AFGEDWONGEN: een zaak mag alleen HAAR EIGEN aanbod
   bundelen. Een bundel met andermans aanbod erin is een belofte die de maker
   niet kan waarmaken -- en in een Mall waar iedereen elkaars aanbod ziet, is
   dat een makkelijke fout om te maken en een dure om te ontdekken. Het kantoor
   ('rtg') mag wel over de zaken heen samenstellen; dat is nou juist wat een
   RTG-collectie is. */

module.exports = (ctx, hulp) => {
  const { db, save, crypto } = ctx;
  const { bak, toon, SOORTEN, MAX_REGELS, MAX_PER_ZAAK, isDatum, schoonTekst } = hulp;

  /* Een collectie samenstellen. `door` is 'rtg' (het kantoor) of een zaakcode;
     een zaak mag alleen haar eigen aanbod bundelen, want een bundel met
     andermans aanbod erin is een belofte die zij niet kan waarmaken. */
  function zet(door, doorNaam, data) {
    data = data || {};
    const soort = SOORTEN.includes(data.soort) ? data.soort : null;
    if (!soort) return { status: 400, error: 'Kies collectie, bundel, evenement of seizoen.' };
    const titel = schoonTekst(data.titel, 90);
    if (titel.length < 3) return { status: 400, error: 'Geef het een naam.' };
    const ids = [...new Set((data.regels || []).map(x => String(x || '')).filter(Boolean))].slice(0, MAX_REGELS);
    if (ids.length < 2) return { status: 400, error: 'Zet er minstens twee dingen in; anders is het gewoon een aanbod.' };

    const levend = new Map(ctx.aanbodAlles().aanbod.map(a => [a.id, a]));
    const onbekend = ids.filter(id => !levend.has(id));
    if (onbekend.length) return { status: 400, error: 'Dit staat niet in de Mall: ' + onbekend.slice(0, 3).join(', ') };
    if (door !== 'rtg') {
      const vreemd = ids.filter(id => (levend.get(id).aanbieder.code || null) !== door);
      if (vreemd.length) return { status: 403, error: 'U kunt alleen uw eigen aanbod bundelen.' };
    }
    // een evenement zonder datum is geen evenement, en een seizoen zonder periode ook niet
    if (soort === 'evenement' && !isDatum(data.van)) return { status: 400, error: 'Een evenement heeft een datum.' };
    if (soort === 'seizoen' && !(isDatum(data.van) && isDatum(data.tot))) return { status: 400, error: 'Een seizoen heeft een begin en een eind.' };

    const lijst = bak();
    const mijn = lijst.filter(c => c.door === door).length;
    if (mijn >= MAX_PER_ZAAK && !data.id) return { status: 409, error: 'U heeft het maximum van ' + MAX_PER_ZAAK + ' bereikt.' };

    const bestaand = data.id ? lijst.find(c => c.id === String(data.id) && c.door === door) : null;
    if (data.id && !bestaand) return { status: 404, error: 'Deze collectie beheert u niet.' };
    const c = bestaand || { id: crypto.randomBytes(5).toString('hex'), door, doorNaam, at: new Date().toISOString() };
    Object.assign(c, {
      soort, titel, uitleg: schoonTekst(data.uitleg, 220) || null,
      regels: ids,
      plek: schoonTekst(data.plek, 40) || null,
      van: isDatum(data.van) ? data.van : null,
      tot: isDatum(data.tot) ? data.tot : null,
      tijd: /^\d{1,2}:\d{2}$/.test(String(data.tijd || '')) ? data.tijd : null,
      bundelPrijs: soort === 'bundel' ? Math.max(0, Math.round((Number(data.bundelPrijs) || 0) * 100) / 100) : 0,
      doorNaam
    });
    if (!bestaand) lijst.unshift(c);
    db.data.mallCollecties = lijst.slice(0, 2000);
    save();
    return { ok: true, collectie: toon(c.id).collectie };
  }

  function verwijder(door, id) {
    const lijst = bak();
    const i = lijst.findIndex(c => c.id === String(id || '') && c.door === door);
    if (i < 0) return { status: 404, error: 'Deze collectie beheert u niet.' };
    lijst.splice(i, 1);
    save();
    return { ok: true, aantal: lijst.length };
  }


  function verwijder(door, id) {
    const lijst = bak();
    const i = lijst.findIndex(c => c.id === String(id || '') && c.door === door);
    if (i < 0) return { status: 404, error: 'Deze collectie beheert u niet.' };
    lijst.splice(i, 1);
    save();
    return { ok: true, aantal: lijst.length };
  }

  return { zet, verwijder };
};
