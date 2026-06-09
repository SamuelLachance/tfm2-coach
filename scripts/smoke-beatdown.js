const fs = require("fs");
const vm = require("vm");
const dir = require("path").join(__dirname, "../public/");
const g = { window: {}, globalThis: {} };
g.window = g;
g.globalThis = g;

function load(f) {
  vm.runInNewContext(fs.readFileSync(dir + f, "utf8"), g);
}

load("patch-config.js");
load("mtg-color-pie.js");
load("family-core.js");
load("match-core.js");
load("beatdown-core.js");
load("draft-core.js");

const meta = JSON.parse(fs.readFileSync(dir + "data/tactics-meta.json", "utf8"));
const champs = JSON.parse(fs.readFileSync(dir + "data/champions.json", "utf8"));
const byName = new Map(champs.map((c) => [c.name, c]));
const metaMap = {};
for (const c of champs) {
  metaMap[c.name] = { ...(meta[c.name] || {}), colorIdentity: c.colorIdentity || meta[c.name]?.colorIdentity };
}

const our = {
  Top: "Vampire",
  Jungle: "Clown",
  Mid: "Mage noir",
  Bot: "Chasseur de fléchettes empoisonnées",
  Support: "Moine",
};
const en = {
  Top: "Infanterie lourde",
  Jungle: "Maître du fouet",
  Mid: "Glace",
  Bot: "Chevalier de cavalerie",
  Support: "Porteur de bouclier",
};

const cmp = g.TFM2DraftCore.compareComps(our, en, byName, metaMap);
console.log("PRED", {
  margin: cmp.margin,
  ourPlan: cmp.our?.plan,
  role: cmp.roles?.ourRole,
  warn: cmp.misassignmentWarning,
});

const roles = g.TFM2Beatdown.assignRoles(Object.values(our), Object.values(en), metaMap, byName);
console.log("ROLES", roles.label);

const pick = g.TFM2DraftCore.scorePickCandidate("Pyromancien", {
  allies: ["Vampire", "Clown", "Mage noir", "Moine"],
  oppNames: Object.values(en),
  oppComp: en,
  byName,
  metaMap,
  openSlots: ["Bot"],
  phase: "core",
});
console.log("PICK Bot", pick.score, pick.slot, pick.reasons.slice(0, 3));

const pick2 = g.TFM2DraftCore.scorePickCandidate("Tireur d'élite", {
  allies: ["Infanterie lourde", "Maître du fouet", "Glace", "Porteur de bouclier"],
  oppNames: Object.values(our),
  oppComp: our,
  byName,
  metaMap,
  openSlots: ["Bot"],
  phase: "core",
});
console.log("PICK enemy Bot", pick2.score, pick2.reasons.slice(0, 3));
