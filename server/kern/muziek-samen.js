/* RTG Klankwerk (deelmodule): samen produceren, op afstand.

   Muziek maken is zelden een eenmanszaak. De ene schrijft de bas, de andere
   hoort er een refrein in, een derde zingt. Dat hoeft niet in dezelfde kamer:
   een stuk is hier een handvol getallen, dus het kan gewoon van twee mensen
   zijn.

   DE REGEL DIE DIT HUIS ERAAN TOEVOEGT: HET STUK IS GEDEELD, DE CREDITS NIET.
   Wie eraan gewerkt heeft, staat bij de uitgave -- allemaal, met de rol die ze
   zelf gekozen hebben. Een medemaker die stil uit de aftiteling valt is precies
   hoe het in de echte muziekwereld misgaat, en dat gaan we hier niet nabouwen.
   Daarom kan de eigenaar iemand er wel UIT zetten, maar verdwijnt diens naam
   niet uit een uitgave die al gedaan is.

   Wie mag wat:
   - de EIGENAAR nodigt uit, zet eruit, geeft uit en heft op;
   - een MEDEMAKER bewerkt het stuk volledig mee -- anders is het geen
     samenwerking maar een postbus;
   - iedereen kan er zelf uit stappen, net als bij een RTMAIL-team.

   Wat hier NIET komt: gelijktijdig in hetzelfde raster tekenen, met cursors van
   de ander in beeld. Dat vraagt een conflictmodel dat we nu niet eerlijk kunnen
   bouwen; wie tegelijk bewaart, overschrijft. Daarom zegt het scherm wie er als
   laatste iets deed en wanneer -- zodat je het ziet in plaats van dat je het
   raadt. Beter een eerlijke waarschuwing dan een valse belofte van magie. */
const ROLLEN = ['productie', 'zang', 'tekst', 'instrument', 'mix', 'overig'];
const MAX_MAKERS = 8;

module.exports = ({ save, trackMet, codenaamVan }) => {
  const nu = () => new Date().toISOString();
  const schoonRol = (r) => (ROLLEN.includes(String(r || '').toLowerCase()) ? String(r).toLowerCase() : 'overig');

  function makersVan(t) {
    if (!Array.isArray(t.makers)) {
      // Een stuk van vóór deze ronde heeft er nog geen; de eigenaar is dan de
      // enige maker. Zachte overgang: niemand verliest iets.
      t.makers = [{ key: t.key, codenaam: codenaamVan(t.key), rol: 'productie', eigenaar: true, sinds: t.at }];
    }
    return t.makers;
  }
  const isEigenaar = (t, key) => t.key === key;
  const magBij = (t, key) => !!t && (t.key === key || makersVan(t).some(m => m.key === key));

  /* Iemand erbij. Gaat op codenaam (de route vertaalt die naar een sleutel):
     een sleutel is een intern gegeven dat niet over de lijn hoort. */
  function nodig(sess, id, wieKey, wieCodenaam, rol) {
    const t = trackMet(id);
    if (!t) return { status: 404, error: 'Dit stuk bestaat niet.' };
    if (!isEigenaar(t, sess.key)) return { status: 403, error: 'Alleen de eigenaar nodigt iemand uit.' };
    if (!wieKey) return { status: 404, error: 'Deze codenaam ken ik niet.' };
    if (wieKey === t.key) return { status: 400, error: 'U staat er zelf al bij.' };
    const lijst = makersVan(t);
    if (lijst.some(m => m.key === wieKey)) return { status: 409, error: 'Die werkt hier al aan mee.' };
    if (lijst.length >= MAX_MAKERS) return { status: 409, error: 'Er kunnen ' + MAX_MAKERS + ' makers aan één stuk werken.' };
    lijst.push({ key: wieKey, codenaam: wieCodenaam || codenaamVan(wieKey), rol: schoonRol(rol), eigenaar: false, sinds: nu() });
    save();
    return { status: 200, ok: true, makers: publiek(t, sess.key) };
  }

  function eruit(sess, id, codenaam) {
    const t = trackMet(id);
    if (!t) return { status: 404, error: 'Dit stuk bestaat niet.' };
    if (!isEigenaar(t, sess.key)) return { status: 403, error: 'Alleen de eigenaar beheert de makers.' };
    const lijst = makersVan(t);
    const i = lijst.findIndex(m => !m.eigenaar && m.codenaam === String(codenaam || ''));
    if (i < 0) return { status: 404, error: 'Die staat hier niet bij.' };
    lijst.splice(i, 1);
    save();
    return { status: 200, ok: true, makers: publiek(t, sess.key) };
  }

  // Zelf weglopen. De eigenaar niet: dan blijft een stuk zonder baas achter.
  function verlaat(sess, id) {
    const t = trackMet(id);
    if (!t) return { status: 404, error: 'Dit stuk bestaat niet.' };
    if (isEigenaar(t, sess.key)) return { status: 400, error: 'U bent de eigenaar; draag het over of hef het op.' };
    const lijst = makersVan(t);
    const i = lijst.findIndex(m => m.key === sess.key);
    if (i < 0) return { status: 404, error: 'U werkt hier niet aan mee.' };
    lijst.splice(i, 1);
    save();
    return { status: 200, ok: true };
  }

  // De rol die iemand zichzelf geeft. Je eigen rol, en niemand anders die van jou.
  function rolZet(sess, id, rol) {
    const t = trackMet(id);
    if (!t || !magBij(t, sess.key)) return { status: 404, error: 'Dit stuk bestaat niet.' };
    const m = makersVan(t).find(x => x.key === sess.key);
    if (!m) return { status: 404, error: 'U werkt hier niet aan mee.' };
    m.rol = schoonRol(rol);
    save();
    return { status: 200, ok: true, rol: m.rol };
  }

  /* Wat het scherm te zien krijgt: codenamen en rollen, nooit sleutels.
     `laatste` zegt wie er als laatste bewaarde -- geen bewaking, maar de
     eerlijke vervanging van het gelijktijdig bewerken dat we niet bouwen. */
  const publiek = (t, key) => ({
    makers: makersVan(t).map(m => ({ codenaam: m.codenaam, rol: m.rol, eigenaar: !!m.eigenaar,
      ikZelf: m.key === key, sinds: m.sinds })),
    ikBenEigenaar: isEigenaar(t, key),
    laatste: t.laatsteMaker ? { codenaam: t.laatsteMaker, at: t.bewerkt } : null,
    rollen: ROLLEN, max: MAX_MAKERS
  });

  // Bij elk bewaren vastleggen wie het was; dat is wat `laatste` toont.
  function stempel(t, key) {
    makersVan(t);
    t.laatsteMaker = codenaamVan(key);
  }

  return { muziekNodig: nodig, muziekMakerEruit: eruit, muziekVerlaat: verlaat, muziekRolZet: rolZet,
    muziekMakers: (sess, id) => {
      const t = trackMet(id);
      if (!t || !magBij(t, sess.key)) return { status: 404, error: 'Dit stuk bestaat niet.' };
      return { status: 200, ok: true, samen: publiek(t, sess.key) };
    },
    muziekMagBij: magBij, muziekMakersVan: makersVan, muziekStempel: stempel,
    MUZIEK_ROLLEN: ROLLEN };
};
