/* Gedeelde, LEVENDE staat van de accounts-laag. init() (in ./index) opent de
   SQLite-database en laadt de twee sleutels en zet ze hier neer; alle deelmodules
   (kluis, mirror, users, staff) lezen ze via dit object uit, zodat ze na init
   dezelfde handle en sleutels zien. Één proces, één set. */
module.exports = { db: null, SECRET: null, VAULT: null };
