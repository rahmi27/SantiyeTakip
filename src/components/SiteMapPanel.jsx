import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { FeatureGroup, ImageOverlay, MapContainer, Polygon, Tooltip, useMap } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import { Building2, Pentagon, RectangleHorizontal, Redo2, Square, Undo2, X } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

const MAX_RELATIVE_ZOOM = 24;

function snapToRightAngle(map, previousLatLng, rawLatLng) {
  if (!previousLatLng) return rawLatLng;
  const previous = map.latLngToLayerPoint(previousLatLng);
  const current = map.latLngToLayerPoint(rawLatLng);
  const snapped =
    Math.abs(current.x - previous.x) >= Math.abs(current.y - previous.y)
      ? L.point(current.x, previous.y)
      : L.point(previous.x, current.y);
  return map.layerPointToLatLng(snapped);
}

function orthogonalizeCoordinates(coordinates) {
  if (coordinates.length < 3) return coordinates;
  const result = [coordinates[0]];

  coordinates.slice(1).forEach(([x, y]) => {
    const [previousX, previousY] = result[result.length - 1];
    result.push(Math.abs(x - previousX) >= Math.abs(y - previousY) ? [x, previousY] : [previousX, y]);
  });

  const [firstX, firstY] = result[0];
  const [lastX, lastY] = result[result.length - 1];
  if (firstX !== lastX && firstY !== lastY) result.push([firstX, lastY]);
  return result;
}

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

function HiddenDrawControl({ imageHeight, request, onCreated }) {
  const map = useMap();
  const controlRef = useRef(null);

  useEffect(() => {
    if (!request?.id) return;
    const polygonHandler = controlRef.current?._toolbars?.draw?._modes?.polygon?.handler;
    const rectangleHandler = controlRef.current?._toolbars?.draw?._modes?.rectangle?.handler;
    polygonHandler?.disable();
    rectangleHandler?.disable();

    if (request.mode === "polygon" && polygonHandler) {
      if (!polygonHandler.__orthogonalPatched) {
        const originalAddVertex = polygonHandler.addVertex;
        polygonHandler.addVertex = function addOrthogonalVertex(latLng) {
          const previousLatLng = this._markers?.[this._markers.length - 1]?.getLatLng();
          return originalAddVertex.call(this, snapToRightAngle(this._map, previousLatLng, latLng));
        };
        polygonHandler._onMouseMove = function moveOrthogonalGuide(event) {
          const rawPoint = this._map.mouseEventToLayerPoint(event.originalEvent);
          const rawLatLng = this._map.layerPointToLatLng(rawPoint);
          const previousLatLng = this._markers?.[this._markers.length - 1]?.getLatLng();
          const latLng = snapToRightAngle(this._map, previousLatLng, rawLatLng);
          const snappedPoint = this._map.latLngToLayerPoint(latLng);
          this._currentLatLng = latLng;
          this._updateTooltip(latLng);
          this._updateGuide(snappedPoint);
          this._mouseMarker.setLatLng(rawLatLng);
          L.DomEvent.preventDefault(event.originalEvent);
        };
        polygonHandler.__orthogonalPatched = true;
      }
      polygonHandler.enable();
      return;
    }

    if ((request.mode === "rectangle" || request.mode === "square") && rectangleHandler) {
      const originalDrawShape = L.Draw.Rectangle.prototype._drawShape;
      rectangleHandler._drawShape =
        request.mode === "square"
          ? function drawSquare(latLng) {
              const start = this._map.latLngToLayerPoint(this._startLatLng);
              const current = this._map.latLngToLayerPoint(latLng);
              const size = Math.max(Math.abs(current.x - start.x), Math.abs(current.y - start.y));
              const squarePoint = L.point(
                start.x + (current.x < start.x ? -size : size),
                start.y + (current.y < start.y ? -size : size),
              );
              originalDrawShape.call(this, this._map.layerPointToLatLng(squarePoint));
            }
          : originalDrawShape;
      rectangleHandler.enable();
      return;
    }

    const fallbackButton = map.getContainer().querySelector(
      request.mode === "polygon" ? ".leaflet-draw-draw-polygon" : ".leaflet-draw-draw-rectangle",
    );
    fallbackButton?.click();
  }, [map, request]);

  return (
    <FeatureGroup>
      <EditControl
        onMounted={(control) => {
          controlRef.current = control;
        }}
        position="topright"
        onCreated={(event) => {
          const latLngs = event.layer.getLatLngs()?.[0] || [];
          const coordinates = orthogonalizeCoordinates(
            latLngs.map(({ lat, lng }) => [Number(lng.toFixed(2)), Number((imageHeight - lat).toFixed(2))]),
          );
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
          rectangle: {
            showArea: false,
            shapeOptions: { color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.28, weight: 3 },
          },
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
  const [drawRequest, setDrawRequest] = useState({ id: 0, mode: "polygon" });
  const [pendingCoordinates, setPendingCoordinates] = useState(null);
  const [targetBuildingId, setTargetBuildingId] = useState("");
  const [historyMenu, setHistoryMenu] = useState(null);
  const bounds = useMemo(() => L.latLngBounds([0, 0], [map.height, map.width]), [map.height, map.width]);
  const unmappedBuildings = useMemo(
    () => buildings.filter((building) => !Array.isArray(building.coordinates) || building.coordinates.length < 3),
    [buildings],
  );
  const selectedBuilding = buildings.find((building) => building.id === selectedBuildingId);

  function beginDrawing(mode) {
    if (!unmappedBuildings.length) return;
    setHistoryMenu(null);
    setDrawRequest((previous) => ({ id: previous.id + 1, mode }));
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
            <div className="draw-mode-group" aria-label="Bina çizim araçları">
              <button
                className="secondary-action draw-building-action"
                type="button"
                disabled={!unmappedBuildings.length}
                title="Yatay ve dikey kenarlı poligon çiz"
                onClick={() => beginDrawing("polygon")}
              >
                <Pentagon size={16} />
                90° Poligon
              </button>
              <button
                className="secondary-action draw-building-action"
                type="button"
                disabled={!unmappedBuildings.length}
                title="Hazır dikdörtgen çiz"
                onClick={() => beginDrawing("rectangle")}
              >
                <RectangleHorizontal size={16} />
                Dikdörtgen
              </button>
              <button
                className="secondary-action draw-building-action"
                type="button"
                disabled={!unmappedBuildings.length}
                title="Hazır kare çiz"
                onClick={() => beginDrawing("square")}
              >
                <Square size={16} />
                Kare
              </button>
            </div>
          </>
        )}
      </div>

      <div className="leaflet-map-shell">
        <MapContainer
          crs={L.CRS.Simple}
          bounds={bounds}
          minZoom={-6}
          maxZoom={8}
          zoomSnap={0}
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
            <HiddenDrawControl imageHeight={map.height} request={drawRequest} onCreated={handlePolygonCreated} />
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
