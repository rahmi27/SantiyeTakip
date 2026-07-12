export const SANDBOX_STORAGE_KEY = "tugay-deneme-hakedis-v1";
export const SANDBOX_SCHEMA_VERSION = 1;

export function createEmptySandboxState() {
  return {
    schemaVersion: SANDBOX_SCHEMA_VERSION,
    quantityOverrides: {},
    weightOverrides: {},
    templateOverrides: {},
    progressByBuilding: {},
  };
}

export function loadSandboxState() {
  const emptyState = createEmptySandboxState();
  try {
    const saved = JSON.parse(window.localStorage.getItem(SANDBOX_STORAGE_KEY));
    if (saved?.schemaVersion === SANDBOX_SCHEMA_VERSION) return { ...emptyState, ...saved };
  } catch (error) {
    console.warn("Deneme hakediş verisi okunamadı", error);
  }
  return emptyState;
}

export function saveSandboxState(state) {
  window.localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(state));
}
