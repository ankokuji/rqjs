import "../src/index";

declare const rqjs: any;

rqjs.define("mod", function() {
  return {
    a: 4,
    b: 6
  }
})

rqjs.define("habi", ["mod"], function(mod: any) {
  console.log("define habi")
  return {
    sim: 55,
    ...mod,
  }
})

rqjs.require(["mod", "habi"], function(mod: any, habi: any) {
  console.log(mod);
  console.log(habi);
})