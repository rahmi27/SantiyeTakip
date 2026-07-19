import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { CircleMarker, FeatureGroup, ImageOverlay, MapContainer, Polygon, Tooltip, useMap } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import { Building2, Pentagon, RectangleHorizontal, Redo2, Square, Undo2, X } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

const MAX_RELATIVE_ZOOM = 24;
const MIN_DRAW_SEGMENT_PX = 4;

function isPointInsidePolygon([x, y], coordinates) {
  let inside = false;
  for (let index = 0, previous = coordinates.length - 1; index < coordinates.length; previous = index++) {
    const [currentX, currentY] = coordinates[index];
    const [previousX, previousY] = coordinates[previous];
    const intersects =
      currentY > y !== previousY > y &&
      x < ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX;
    if (intersects) inside = !inside;
  }
  return inside;
}

function getPolygonCentroid(coordinates) {
  let signedArea = 0;
  let centroidX = 0;
  let centroidY = 0;
  coordinates.forEach(([x, y], index) => {
    const [nextX, nextY] = coordinates[(index + 1) % coordinates.length];
    const cross = x * nextY - nextX * y;
    signedArea += cross;
    centroidX += (x + nextX) * cross;
    centroidY += (y + nextY) * cross;
  });
  if (Math.abs(signedArea) < 0.000001) return null;
  return [centroidX / (3 * signedArea), centroidY / (3 * signedArea)];
}

function getPolygonLabelPoint(coordinates) {
  const centroid = getPolygonCentroid(coordinates);
  if (centroid && isPointInsidePolygon(centroid, coordinates)) return centroid;

  const xs = coordinates.map(([x]) => x);
  const ys = coordinates.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const boxCenter = [centerX, centerY];
  if (isPointInsidePolygon(boxCenter, coordinates)) return boxCenter;

  const uniqueYs = [...new Set(ys)].sort((a, b) => a - b);
  const scanLines = [centerY];
  for (let index = 0; index < uniqueYs.length - 1; index += 1) {
    scanLines.push((uniqueYs[index] + uniqueYs[index + 1]) / 2);
  }

  let bestPoint = null;
  let bestScore = -Infinity;
  scanLines.forEach((scanY) => {
    const intersections = [];
    coordinates.forEach(([x1, y1], index) => {
      const [x2, y2] = coordinates[(index + 1) % coordinates.length];
      if ((y1 > scanY) === (y2 > scanY)) return;
      intersections.push(x1 + ((scanY - y1) * (x2 - x1)) / (y2 - y1));
    });
    intersections.sort((a, b) => a - b);
    for (let index = 0; index + 1 < intersections.length; index += 2) {
      const left = intersections[index];
      const right = intersections[index + 1];
      const candidate = [(left + right) / 2, scanY];
      const centerDistance = Math.hypot(candidate[0] - centerX, candidate[1] - centerY);
      const score = right - left - centerDistance * 0.05;
      if (score > bestScore && isPointInsidePolygon(candidate, coordinates)) {
        bestPoint = candidate;
        bestScore = score;
      }
    }
  });

  return bestPoint || coordinates[0];
}

function styleDrawingVertices(markers) {
  markers?.forEach((marker, index) => {
    marker?._icon?.classList.add("site-draw-vertex");
    marker?._icon?.classList.toggle("site-draw-first-vertex", index === 0);
  });
}

function getDrawingBasis(map, markers) {
  if (!markers || markers.length < 2) return null;
  const first = map.latLngToLayerPoint(markers[0].getLatLng());
  const second = map.latLngToLayerPoint(markers[1].getLatLng());
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return null;
  return { parallel: { x: dx / length, y: dy / length }, perpendicular: { x: -dy / length, y: dx / length } };
}

function snapToDrawingBasis(map, markers, rawLatLng) {
  const basis = getDrawingBasis(map, markers);
  if (!basis) return rawLatLng;
  const previous = map.latLngToLayerPoint(markers[markers.length - 1].getLatLng());
  const current = map.latLngToLayerPoint(rawLatLng);
  const dx = current.x - previous.x;
  const dy = current.y - previous.y;
  const parallelLength = dx * basis.parallel.x + dy * basis.parallel.y;
  const perpendicularLength = dx * basis.perpendicular.x + dy * basis.perpendicular.y;
  const axis = Math.abs(parallelLength) >= Math.abs(perpendicularLength) ? basis.parallel : basis.perpendicular;
  const distance = Math.abs(parallelLength) >= Math.abs(perpendicularLength) ? parallelLength : perpendicularLength;
  const snapped = L.point(previous.x + axis.x * distance, previous.y + axis.y * distance);
  return map.layerPointToLatLng(snapped);
}

function completeOrthogonalClosure(coordinates) {
  if (coordinates.length < 3) return coordinates;
  const [first, second] = coordinates;
  const baseX = second[0] - first[0];
  const baseY = second[1] - first[1];
  const baseLength = Math.hypot(baseX, baseY);
  if (baseLength < 0.001) return coordinates;
  const parallel = { x: baseX / baseLength, y: baseY / baseLength };
  const perpendicular = { x: -parallel.y, y: parallel.x };
  // Drawing vertices are already snapped while clicking. Preserve them exactly so
  // finishing the polygon cannot move a point away from the cursor position.
  const result = coordinates.map(([x, y]) => [x, y]);

  const [lastX, lastY] = result[result.length - 1];
  const closureX = first[0] - lastX;
  const closureY = first[1] - lastY;
  const closureParallel = closureX * parallel.x + closureY * parallel.y;
  const closurePerpendicular = closureX * perpendicular.x + closureY * perpendicular.y;
  if (Math.abs(closureParallel) > 0.01 && Math.abs(closurePerpendicular) > 0.01) {
    const [beforeLastX, beforeLastY] = result[result.length - 2];
    const lastDx = lastX - beforeLastX;
    const lastDy = lastY - beforeLastY;
    const lastParallel = Math.abs(lastDx * parallel.x + lastDy * parallel.y);
    const lastPerpendicular = Math.abs(lastDx * perpendicular.x + lastDy * perpendicular.y);
    const closeParallelFirst = lastPerpendicular >= lastParallel;
    const closureAxis = closeParallelFirst ? parallel : perpendicular;
    const closureDistance = closeParallelFirst ? closureParallel : closurePerpendicular;
    result.push([lastX + closureAxis.x * closureDistance, lastY + closureAxis.y * closureDistance]);
  }
  return result.map(([x, y]) => [Number(x.toFixed(3)), Number(y.toFixed(3))]);
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

function MapLabelScale() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    let frame = 0;

    const updateScale = () => {
      const relativeZoom = map.getZoom() - map.getMinZoom();
      container.dataset.labelScale =
        relativeZoom < 0.9 ? "far" : relativeZoom < 2.2 ? "compact" : relativeZoom < 3.5 ? "detail" : "full";
    };

    frame = requestAnimationFrame(updateScale);
    map.on("zoomend", updateScale);

    return () => {
      cancelAnimationFrame(frame);
      map.off("zoomend", updateScale);
      delete container.dataset.labelScale;
    };
  }, [map]);

  return null;
}

function HiddenDrawControl({ imageHeight, request, onCreated }) {
  const map = useMap();
  const controlRef = useRef(null);
  const rectangleDrawShapeRef = useRef(null);

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
          const snappedLatLng = snapToDrawingBasis(this._map, this._markers, latLng);
          const previousMarker = this._markers?.[this._markers.length - 1];
          if (previousMarker) {
            const previousPoint = this._map.latLngToLayerPoint(previousMarker.getLatLng());
            const snappedPoint = this._map.latLngToLayerPoint(snappedLatLng);
            if (previousPoint.distanceTo(snappedPoint) < MIN_DRAW_SEGMENT_PX) return;
          }
          originalAddVertex.call(this, snappedLatLng);
          requestAnimationFrame(() => styleDrawingVertices(this._markers));
        };
        polygonHandler._onMouseMove = function moveOrthogonalGuide(event) {
          const rawPoint = this._map.mouseEventToLayerPoint(event.originalEvent);
          const rawLatLng = this._map.layerPointToLatLng(rawPoint);
          const latLng = snapToDrawingBasis(this._map, this._markers, rawLatLng);
          const snappedPoint = this._map.latLngToLayerPoint(latLng);
          this._currentLatLng = latLng;
          this._updateTooltip(latLng);
          this._updateGuide(snappedPoint);
          this._mouseMarker.setLatLng(latLng);
          L.DomEvent.preventDefault(event.originalEvent);
        };
        polygonHandler.__orthogonalPatched = true;
      }
      polygonHandler.enable();
      return;
    }

    if ((request.mode === "rectangle" || request.mode === "square") && rectangleHandler) {
      const originalDrawShape = rectangleDrawShapeRef.current || rectangleHandler._drawShape || L.Draw.Rectangle.prototype._drawShape;
      rectangleDrawShapeRef.current = originalDrawShape;
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
          : function drawRectangle(latLng) {
              originalDrawShape.call(this, latLng);
            };
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
          const coordinates = completeOrthogonalClosure(
            latLngs.map(({ lat, lng }) => [Number(lng.toFixed(3)), Number((imageHeight - lat).toFixed(3))]),
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
          <MapLabelScale />
          <FocusBuilding building={selectedBuilding} imageHeight={map.height} />
          <ImageOverlay url={map.image} bounds={bounds} opacity={1} interactive={false} />

          {buildings.map((building) => {
            if (!Array.isArray(building.coordinates) || building.coordinates.length < 3) return null;
            const allowed = user.role === "admin" || (user.permissions || []).includes(building.id);
            const progress = getProgress(building);
            const fillColor = allowed ? getProgressColor(progress, progressRanges) : "#64748b";
            const positions = building.coordinates.map(([x, y]) => [map.height - y, x]);
            const [labelX, labelY] = getPolygonLabelPoint(building.coordinates);
            return (
              <React.Fragment key={building.id}>
                <Polygon
                  positions={positions}
                  pathOptions={{
                    color: selectedBuildingId === building.id ? "#111827" : "#6b7280",
                    fillColor,
                    fillOpacity: allowed ? 0.32 : 0.07,
                    opacity: allowed ? 1 : 0.35,
                    weight: selectedBuildingId === building.id ? 3 : 1.25,
                  }}
                  eventHandlers={{
                    click: () => allowed && onSelect(building.id),
                  }}
                />
                <CircleMarker
                  center={[map.height - labelY, labelX]}
                  radius={1}
                  interactive={false}
                  pathOptions={{ opacity: 0, fillOpacity: 0 }}
                >
                  <Tooltip permanent direction="center" className="building-map-label" opacity={1}>
                  <strong>{building.code}</strong>
                  <span>{building.name}</span>
                  <em>%{progress}</em>
                  </Tooltip>
                </CircleMarker>
              </React.Fragment>
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
