import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  calculateAutomaticCategoryWeights,
  calculateBuildingProgress,
  getCategoryTemplateTotal,
  getTemplatePercentages,
  getWeightTotal,
} from "../src/deneme-dashboard/utils/hakedisMath.js";
import { SANDBOX_STORAGE_KEY } from "../src/deneme-dashboard/data/sandboxRepository.js";

const seed = JSON.parse(
  await readFile(new URL("../src/deneme-dashboard/data/hakedisSeed.json", import.meta.url), "utf8"),
);

assert.equal(seed.buildings.length, 322, "Excel bina sayısı korunmalı");
assert.equal(seed.categories.length, 7, "Hakediş kategori sayısı korunmalı");
assert.equal(seed.categories.flatMap((category) => category.items).length, 31, "Standart iş kalemi sayısı korunmalı");
assert.equal(SANDBOX_STORAGE_KEY, "tugay-deneme-hakedis-v1", "Deneme verisi ayrı anahtarda tutulmalı");

const templatePercentages = getTemplatePercentages(seed.categories);
seed.categories.forEach((category) => {
  assert.ok(
    Math.abs(getCategoryTemplateTotal(category, templatePercentages) - 1) < 0.000001,
    `${category.label} pürsantaj toplamı %100 olmalı`,
  );
});

const a01 = seed.buildings.find((building) => building.code === "A01");
assert.ok(a01, "A01 bulunmalı");
assert.equal(a01.quantities.sihhiGrupSayisi, 327);
assert.equal(a01.quantities.petekSayisi, 283);
assert.equal(a01.quantities.sprinkSayisi, 652);

const weights = calculateAutomaticCategoryWeights(a01.quantities, seed.categories);
assert.ok(Math.abs(getWeightTotal(weights) - 1) < 0.000001, "A01 otomatik ağırlıkları %100 olmalı");
assert.ok(Math.abs(weights.sihhi_tesisat - 327 / 1262) < 0.000001);
assert.ok(Math.abs(weights.isitma_tesisati - 283 / 1262) < 0.000001);
assert.ok(Math.abs(weights.yangin_tesisati - 652 / 1262) < 0.000001);
assert.equal(weights.karot, 0);
assert.equal(weights.vrf, 0);
assert.deepEqual(a01.automaticCategoryWeights, weights, "Otomatik ağırlıklar bina seed kaydına yazılmalı");

const fullProgress = Object.fromEntries(
  seed.categories.flatMap((category) => category.items.map((item) => [item.id, 100])),
);
const totalProgress = calculateBuildingProgress({
  categories: seed.categories,
  weights,
  workProgress: fullProgress,
  templatePercentages,
});
assert.ok(Math.abs(totalProgress - 1) < 0.000001, "Tüm ana işler tamamlanınca bina ilerlemesi %100 olmalı");

const firstSihhiItem = seed.categories.find((category) => category.id === "sihhi_tesisat").items[0];
const partialProgress = calculateBuildingProgress({
  categories: seed.categories,
  weights,
  workProgress: { [firstSihhiItem.id]: 100 },
  templatePercentages,
});
assert.ok(
  Math.abs(partialProgress - (327 / 1262) * 0.07) < 0.000001,
  "Çift kademeli formül kategori ağırlığı ile bölüm pürsantajını çarpmalı",
);

console.log("Deneme hakediş testleri başarılı: 322 bina, 7 kategori, 31 iş kalemi, A01 ağırlıkları ve çift kademeli formül.");
