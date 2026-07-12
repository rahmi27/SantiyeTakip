import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Calculator,
  Database,
  FileSpreadsheet,
  LockKeyhole,
  RotateCcw,
  Search,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import seed from "./data/hakedisSeed.json";
import { createEmptySandboxState, loadSandboxState, saveSandboxState } from "./data/sandboxRepository.js";
import {
  calculateAutomaticCategoryWeights,
  calculateBuildingProgress,
  calculateCategoryProgress,
  getCategoryTemplateTotal,
  getTemplatePercentages,
  getWeightTotal,
  isWeightTotalValid,
  mergeQuantities,
  resolveCategoryWeights,
  roundPercentRatio,
} from "./utils/hakedisMath.js";
import "./deneme-dashboard.css";

function formatNumber(value) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function formatPercentRatio(value, digits = 1) {
  return `%${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(roundPercentRatio(value, digits))}`;
}

function getLineColor(lineColor) {
  const colors = {
    KIRMIZI: "#dc2626",
    TURKUAZ: "#0891b2",
    MAVİ: "#2563eb",
    MOR: "#7c3aed",
    MAGENTA: "#c026d3",
  };
  return colors[lineColor] || "#64748b";
}

function DenemeDashboard() {
  const [sandbox, setSandbox] = useState(loadSandboxState);
  const [activeView, setActiveView] = useState("building");
  const [selectedBuildingId, setSelectedBuildingId] = useState(seed.buildings[0]?.id || "");
  const [query, setQuery] = useState("");

  useEffect(() => {
    saveSandboxState(sandbox);
  }, [sandbox]);

  const selectedBuilding = seed.buildings.find((building) => building.id === selectedBuildingId) || seed.buildings[0];
  const filteredBuildings = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    if (!needle) return seed.buildings;
    return seed.buildings.filter((building) =>
      `${building.code} ${building.name} ${building.lineColor}`.toLocaleLowerCase("tr-TR").includes(needle),
    );
  }, [query]);

  const quantities = mergeQuantities(
    selectedBuilding.quantities,
    sandbox.quantityOverrides[selectedBuilding.id],
  );
  const automaticWeights = calculateAutomaticCategoryWeights(quantities, seed.categories);
  const manualWeights = sandbox.weightOverrides[selectedBuilding.id];
  const weights = resolveCategoryWeights(automaticWeights, manualWeights);
  const templatePercentages = getTemplatePercentages(seed.categories, sandbox.templateOverrides);
  const workProgress = sandbox.progressByBuilding[selectedBuilding.id] || {};
  const buildingProgress = calculateBuildingProgress({
    categories: seed.categories,
    weights,
    workProgress,
    templatePercentages,
  });
  const weightTotal = getWeightTotal(weights);

  function updateSandbox(updater) {
    setSandbox((previous) => {
      const next = structuredClone(previous);
      updater(next);
      return next;
    });
  }

  function updateQuantity(key, value) {
    updateSandbox((draft) => {
      draft.quantityOverrides[selectedBuilding.id] = {
        ...(draft.quantityOverrides[selectedBuilding.id] || {}),
        [key]: Math.max(0, Number(value) || 0),
      };
    });
  }

  function resetQuantities() {
    updateSandbox((draft) => {
      delete draft.quantityOverrides[selectedBuilding.id];
    });
  }

  function enableManualWeights() {
    updateSandbox((draft) => {
      draft.weightOverrides[selectedBuilding.id] = { ...weights };
    });
  }

  function updateWeight(categoryId, value) {
    updateSandbox((draft) => {
      draft.weightOverrides[selectedBuilding.id] = {
        ...(draft.weightOverrides[selectedBuilding.id] || automaticWeights),
        [categoryId]: Math.max(0, Number(value) || 0) / 100,
      };
    });
  }

  function resetWeights() {
    updateSandbox((draft) => {
      delete draft.weightOverrides[selectedBuilding.id];
    });
  }

  function updateTemplate(itemId, value) {
    updateSandbox((draft) => {
      draft.templateOverrides[itemId] = Math.max(0, Number(value) || 0) / 100;
    });
  }

  function resetTemplates() {
    if (!window.confirm("Tüm iş kalemi pürsantajlarını Excel değerlerine döndürmek istediğine emin misin?")) return;
    updateSandbox((draft) => {
      draft.templateOverrides = {};
    });
  }

  function updateProgress(itemId, value) {
    updateSandbox((draft) => {
      draft.progressByBuilding[selectedBuilding.id] = {
        ...(draft.progressByBuilding[selectedBuilding.id] || {}),
        [itemId]: Math.min(100, Math.max(0, Number(value) || 0)),
      };
    });
  }

  function resetSandbox() {
    if (!window.confirm("Deneme ortamındaki tüm override ve ilerlemeleri silmek istediğine emin misin?")) return;
    setSandbox(createEmptySandboxState());
  }

  return (
    <div className="deneme-app">
      <header className="deneme-topbar">
        <div className="deneme-brand">
          <a className="deneme-icon-button" href="/" title="Ana sisteme dön" aria-label="Ana sisteme dön">
            <ArrowLeft size={18} />
          </a>
          <div>
            <strong>Hakediş Deneme Ortamı</strong>
            <span>Excel tabanlı izole çalışma alanı</span>
          </div>
        </div>
        <nav aria-label="Deneme sayfaları">
          <button className={activeView === "building" ? "active" : ""} onClick={() => setActiveView("building")}>
            <Building2 size={17} />
            Bina Hakedişi
          </button>
          <button className={activeView === "templates" ? "active" : ""} onClick={() => setActiveView("templates")}>
            <FileSpreadsheet size={17} />
            İş Şablonları
          </button>
        </nav>
        <div className="deneme-admin">
          <LockKeyhole size={16} />
          <div>
            <strong>Süper Admin</strong>
            <span>İzole veri</span>
          </div>
          <button className="deneme-icon-button" type="button" title="Deneme verisini sıfırla" onClick={resetSandbox}>
            <RotateCcw size={17} />
          </button>
        </div>
      </header>

      <section className="deneme-auditbar" aria-label="Deneme ortamı durumu">
        <div><Database size={16} /><strong>{seed.buildings.length}</strong><span>bina</span></div>
        <div><FileSpreadsheet size={16} /><strong>{seed.categories.length}</strong><span>kategori</span></div>
        <div><Calculator size={16} /><strong>{seed.categories.reduce((sum, category) => sum + category.items.length, 0)}</strong><span>standart kalem</span></div>
        <div className="isolation-state"><LockKeyhole size={16} /><span>Ana sistem verisinden ayrılmış</span></div>
      </section>

      <div className="deneme-layout">
        <aside className="deneme-building-panel">
          <div className="deneme-section-title">
            <div>
              <h2>Binalar</h2>
              <span>{filteredBuildings.length} / {seed.buildings.length}</span>
            </div>
          </div>
          <label className="deneme-search">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Kod, ad veya hat ara" />
          </label>
          <div className="deneme-building-list">
            {filteredBuildings.map((building) => {
              const buildingQuantities = mergeQuantities(building.quantities, sandbox.quantityOverrides[building.id]);
              const auto = calculateAutomaticCategoryWeights(buildingQuantities, seed.categories);
              const buildingWeights = resolveCategoryWeights(auto, sandbox.weightOverrides[building.id]);
              const progress = calculateBuildingProgress({
                categories: seed.categories,
                weights: buildingWeights,
                workProgress: sandbox.progressByBuilding[building.id] || {},
                templatePercentages,
              });
              return (
                <button
                  key={building.id}
                  className={building.id === selectedBuilding.id ? "active" : ""}
                  onClick={() => setSelectedBuildingId(building.id)}
                >
                  <i style={{ background: getLineColor(building.lineColor) }} />
                  <span><strong>{building.code}</strong><small>{building.name}</small></span>
                  <b>{formatPercentRatio(progress, 1)}</b>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="deneme-content">
          {activeView === "building" ? (
            <>
              <section className="deneme-building-header">
                <div>
                  <span className="deneme-eyebrow">{selectedBuilding.lineColor} hat · Excel satır {selectedBuilding.sourceRow}</span>
                  <h1>{selectedBuilding.code} · {selectedBuilding.name}</h1>
                </div>
                <div className="deneme-progress-total">
                  <span>Toplam ilerleme</span>
                  <strong>{formatPercentRatio(buildingProgress, 2)}</strong>
                  <div><i style={{ width: `${Math.min(100, roundPercentRatio(buildingProgress, 2))}%` }} /></div>
                </div>
              </section>

              <section className="deneme-category-summary">
                {seed.categories.map((category) => {
                  const progress = calculateCategoryProgress(category, workProgress, templatePercentages);
                  return (
                    <article key={category.id}>
                      <span>{category.label}</span>
                      <strong>{formatPercentRatio(progress, 1)}</strong>
                      <small>Ağırlık {formatPercentRatio(weights[category.id], 1)}</small>
                      <div><i style={{ width: `${Math.min(100, roundPercentRatio(progress, 1))}%` }} /></div>
                    </article>
                  );
                })}
              </section>

              <section className="deneme-editor-band">
                <div className="deneme-band-heading">
                  <div><SlidersHorizontal size={18} /><span><strong>Bina nicelikleri</strong><small>Excel: BİNALAR</small></span></div>
                  <button type="button" onClick={resetQuantities} disabled={!sandbox.quantityOverrides[selectedBuilding.id]}>
                    <RotateCcw size={15} /> Excel'e dön
                  </button>
                </div>
                <div className="deneme-quantity-grid">
                  {seed.quantityFields.map((field) => (
                    <label key={field.key}>
                      <span>{field.label}</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={quantities[field.key]}
                        onChange={(event) => updateQuantity(field.key, event.target.value)}
                      />
                      <small>Excel: {formatNumber(selectedBuilding.quantities[field.key])}</small>
                    </label>
                  ))}
                </div>
              </section>

              <section className="deneme-editor-band">
                <div className="deneme-band-heading">
                  <div><Calculator size={18} /><span><strong>Kategori ağırlıkları</strong><small>{manualWeights ? "Süper Admin override" : "Otomatik hesap"}</small></span></div>
                  <div className="deneme-heading-actions">
                    {!manualWeights && <button type="button" onClick={enableManualWeights}><Settings2 size={15} /> Elle düzenle</button>}
                    {manualWeights && <button type="button" onClick={resetWeights}><RotateCcw size={15} /> Otomatiğe dön</button>}
                  </div>
                </div>
                <div className="deneme-weight-grid">
                  {seed.categories.map((category) => (
                    <label key={category.id}>
                      <span>{category.label}</span>
                      <div>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          disabled={!manualWeights}
                          value={roundPercentRatio(weights[category.id], 2)}
                          onChange={(event) => updateWeight(category.id, event.target.value)}
                        />
                        <b>%</b>
                      </div>
                      <small>
                        {category.automaticWeight
                          ? `${category.driverLabel}: ${formatNumber(quantities[category.driverKey])}`
                          : "Varsayılan ağırlık: %0"}
                      </small>
                    </label>
                  ))}
                </div>
                <div className={`deneme-total-check ${isWeightTotalValid(weights) ? "valid" : "invalid"}`}>
                  <span>Ağırlık toplamı</span>
                  <strong>{formatPercentRatio(weightTotal, 2)}</strong>
                  <small>{isWeightTotalValid(weights) ? "Hesaplamaya uygun" : "Toplam %100 olmalı"}</small>
                </div>
              </section>

              <section className="deneme-work-progress">
                <div className="deneme-band-heading">
                  <div><Building2 size={18} /><span><strong>İş ilerlemeleri</strong><small>Çift kademeli hakediş hesabı</small></span></div>
                </div>
                {seed.categories.map((category) => {
                  const progress = calculateCategoryProgress(category, workProgress, templatePercentages);
                  return (
                    <details key={category.id}>
                      <summary>
                        <span><strong>{category.label}</strong><small>{category.items.length} iş kalemi</small></span>
                        <b>{formatPercentRatio(progress, 1)}</b>
                      </summary>
                      <div className="deneme-work-table">
                        {category.items.map((item) => (
                          <label key={item.id}>
                            <span>{item.name}</span>
                            <small>Bölüm payı {formatPercentRatio(templatePercentages[item.id], 1)}</small>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={workProgress[item.id] || 0}
                              onChange={(event) => updateProgress(item.id, event.target.value)}
                            />
                            <input
                              className="deneme-progress-input"
                              type="number"
                              min="0"
                              max="100"
                              value={workProgress[item.id] || 0}
                              onChange={(event) => updateProgress(item.id, event.target.value)}
                            />
                            <b>%</b>
                          </label>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </section>
            </>
          ) : (
            <TemplateManager
              categories={seed.categories}
              percentages={templatePercentages}
              overrides={sandbox.templateOverrides}
              onUpdate={updateTemplate}
              onReset={resetTemplates}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function TemplateManager({ categories, percentages, overrides, onUpdate, onReset }) {
  return (
    <section className="deneme-template-page">
      <div className="deneme-template-header">
        <div>
          <span className="deneme-eyebrow">Excel: HAKEDİŞ DENEMESİ</span>
          <h1>Evrensel İş Kalemi Şablonları</h1>
          <p>{categories.length} kategori · {categories.reduce((sum, category) => sum + category.items.length, 0)} standart kalem</p>
        </div>
        <button type="button" onClick={onReset} disabled={Object.keys(overrides).length === 0}>
          <RotateCcw size={16} /> Excel değerlerine dön
        </button>
      </div>
      <div className="deneme-template-list">
        {categories.map((category) => {
          const total = getCategoryTemplateTotal(category, percentages);
          const valid = Math.abs(total - 1) < 0.000001;
          return (
            <details key={category.id} open>
              <summary>
                <span><strong>{category.label}</strong><small>{category.items.length} iş kalemi</small></span>
                <b className={valid ? "valid" : "invalid"}>{formatPercentRatio(total, 2)}</b>
              </summary>
              <div className="deneme-template-table">
                <div className="deneme-template-table-head"><span>İş kalemi</span><span>Kaynak</span><span>Bölüm pürsantajı</span></div>
                {category.items.map((item) => (
                  <label key={item.id}>
                    <span>{item.name}</span>
                    <small>Excel satır {item.sourceRow} · {formatPercentRatio(item.sectionPercentage, 1)}</small>
                    <div>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={roundPercentRatio(percentages[item.id], 2)}
                        onChange={(event) => onUpdate(item.id, event.target.value)}
                      />
                      <b>%</b>
                    </div>
                  </label>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

export default DenemeDashboard;
