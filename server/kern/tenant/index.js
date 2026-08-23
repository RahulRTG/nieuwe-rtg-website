/* ============================================================================
   RTG Tenant Control Plane -- de drie delen aan elkaar.

     register.js  wie IS de klant (org), en welke codes vallen eronder
     merkkern.js  wat een merk is, en waar het ophoudt
     brug.js      van een groep bij de klant naar een rol in de werkruimte
     bootstrap.js het ENE antwoord waarmee een scherm weet wie het bedient

   Hier staat wat de drie delen samen moeten kunnen en wat in geen van hen
   thuishoort: het merk van een tenant zetten en lezen (register bewaart, de
   merkkern bepaalt de vorm), en de groepsafbeelding beheren (de brug leest hem,
   het register bewaart hem, maar de BEVOEGDHEID hangt aan de werkruimte).

   Gemount vanuit server/opzet/, en aangeroepen door routes/tenant.js,
   routes/techniek/tenant.js, routes/sso.js en routes/scim.js. */
'use strict';

const merkkern = require('./merkkern');
const { ROLLEN } = require('../../bedrijf/rollen-register');

module.exports = ({ db, save, schoon, findSupplier, bedrijf }) => {
  const register = require('./register')({ db, save, schoon, findSupplier });
  const brug = require('./brug')({ db, save, register });

  /* ---------- het merk van een tenant ----------
     Wat er bewaard wordt is het ONDERTEKENDE manifest en niet de losse velden.
     Dat is het verschil tussen een handtekening die iets doet en een die alleen
     staat: zou de opslag de velden dragen en de handtekening pas bij het lezen
     gerekend worden, dan zou geknoei in de opslag een geldig manifest opleveren
     en bewaakt de controle niets. */
  function merkZet(org, rauw) {
    const t = register.haal(org);
    if (!t) return { error: 'Die tenant kennen we niet.', status: 404 };
    /* Voortbouwen op de RUWE velden en niet op het manifest. Dat verschil is
       klein en het maakt uit: een manifest is altijd volledig ingevuld, dus wie
       daarop verder bouwt legt de STANDAARD vast als een keuze van de klant.
       Wie alleen een naam zet, heeft daarmee geen accentkleur gekozen -- en
       `eigen` zou anders vanaf de eerste bewaring altijd waar zijn. */
    const n = merkkern.leesMerkvelden(rauw, t.merkVelden || {}, schoon);
    if (n.error) return n;
    t.merkVelden = n.merk;
    t.merk = merkkern.manifest(t.org, t.modus, n.merk, t.naam);
    t.bij = new Date().toISOString();
    save();
    return { ok: true, merk: t.merk };
  }

  /* Lezen: altijd een volledig manifest, ook als er nog nooit een merk is gezet.
     Klopt het bewaarde manifest niet met zichzelf, dan komt de STANDAARD naar
     buiten met de reden erbij -- niet het manifest dat er stond. Een merk dat
     buitenom is gewijzigd, is precies het geval waarvoor de controle bestaat. */
  function merkVan(org) {
    const t = register.haal(org);
    if (!t) return null;
    if (t.merk && merkkern.verifieer(t.merk) && t.merk.modus === t.modus) return t.merk;
    const vers = merkkern.manifest(t.org, t.modus, null, t.naam);
    if (t.merk) vers.let = 'Het bewaarde merk klopte niet met zijn eigen handtekening of met de modus van de tenant; ' +
      'dit is de standaardstijl. Zet het merk opnieuw.';
    return vers;
  }

  /* ---------- de groepsafbeelding ----------
     De bevoegdheid hangt aan de WERKRUIMTE en niet aan de tenant: een beheerder
     mag zeggen wie er in ZIJN werkruimte welke rol krijgt, en niet in die van de
     buren onder hetzelfde contract. De route controleert het beheer-token van
     precies die werkruimte en geeft hem hier door; deze functie weigert alles
     wat daarbuiten valt, zodat de grens ook geldt als er ooit een tweede
     aanroeper bij komt. */
  function groepZet(werkruimte, opdracht) {
    const o = opdracht || {};
    const t = register.vanWerkruimte(werkruimte);
    if (!t) return { error: 'Deze werkruimte hoort bij geen enkele tenant. Een groepsafbeelding zonder contract heeft geen provider om uit te lezen.', status: 409 };
    const groep = schoon(o.groep, 120);
    if (!groep) return { error: 'Welke groep bij de provider bedoelt u?', status: 400 };
    const code = String(werkruimte).toUpperCase();
    const aan = o.aan !== false;

    if (!aan) {
      const voor = t.groepen.length;
      t.groepen = t.groepen.filter(g => !(g.werkruimte === code && g.groep === groep &&
        (!o.rol || g.rol === String(o.rol))));
      if (t.groepen.length === voor) return { error: 'Die afbeelding staat er niet.', status: 404 };
      save();
      return { ok: true, groepen: t.groepen.filter(g => g.werkruimte === code) };
    }

    const rol = String(o.rol || '');
    if (!ROLLEN.some(r => r.id === rol))
      return { error: 'Onbekende rol: ' + rol + '.', status: 400 };
    if (t.groepen.some(g => g.werkruimte === code && g.groep === groep && g.rol === rol))
      return { error: 'Die afbeelding staat er al.', status: 409 };
    if (t.groepen.length >= 200) return { error: 'Deze tenant zit aan het maximum aantal groepsafbeeldingen.', status: 400 };
    t.groepen.push({ groep, werkruimte: code, rol, at: new Date().toISOString() });
    save();
    return { ok: true, groepen: t.groepen.filter(g => g.werkruimte === code) };
  }

  const bootstrap = require('./bootstrap')({ db, register, brug, merkVan, bedrijf });

  return { register, brug, merkkern, merkZet, merkVan, groepZet, bootstrap };
};
