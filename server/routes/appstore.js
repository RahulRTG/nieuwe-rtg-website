/* De RTG App Store -- het kanaal waarlangs een DERDE een app in dit huis krijgt.
   Vier kanten, vier poorten, en ze staan met opzet uit elkaar:

     uitgever.js  supplierAuth -- een derde zendt in
     kantoor.js   officeAuth   -- een MENS van RTG tekent af
     lid.js       auth         -- een lid bladert, verleent en opent
     cel.js       geen inlog   -- de gekeurde bundel zelf, in een naamloze cel

   Waarom dit naast de domeinen staat en niet in een van hen: het raakt member,
   supplier en office, en zou in elk daarvan half thuishoren. Dezelfde reden als
   routes/concern.js en routes/vakbewijs.js. */
module.exports = (kern) => {
  require('./appstore/uitgever')(kern);
  require('./appstore/kantoor')(kern);
  require('./appstore/lid')(kern);
  require('./appstore/cel')(kern);
};
