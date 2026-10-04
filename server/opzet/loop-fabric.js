'use strict';

module.exports=(kern,hulp)=>{
  kern.workLoopSource=require('../bedrijf/loop-source')({db:hulp.db,bewerkCollectie:hulp.bewerkCollectie});
  kern.loopFabric=require('../kern/loop-fabric')({db:hulp.db,bewerkCollectie:hulp.bewerkCollectie,
    livingWorld:kern.livingWorld,workSource:kern.workLoopSource});
};
