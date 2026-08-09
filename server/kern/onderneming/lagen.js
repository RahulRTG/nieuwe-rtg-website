/* Onderneming-deelmodule "lagen": alle deellagen een keer opbouwen.

   Los van ./index.js omdat dat bestand over de 10 kB van het modulebeleid
   ging. De naad is duidelijk: hier wordt de gereedschapskist SAMENGESTELD,
   daar wordt het ondernemingsobject zelf beheerd.

   De volgorde is niet vrij. `sim` en `plan` leunen op `intake`, `rel` op het
   gedeelde klantenboek, en `dag` op de intake-controle. Wie hier iets
   verplaatst, hoort te weten waarom -- daarom staan ze in blokken bij elkaar
   en niet op alfabet. */
'use strict';

module.exports = (ctx) => {
  const { db, save, schoon, ordersVanZaak, boekingenVanZaak, ondernemerpoort } = ctx;

  const intake = require('./intake')({ schoon });
  const kans = require('./kans')({ db, ordersVanZaak, boekingenVanZaak });
  const sim = require('./simulatie')({ intakeOntbreekt: intake.intakeOntbreekt });
  const stress = require('./stress')();
  const plan = require('./plan')({ intakeOntbreekt: intake.intakeOntbreekt, save });
  const dag = require('./dagbeeld')({ db, boekingenVanZaak, ordersVanZaak,
    intakeOntbreekt: intake.intakeOntbreekt });
  const opr = require('./oprichting')({ save });
  const ek = require('./eersteklant')({ db, ondernemerpoort, boekingenVanZaak, ordersVanZaak });
  const mp = require('./mallprofiel')({ db });
  /* Het gedeelde klantenboek, hetzelfde dat Vakwerk gebruikt. Twee boeken
     naast elkaar lopen uiteen (lat-regel 4). */
  /* `schoon` en niet `scho`: die laatste wordt verderop in dit bestand pas
     verklaard, en een const lezen voor zijn declaratie gooit. Zelfde functie. */
  const boek = require('../klantenboek')({ db, save, scho: schoon, boekingenVanZaak, ordersVanZaak });
  const rel = require('./relaties')({ db, klantenboek: boek.klantenboek, boekingenVanZaak });
  const deb = require('./debiteuren')({ db });
  const cred = require('./crediteuren')({ db });
  const con = require('./contracten')({ db });
  const bel = require('./belasting')({ db });
  const kas = require('./kas')({ save });

  return { intake, kans, sim, stress, plan, dag, opr, ek, mp, boek, rel, deb, cred, con, bel, kas };
};
