const EPSILON = 0.000001;

export function clampPercentage(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, parsed));
}

export function mergeQuantities(baseQuantities = {}, overrides = {}) {
  return Object.fromEntries(
    Object.keys(baseQuantities).map((key) => {
      const override = overrides[key];
      const value = override === undefined ? baseQuantities[key] : override;
      return [key, Math.max(0, Number(value) || 0)];
    }),
  );
}

export function calculateAutomaticCategoryWeights(quantities, categories) {
  const automaticCategories = categories.filter((category) => category.automaticWeight);
  const totalDriverQuantity = automaticCategories.reduce(
    (sum, category) => sum + Math.max(0, Number(quantities[category.driverKey]) || 0),
    0,
  );

  return Object.fromEntries(
    categories.map((category) => {
      if (!category.automaticWeight || totalDriverQuantity <= 0) return [category.id, 0];
      const driverQuantity = Math.max(0, Number(quantities[category.driverKey]) || 0);
      return [category.id, driverQuantity / totalDriverQuantity];
    }),
  );
}

export function resolveCategoryWeights(automaticWeights, manualWeights) {
  if (!manualWeights) return automaticWeights;
  return Object.fromEntries(
    Object.keys(automaticWeights).map((key) => [key, Math.max(0, Number(manualWeights[key]) || 0)]),
  );
}

export function getWeightTotal(weights) {
  return Object.values(weights).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

export function isWeightTotalValid(weights) {
  return Math.abs(getWeightTotal(weights) - 1) < EPSILON;
}

export function getTemplatePercentages(categories, templateOverrides = {}) {
  return Object.fromEntries(
    categories.flatMap((category) =>
      category.items.map((item) => [item.id, Number(templateOverrides[item.id] ?? item.sectionPercentage) || 0]),
    ),
  );
}

export function calculateCategoryProgress(category, workProgress, templatePercentages) {
  return category.items.reduce((sum, item) => {
    const completion = clampPercentage(workProgress[item.id]) / 100;
    return sum + completion * Math.max(0, Number(templatePercentages[item.id]) || 0);
  }, 0);
}

export function calculateBuildingProgress({ categories, weights, workProgress, templatePercentages }) {
  return categories.reduce((sum, category) => {
    const categoryProgress = calculateCategoryProgress(category, workProgress, templatePercentages);
    return sum + categoryProgress * Math.max(0, Number(weights[category.id]) || 0);
  }, 0);
}

export function getCategoryTemplateTotal(category, templatePercentages) {
  return category.items.reduce((sum, item) => sum + (Number(templatePercentages[item.id]) || 0), 0);
}

export function roundPercentRatio(ratio, digits = 1) {
  const factor = 10 ** digits;
  return Math.round((Number(ratio) || 0) * 100 * factor) / factor;
}
