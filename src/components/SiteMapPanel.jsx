import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { FeatureGroup, ImageOverlay, MapContainer, Polygon, Tooltip, useMap } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import { Building2, Plus, Redo2, Undo2, X } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

const MAX_RELATIVE_ZOOM = 24;

function FitImageBounds({ bounds }) {
  const map = useMap();

  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      map.invalidateSize();
      map.fitBounds(bounds, { animate: false, padding: [14, 14] });
      const fitZoom = map.getZoom();
      map.setMinZoom(fitZoom);
      map.setMaxZoom(fitZoom + Math.log2(MAX_RELATIVE_ZOOM));
    });

    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => map.invalidateSize());
    });
    observer.observe(container);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [bounds, map]);

  return null;
}

function FocusBuilding({ building, imageHeight }) {
  const map = useMap();

  useEffect(() => {
    if (!building?.coordinates?.length) return;
    const positions = building.coordinates.map(([x, y]) => [imageHeight - y, x]);
    map.flyToBounds(positions, { animate: true, duration: 0.35, padding: [70, 70], maxZoom: map.getMaxZoom() - 1 });
  }, [building, imageHeight, map]);

  return null;
}

function HiddenDrawControl({ imageHeight, requestId, onCreated }) {
  const map = useMap();
  const controlRef = useRef(null);

  useEffect(() => {
    if (!requestId) return;
    const polygonHandler = controlRef.current?._toolbars?.draw?._modes?.polygon?.handler;
    if (polygonHandler) {
      polygonHandler.enable();
      return;
    }

    const fallbackButton = map.getContainer().querySelector(".leaflet-draw-draw-polygon");
    fallbackButton?.click();
  }, [map, requestId]);

  return (
    <FeatureGroup>
      <EditControl
        ref={controlRef}
        position="topright"
        onCreated={(event) => {
          const latLngs = event.layer.getLatLngs()?.[0] || [];
          const coordinates = latLngs.map(({ lat, lng }) => [
            Number(lng.toFixed(2)),
            Number((imageHeight - lat).toFixed(2)),
          ]);
          event.layer.remove();
          onCreated(coordinates);
        }}
        draw={{
          polygon: {
            allowIntersection: false,
            showArea: false,
            shapeOptions: { color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.28, weight: 3 },
          },
          polyline: false,
          rectangle: false,
          circle: false,
          circlemarker: false,
          marker: false,
        }}
        edit={{ edit: false, remove: false }}
      />
    </FeatureGroup>
  );
}

function HistoryMenu({ type, items, count, open, onToggle, onStep }) {
  const isUndo = type === "undo";
  const visibleItems = isUndo ? [...items].reverse() : items;

  return (
    <div className="leaflet-history-action">
      <button
        className="icon-button"
        type="button"
        title={`${isUndo ? "Geri al" : "İleri al"} (${Math.min(count, 20)}/20)`}
        disabled={!count}
        onClick={onToggle}
      >
        {isUndo ? <Undo2 size={17} /> : <Redo2 size={17} />}
      </button>
      {open && (
        <div className="leaflet-history-menu">
          <strong>{isUndo ? "Geri alınacak işlemler" : "İleri alınacak işlemler"}</strong>
          {visibleItems.map((item, index) => {
            const step = index + 1;
            return (
              <button key={item.id} type="button" onClick={() => onStep(step)}>
                <span>{item.label}</span>
                <small>{new Date(item.at).toLocaleString("tr-TR")}</small>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SiteMapPanel({
  map,
  buildings,
  user,
  selectedBuildingId,
  progressRanges,
  getProgress,
  getProgressColor,
  onSelect,
  onAssignCoordinates,
  undoItems = [],
  redoItems = [],
  undoCount = 0,
  redoCount = 0,
  historyStatus = "",
  onUndo,
  onRedo,
}) {
  const [drawRequestId, setDrawRequestId] = useState(0);
  const [pendingCoordinates, setPendingCoordinates] = useState(null);
  const [targetBuildingId, setTargetBuildingId] = useState("");
  const [historyMenu, setHistoryMenu] = useState(null);
  const bounds = useMemo(() => L.latLngBounds([0, 0], [map.height, map.width]), [map.height, map.width]);
  const unmappedBuildings = useMemo(
    () => buildings.filter((building) => !Array.isArray(building.coordinates) || building.coordinates.length < 3),
    [buildings],
  );
  const selectedBuilding = buildings.find((building) => building.id === selectedBuildingId);

  function beginDrawing() {
    if (!unmappedBuildings.length) return;
    setHistoryMenu(null);
    setDrawRequestId((value) => value + 1);
  }

  function handlePolygonCreated(coordinates) {
    if (coordinates.length < 3) return;
    setPendingCoordinates(coordinates);
    setTargetBuildingId(unmappedBuildings[0]?.id || "");
  }

  function saveMapping(event) {
    event.preventDefault();
    if (!targetBuildingId || !pendingCoordinates?.length) return;
    onAssignCoordinates(targetBuildingId, pendingCoordinates);
    setPendingCoordinates(null);
    setTargetBuildingId("");
  }

  return (
    <section className="map-section leaflet-map-section">
      <div className="map-toolbar leaflet-map-toolbar">
        {user.role === "admin" && (
          <>
            <div className="history-status" title={historyStatus}>
              <strong>{historyStatus}</strong>
            </div>
            <HistoryMenu
              type="undo"
              items={undoItems}
              count={undoCount}
              open={historyMenu === "undo"}
              onToggle={() => setHistoryMenu(historyMenu === "undo" ? null : "undo")}
              onStep={(count) => {
                onUndo(count);
                setHistoryMenu(null);
              }}
            />
            <HistoryMenu
              type="redo"
              items={redoItems}
              count={redoCount}
              open={historyMenu === "redo"}
              onToggle={() => setHistoryMenu(historyMenu === "redo" ? null : "redo")}
              onStep={(count) => {
                onRedo(count);
                setHistoryMenu(null);
              }}
            />
            <button
              className="secondary-action draw-building-action"
              type="button"
              disabled={!unmappedBuildings.length}
              title={unmappedBuildings.length ? `${unmappedBuildings.length} bina eşleştirme bekliyor` : "Tüm binalar eşleştirildi"}
              onClick={beginDrawing}
            >
              <Plus size={16} />
              Bina çiz
            </button>
          </>
        )}
      </div>

      <div className="leaflet-map-shell">
        <MapContainer
          crs={L.CRS.Simple}
          bounds={bounds}
          minZoom={-6}
          maxZoom={8}
          zoomSnap={0.25}
          zoomDelta={0.5}
          scrollWheelZoom
          wheelDebounceTime={24}
          wheelPxPerZoomLevel={80}
          doubleClickZoom
          dragging
          zoomControl={false}
          attributionControl={false}
          className="site-leaflet-map"
        >
          <FitImageBounds bounds={bounds} />
          <FocusBuilding building={selectedBuilding} imageHeight={map.height} />
          <ImageOverlay url={map.image} bounds={bounds} opacity={1} interactive={false} />

          {buildings.map((building) => {
            if (!Array.isArray(building.coordinates) || building.coordinates.length < 3) return null;
            const allowed = user.role === "admin" || (user.permissions || []).includes(building.id);
            const progress = getProgress(building);
            const fillColor = allowed ? getProgressColor(progress, progressRanges) : "#64748b";
            const positions = building.coordinates.map(([x, y]) => [map.height - y, x]);
            return (
              <Polygon
                key={building.id}
                positions={positions}
                pathOptions={{
                  color: selectedBuildingId === building.id ? "#111827" : "#6b7280",
                  fillColor,
                  fillOpacity: allowed ? 0.5 : 0.12,
                  opacity: allowed ? 1 : 0.35,
                  weight: selectedBuildingId === building.id ? 4 : 2,
                }}
                eventHandlers={{
                  click: () => allowed && onSelect(building.id),
                }}
              >
                <Tooltip sticky direction="top">
                  <strong>{building.code} · {building.name}</strong>
                  <br />
                  İlerleme %{progress}
                </Tooltip>
              </Polygon>
            );
          })}

          {user.role === "admin" && (
            <HiddenDrawControl imageHeight={map.height} requestId={drawRequestId} onCreated={handlePolygonCreated} />
          )}
        </MapContainer>

        {pendingCoordinates && (
          <div className="map-match-backdrop" role="dialog" aria-modal="true" aria-labelledby="map-match-title">
            <form className="map-match-modal" onSubmit={saveMapping}>
              <header>
                <div>
                  <span>Harita eşleştirmesi</span>
                  <h2 id="map-match-title">Çizilen alanı binaya bağla</h2>
                </div>
                <button className="icon-button" type="button" title="Vazgeç" onClick={() => setPendingCoordinates(null)}>
                  <X size={18} />
                </button>
              </header>
              <label>
                Koordinatı olmayan bina
                <select value={targetBuildingId} onChange={(event) => setTargetBuildingId(event.target.value)} required>
                  {unmappedBuildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.code} · {building.name}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                <Building2 size={16} /> {pendingCoordinates.length} köşe noktası kaydedilecek.
              </p>
              <div className="modal-actions">
                <button className="secondary-action" type="button" onClick={() => setPendingCoordinates(null)}>
                  Vazgeç
                </button>
                <button className="primary-action" type="submit">
                  Eşleştir ve kaydet
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}
