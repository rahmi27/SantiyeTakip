import React, { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Camera,
  Check,
  ChevronRight,
  CircleUserRound,
  ClipboardList,
  Edit3,
  Eye,
  FileText,
  Lock,
  LogOut,
  MapPinned,
  MessageSquare,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserCog,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import seedData from "./data/siteData.json";

const STORAGE_KEY = "tugay-santiye-state-v5";
const SESSION_KEY = "tugay-santiye-current-user";

const statusLabels = {
  pending: "Onay bekliyor",
  revision: "Revize istendi",
  answered: "Cevaplandı",
  approved: "Onaylandı",
};

const initialNewUser = {
  name: "",
  username: "",
  password: "",
  role: "foreman",
  permissions: [],
  workPermissions: [],
};

const defaultProgressRanges = [
  { id: "range-0-20", min: 0, max: 20, color: "#d93636", label: "0-20" },
  { id: "range-20-40", min: 20, max: 40, color: "#e0b428", label: "20-40" },
  { id: "range-40-100", min: 40, max: 100, color: "#1f9d63", label: "40-100" },
];

const textFixes = [
  ["Ä°", "İ"],
  ["Ä±", "ı"],
  ["ÄŸ", "ğ"],
  ["Äž", "Ğ"],
  ["Ã¼", "ü"],
  ["Ãœ", "Ü"],
  ["Ã¶", "ö"],
  ["Ã–", "Ö"],
  ["ÅŸ", "ş"],
  ["Å", "Ş"],
  ["Ã§", "ç"],
  ["Ã‡", "Ç"],
  ["Â·", "·"],
];

function cleanText(value) {
  if (typeof value !== "string") return value;
  return textFixes.reduce((text, [bad, good]) => text.replaceAll(bad, good), value);
}

function makeLog(actor, action, detail) {
  return {
    id: `LOG-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    at: new Date().toISOString(),
    actor: actor?.name || "Sistem",
    action,
    detail,
  };
}

function copySeed() {
  return normalizeState({ ...seedData, progressRanges: seedData.progressRanges || defaultProgressRanges });
}

function normalizeState(raw) {
  const draft = JSON.parse(JSON.stringify(raw));
  draft.progressRanges = draft.progressRanges?.length ? draft.progressRanges : defaultProgressRanges;
  draft.logs = draft.logs || [];
  draft.workItems = (draft.workItems || []).map((work) => ({ ...work, label: cleanText(work.label) }));
  draft.buildings = (draft.buildings || []).map((building) => {
    const count = Math.max(1, building.works?.length || 1);
    const works = (building.works || []).map((work) => ({
      ...work,
      label: cleanText(work.label),
      quantity: clampQuantity(work.quantity),
      weight: clampPercent(work.weight ?? Math.round(100 / count)),
    }));
    return {
      ...building,
      name: cleanText(building.name),
      lineColor: cleanText(building.lineColor),
      works,
      progress: building.progress || Object.fromEntries(works.map((work) => [work.key, 0])),
      files: building.files || [],
    };
  });
  draft.users = (draft.users || []).map((user) => ({
    ...user,
    name: cleanText(user.name),
    workPermissions: user.role === "admin" ? draft.workItems.map((work) => work.key) : user.workPermissions || [],
  }));
  draft.requests = draft.requests || [];
  draft.regions = (draft.regions || []).map((region) => ({
    ...region,
    shape: region.points?.length ? "polygon" : region.shape || "rect",
  }));
  return draft;
}

function loadInitialState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return copySeed();
  try {
    const seed = copySeed();
    const parsed = JSON.parse(saved);
    const allWorkKeys = seed.workItems.map((work) => work.key);
    const users = (parsed.users?.length ? parsed.users : seed.users).map((user) => ({
      ...user,
      workPermissions: user.role === "admin" ? allWorkKeys : user.workPermissions || [],
    }));
    return normalizeState({
      ...seed,
      ...parsed,
      buildings: parsed.buildings?.length ? parsed.buildings : seedData.buildings,
      workItems: parsed.workItems?.length ? parsed.workItems : seedData.workItems,
      regions:
        parsed.regions?.length && parsed.regions.length >= seedData.regions.length ? parsed.regions : seedData.regions,
      users,
      requests: parsed.requests || [],
      progressRanges: parsed.progressRanges?.length ? parsed.progressRanges : seed.progressRanges,
    });
  } catch {
    return copySeed();
  }
}

function clampPercent(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return 0;
  return Math.min(100, Math.max(0, Math.round(number)));
}

function getBuildingProgress(building) {
  if (!building?.works?.length) return 0;
  const fallbackWeight = 100 / building.works.length;
  const totalWeight = building.works.reduce((sum, work) => sum + Number(work.weight || fallbackWeight), 0);
  const total = building.works.reduce((sum, work) => {
    const weight = Number(work.weight || fallbackWeight);
    return sum + Number(building.progress?.[work.key] || 0) * (weight / Math.max(1, totalWeight));
  }, 0);
  return clampPercent(total);
}

function canAccess(user, buildingId) {
  if (!user) return false;
  return user.role === "admin" || user.permissions.includes(buildingId);
}

function progressTone(value) {
  if (value >= 75) return "good";
  if (value >= 40) return "mid";
  if (value > 0) return "low";
  return "empty";
}

function statusTone(status) {
  if (status === "approved") return "good";
  if (status === "answered") return "mid";
  if (status === "revision") return "warn";
  return "info";
}

function formatQuantity(value) {
  if (!value) return "0";
  return Number(value).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}

function clampQuantity(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return 0;
  return Math.max(0, number);
}

function getUserWorkPermissions(user, workItems) {
  if (!user) return [];
  if (user.role === "admin") return workItems.map((work) => work.key);
  return user.workPermissions || [];
}

function getRequestItems(request) {
  if (request.items?.length) return request.items;
  return (request.workKeys || []).map((workKey) => ({
    workKey,
    quantity: 0,
    approvedQuantity: 0,
  }));
}

function getProgressRange(progress, ranges) {
  const sorted = [...(ranges?.length ? ranges : defaultProgressRanges)].sort((a, b) => Number(a.min) - Number(b.min));
  return sorted.find((range) => progress >= Number(range.min) && progress <= Number(range.max)) || sorted[sorted.length - 1];
}

function App() {
  const [state, setState] = useState(loadInitialState);
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem(SESSION_KEY));
  const [activeTab, setActiveTab] = useState("map");
  const [selectedRegionId, setSelectedRegionId] = useState(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState(null);
  const [openBuildingId, setOpenBuildingId] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (currentUserId) localStorage.setItem(SESSION_KEY, currentUserId);
    else localStorage.removeItem(SESSION_KEY);
  }, [currentUserId]);

  const currentUser = state.users.find((user) => user.id === currentUserId);

  useEffect(() => {
    if (currentUserId && !currentUser) {
      setCurrentUserId(null);
    }
  }, [currentUser, currentUserId]);

  const buildingsById = useMemo(() => {
    return Object.fromEntries(state.buildings.map((building) => [building.id, building]));
  }, [state.buildings]);

  const selectedRegion = state.regions.find((region) => region.id === selectedRegionId);
  const selectedBuilding =
    buildingsById[selectedBuildingId] || (selectedRegion ? buildingsById[selectedRegion.buildingId] : null);
  const openBuilding = buildingsById[openBuildingId];
  const openRegion =
    state.regions.find((region) => region.id === selectedRegionId && region.buildingId === openBuildingId) ||
    state.regions.find((region) => region.buildingId === openBuildingId);

  const accessibleBuildings = useMemo(() => {
    return state.buildings.filter((building) => canAccess(currentUser, building.id));
  }, [currentUser, state.buildings]);

  const visibleBuildings = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    if (!needle) return accessibleBuildings;
    return accessibleBuildings.filter((building) => {
      return `${building.code} ${building.name} ${building.lineColor}`.toLocaleLowerCase("tr-TR").includes(needle);
    });
  }, [accessibleBuildings, query]);

  function updateState(updater) {
    setState((previous) => {
      const draft = JSON.parse(JSON.stringify(previous));
      updater(draft);
      return draft;
    });
  }

  function login(userId) {
    setCurrentUserId(userId);
    setActiveTab("map");
    const user = state.users.find((item) => item.id === userId);
    const firstBuilding = state.buildings.find((building) => canAccess(user, building.id));
    setSelectedBuildingId(firstBuilding?.id || null);
  }

  function handleLogout() {
    setCurrentUserId(null);
    setSelectedRegionId(null);
    setSelectedBuildingId(null);
    setOpenBuildingId(null);
  }

  function resetDemoData() {
    const fresh = copySeed();
    setState(fresh);
    const user = fresh.users.find((item) => item.role === "admin");
    setCurrentUserId(user?.id || null);
    setSelectedRegionId(null);
    setSelectedBuildingId(null);
    setOpenBuildingId(null);
    setActiveTab("map");
  }

  function setWorkProgress(buildingId, workKey, value) {
    updateState((draft) => {
      const building = draft.buildings.find((item) => item.id === buildingId);
      if (!building) return;
      building.progress = building.progress || {};
      building.progress[workKey] = clampPercent(value);
      draft.logs.unshift(makeLog(currentUser, "İş yüzdesi güncellendi", `${building.code} / ${workKey}: ${building.progress[workKey]}%`));
    });
  }

  function setWorkQuantity(buildingId, workKey, value) {
    updateState((draft) => {
      const building = draft.buildings.find((item) => item.id === buildingId);
      const work = building?.works.find((item) => item.key === workKey);
      if (!work) return;
      work.quantity = clampQuantity(value);
      draft.logs.unshift(makeLog(currentUser, "İş miktarı güncellendi", `${building.code} / ${work.label}: ${formatQuantity(work.quantity)}`));
    });
  }

  function setWorkWeight(buildingId, workKey, value) {
    updateState((draft) => {
      const building = draft.buildings.find((item) => item.id === buildingId);
      const work = building?.works.find((item) => item.key === workKey);
      if (!work) return;
      work.weight = clampPercent(value);
      draft.logs.unshift(makeLog(currentUser, "İş ağırlığı güncellendi", `${building.code} / ${work.label}: ${work.weight}%`));
    });
  }

  function updateWorkLabel(buildingId, workKey, label) {
    updateState((draft) => {
      const building = draft.buildings.find((item) => item.id === buildingId);
      const work = building?.works.find((item) => item.key === workKey);
      if (!work) return;
      work.label = label;
      const globalWork = draft.workItems.find((item) => item.key === workKey);
      if (globalWork) globalWork.label = label;
      draft.logs.unshift(makeLog(currentUser, "İş kalemi adı güncellendi", `${building.code} / ${label}`));
    });
  }

  function addBuildingWork(buildingId, label) {
    const cleanLabel = label.trim();
    if (!cleanLabel) return;
    updateState((draft) => {
      const building = draft.buildings.find((item) => item.id === buildingId);
      if (!building) return;
      const keyBase = cleanLabel
        .toLocaleLowerCase("tr-TR")
        .replace(/[^a-z0-9ığüşöç]+/gi, "_")
        .replace(/^_+|_+$/g, "");
      const key = `${keyBase || "ek_is"}_${Date.now()}`;
      building.works.push({ key, label: cleanLabel, quantity: 0, weight: 0 });
      building.progress = building.progress || {};
      building.progress[key] = 0;
      draft.workItems.push({ key, label: cleanLabel });
      draft.logs.unshift(makeLog(currentUser, "Ek iş kalemi eklendi", `${building.code} / ${cleanLabel}`));
    });
  }

  function deleteBuildingWork(buildingId, workKey) {
    updateState((draft) => {
      const building = draft.buildings.find((item) => item.id === buildingId);
      const work = building?.works.find((item) => item.key === workKey);
      if (!building || !work) return;
      building.works = building.works.filter((item) => item.key !== workKey);
      if (building.progress) delete building.progress[workKey];
      const stillUsed = draft.buildings.some((item) => item.works.some((buildingWork) => buildingWork.key === workKey));
      if (!stillUsed) {
        draft.workItems = draft.workItems.filter((item) => item.key !== workKey);
        draft.users.forEach((user) => {
          user.workPermissions = (user.workPermissions || []).filter((key) => key !== workKey);
        });
      }
      draft.requests.forEach((request) => {
        request.items = (request.items || []).filter((item) => item.workKey !== workKey);
      });
      draft.logs.unshift(makeLog(currentUser, "İş kalemi silindi", `${building.code} / ${work.label}`));
    });
  }

  function addBuildingFile(buildingId, file) {
    updateState((draft) => {
      const building = draft.buildings.find((item) => item.id === buildingId);
      if (!building) return;
      building.files = building.files || [];
      building.files.unshift(file);
      draft.logs.unshift(makeLog(currentUser, "Bina dosyası yüklendi", `${building.code} / ${file.name}`));
    });
  }

  function createRequest(payload) {
    updateState((draft) => {
      draft.requests.unshift({
        id: `REQ-${Date.now()}`,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.id,
        createdByName: currentUser.name,
        status: "pending",
        adminNote: "",
        ...payload,
      });
      draft.logs.unshift(makeLog(currentUser, "Talep oluşturuldu", payload.adminTask ? "Süper admin saha isteği" : `${payload.buildingId} ilerleme talebi`));
    });
  }

  function approveRequest(requestId, approvedItems, note) {
    updateState((draft) => {
      const request = draft.requests.find((item) => item.id === requestId);
      if (!request) return;
      request.status = "approved";
      const requestedItems = getRequestItems(request);
      request.items = requestedItems.map((item) => {
        const approved = approvedItems?.find((approvedItem) => approvedItem.workKey === item.workKey);
        return {
          ...item,
          approvedQuantity: clampQuantity(approved?.approvedQuantity ?? item.quantity),
        };
      });
      request.adminNote = note || "";
      request.reviewedAt = new Date().toISOString();
      request.reviewedBy = currentUser.name;
      request.adminTask = false;

      const building = draft.buildings.find((item) => item.id === request.buildingId);
      if (!building) return;
      building.progress = building.progress || {};
      request.items.forEach((item) => {
        const work = building.works.find((buildingWork) => buildingWork.key === item.workKey);
        if (!work || Number(work.quantity) <= 0) return;
        const addPercent = (Number(item.approvedQuantity || 0) / Number(work.quantity)) * 100;
        building.progress[item.workKey] = clampPercent(Number(building.progress[item.workKey] || 0) + addPercent);
      });
      draft.logs.unshift(makeLog(currentUser, "Talep onaylandı", `${building.code} / ${request.id}`));
    });
  }

  function requestRevision(requestId, note) {
    updateState((draft) => {
      const request = draft.requests.find((item) => item.id === requestId);
      if (!request) return;
      request.status = "revision";
      request.adminNote = note || "Revize gerekli";
      request.reviewedAt = new Date().toISOString();
      request.reviewedBy = currentUser.name;
      draft.logs.unshift(makeLog(currentUser, "Revize istendi", `${request.buildingId} / ${request.id}`));
    });
  }

  function answerRevision(requestId, answer, photo) {
    updateState((draft) => {
      const request = draft.requests.find((item) => item.id === requestId);
      if (!request) return;
      request.status = "answered";
      request.revisionAnswer = answer || "";
      request.answerPhoto = photo || "";
      request.answeredAt = new Date().toISOString();
      draft.logs.unshift(makeLog(currentUser, "Revize cevaplandı", `${request.buildingId} / ${request.id}`));
    });
  }

  function updateRegionBuilding(regionId, buildingId) {
    updateState((draft) => {
      const region = draft.regions.find((item) => item.id === regionId);
      if (region) region.buildingId = buildingId;
    });
    setSelectedBuildingId(buildingId);
  }

  function updateRegionGeometry(regionId, points) {
    updateState((draft) => {
      const region = draft.regions.find((item) => item.id === regionId);
      if (!region) return;
      region.points = points;
      region.shape = "polygon";
      delete region.x;
      delete region.y;
      delete region.width;
      delete region.height;
      draft.logs.unshift(makeLog(currentUser, "Harita poligonu güncellendi", region.id));
    });
  }

  function addManualRegion(region) {
    const buildingId =
      (selectedBuildingId && canAccess(currentUser, selectedBuildingId) && selectedBuildingId) ||
      accessibleBuildings[0]?.id ||
      state.buildings[0]?.id;
    if (!buildingId) return;

    const regionId = `MANUAL-MOR-${Date.now()}`;
    updateState((draft) => {
      draft.regions.push({
        id: regionId,
        shape: region.points?.length ? "polygon" : "rect",
        source: "manual",
        buildingId,
        ...region,
      });
    });
    setSelectedRegionId(regionId);
    setSelectedBuildingId(buildingId);
    setOpenBuildingId(buildingId);
    setManualMode(false);
  }

  function deleteRegion(regionId) {
    updateState((draft) => {
      draft.regions = draft.regions.filter((region) => region.id !== regionId);
    });
    setSelectedRegionId(null);
    setOpenBuildingId(null);
  }

  function updateProgressRange(rangeId, patch) {
    updateState((draft) => {
      draft.progressRanges = draft.progressRanges || defaultProgressRanges;
      const range = draft.progressRanges.find((item) => item.id === rangeId);
      if (!range) return;
      Object.assign(range, patch);
      if (patch.min !== undefined) range.min = clampPercent(patch.min);
      if (patch.max !== undefined) range.max = clampPercent(patch.max);
      range.label = `${range.min}-${range.max}`;
    });
  }

  function addProgressRange() {
    updateState((draft) => {
      draft.progressRanges = draft.progressRanges || defaultProgressRanges;
      draft.progressRanges.push({
        id: `range-${Date.now()}`,
        min: 0,
        max: 100,
        color: "#2b6cb0",
        label: "0-100",
      });
    });
  }

  function deleteProgressRange(rangeId) {
    updateState((draft) => {
      draft.progressRanges = (draft.progressRanges || defaultProgressRanges).filter((range) => range.id !== rangeId);
      if (draft.progressRanges.length === 0) draft.progressRanges = JSON.parse(JSON.stringify(defaultProgressRanges));
    });
  }

  function updateUser(userId, patch) {
    updateState((draft) => {
      const user = draft.users.find((item) => item.id === userId);
      if (!user) return;
      Object.assign(user, patch);
      if (user.role === "admin") {
        user.permissions = draft.buildings.map((building) => building.id);
      }
    });
  }

  function toggleUserPermission(userId, buildingId) {
    updateState((draft) => {
      const user = draft.users.find((item) => item.id === userId);
      if (!user || user.role === "admin") return;
      const hasPermission = user.permissions.includes(buildingId);
      user.permissions = hasPermission
        ? user.permissions.filter((id) => id !== buildingId)
        : [...user.permissions, buildingId];
    });
  }

  function toggleUserWorkPermission(userId, workKey) {
    updateState((draft) => {
      const user = draft.users.find((item) => item.id === userId);
      if (!user || user.role === "admin") return;
      user.workPermissions = user.workPermissions || draft.workItems.map((work) => work.key);
      const hasPermission = user.workPermissions.includes(workKey);
      user.workPermissions = hasPermission
        ? user.workPermissions.filter((key) => key !== workKey)
        : [...user.workPermissions, workKey];
    });
  }

  function bulkSetWorkPermissions(userId, mode) {
    updateState((draft) => {
      const user = draft.users.find((item) => item.id === userId);
      if (!user || user.role === "admin") return;
      user.workPermissions = mode === "all" ? draft.workItems.map((work) => work.key) : [];
    });
  }

  function bulkSetPermissions(userId, mode) {
    updateState((draft) => {
      const user = draft.users.find((item) => item.id === userId);
      if (!user || user.role === "admin") return;
      if (mode === "all") {
        user.permissions = draft.buildings.map((building) => building.id);
      } else if (mode === "clear") {
        user.permissions = [];
      } else {
        user.permissions = draft.buildings
          .filter((building) => mode.includes(building.lineColor.toLocaleUpperCase("tr-TR")))
          .map((building) => building.id);
      }
    });
  }

  function addUser(user) {
    updateState((draft) => {
      draft.users.push({
        ...user,
        id: `u-${Date.now()}`,
        permissions: user.role === "admin" ? draft.buildings.map((building) => building.id) : user.permissions,
        workPermissions:
          user.role === "admin"
            ? draft.workItems.map((work) => work.key)
            : user.workPermissions?.length
              ? user.workPermissions
              : [],
      });
      draft.logs.unshift(makeLog(currentUser, "Kullanıcı eklendi", user.username));
    });
  }

  function deleteUser(userId) {
    updateState((draft) => {
      const user = draft.users.find((item) => item.id === userId);
      if (!user || user.id === currentUser?.id) return;
      draft.users = draft.users.filter((item) => item.id !== userId);
      draft.logs.unshift(makeLog(currentUser, "Kullanıcı silindi", user.username));
    });
  }

  if (!currentUser) {
    return <LoginScreen users={state.users} onLogin={login} />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <MapPinned size={24} />
          </div>
          <div>
            <h1>Tugay Mekanik</h1>
            <p>Saha ilerleme takip paneli</p>
          </div>
        </div>

        <nav className="tabbar" aria-label="Ana sayfalar">
          <button className={activeTab === "map" ? "active" : ""} onClick={() => setActiveTab("map")}>
            <MapPinned size={17} />
            Harita
          </button>
          <button className={activeTab === "requests" ? "active" : ""} onClick={() => setActiveTab("requests")}>
            <ClipboardList size={17} />
            Talepler
          </button>
          {currentUser.role === "admin" && (
            <>
              <button className={activeTab === "buildings" ? "active" : ""} onClick={() => setActiveTab("buildings")}>
                <Building2 size={17} />
                Binalar
              </button>
              <button className={activeTab === "logs" ? "active" : ""} onClick={() => setActiveTab("logs")}>
                <FileText size={17} />
                Log
              </button>
              <button className={activeTab === "users" ? "active" : ""} onClick={() => setActiveTab("users")}>
                <UserCog size={17} />
                Kullanıcılar
              </button>
            </>
          )}
        </nav>

        <div className="user-chip">
          <CircleUserRound size={18} />
          <div>
            <strong>{currentUser.name}</strong>
            <span>{currentUser.role === "admin" ? "Süper Admin" : "Formen"}</span>
          </div>
          <button className="icon-button" title="Çıkış yap" onClick={handleLogout}>
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {activeTab === "map" && (
        <>
          <SummaryPanel
            user={currentUser}
            buildings={accessibleBuildings}
            requests={state.requests}
            progressRanges={state.progressRanges}
            onUpdateProgressRange={updateProgressRange}
            onAddProgressRange={addProgressRange}
            onDeleteProgressRange={deleteProgressRange}
            onReset={resetDemoData}
          />
          <main className="workspace">
            <BuildingSidebar
              buildings={visibleBuildings}
              totalCount={accessibleBuildings.length}
              query={query}
              onQuery={setQuery}
              selectedBuildingId={selectedBuilding?.id}
              onSelect={(buildingId) => {
                setSelectedBuildingId(buildingId);
                const region = state.regions.find((item) => item.buildingId === buildingId);
                setSelectedRegionId(region?.id || null);
                setOpenBuildingId(buildingId);
              }}
            />
            <MapPanel
              map={state.map}
              regions={state.regions}
              buildingsById={buildingsById}
              user={currentUser}
              selectedRegionId={selectedRegionId}
              zoom={zoom}
              onZoom={setZoom}
              progressRanges={state.progressRanges}
              manualMode={manualMode}
              onManualModeChange={setManualMode}
              onManualRegionAdd={addManualRegion}
              onSelect={(region) => {
                if (!canAccess(currentUser, region.buildingId)) return;
                setSelectedRegionId(region.id);
                setSelectedBuildingId(region.buildingId);
                setOpenBuildingId(region.buildingId);
              }}
            />
          </main>
        </>
      )}

      {activeTab === "requests" && (
        <RequestsPanel
          user={currentUser}
          requests={state.requests}
          buildingsById={buildingsById}
          onApprove={approveRequest}
          onRevision={requestRevision}
          onAnswerRevision={answerRevision}
          onOpenBuilding={(buildingId) => {
            setSelectedBuildingId(buildingId);
            const region = state.regions.find((item) => item.buildingId === buildingId);
            setSelectedRegionId(region?.id || null);
            setOpenBuildingId(buildingId);
            setActiveTab("map");
          }}
        />
      )}

      {activeTab === "logs" && currentUser.role === "admin" && <LogsPanel logs={state.logs} />}

      {activeTab === "buildings" && currentUser.role === "admin" && (
        <BuildingsPanel
          buildings={state.buildings}
          selectedBuildingId={selectedBuilding?.id}
          onSelectBuilding={(buildingId) => {
            setSelectedBuildingId(buildingId);
            const region = state.regions.find((item) => item.buildingId === buildingId);
            setSelectedRegionId(region?.id || null);
          }}
          onOpenBuilding={(buildingId) => {
            setSelectedBuildingId(buildingId);
            const region = state.regions.find((item) => item.buildingId === buildingId);
            setSelectedRegionId(region?.id || null);
            setOpenBuildingId(buildingId);
          }}
          onSetWorkProgress={setWorkProgress}
          onSetWorkQuantity={setWorkQuantity}
          onSetWorkWeight={setWorkWeight}
          onUpdateWorkLabel={updateWorkLabel}
          onAddBuildingWork={addBuildingWork}
          onDeleteBuildingWork={deleteBuildingWork}
          progressRanges={state.progressRanges}
          onUpdateProgressRange={updateProgressRange}
          onAddProgressRange={addProgressRange}
          onDeleteProgressRange={deleteProgressRange}
        />
      )}

      {activeTab === "users" && currentUser.role === "admin" && (
        <UsersPanel
          users={state.users}
          buildings={state.buildings}
          workItems={state.workItems}
          onUpdateUser={updateUser}
          onTogglePermission={toggleUserPermission}
          onToggleWorkPermission={toggleUserWorkPermission}
          onBulkPermissions={bulkSetPermissions}
          onBulkWorkPermissions={bulkSetWorkPermissions}
          onAddUser={addUser}
          onDeleteUser={deleteUser}
        />
      )}

      {openBuilding && (
        <BuildingModal
          user={currentUser}
          building={openBuilding}
          region={openRegion}
          regions={state.regions}
          buildings={state.buildings}
          requests={state.requests.filter((request) => request.buildingId === openBuilding.id)}
          onClose={() => setOpenBuildingId(null)}
          onSetWorkProgress={setWorkProgress}
          onSetWorkQuantity={setWorkQuantity}
          onSetWorkWeight={setWorkWeight}
          onUpdateWorkLabel={updateWorkLabel}
          onAddBuildingWork={addBuildingWork}
          onDeleteBuildingWork={deleteBuildingWork}
          onAddBuildingFile={addBuildingFile}
          onCreateRequest={createRequest}
          onApproveRequest={approveRequest}
          onRevision={requestRevision}
          onAnswerRevision={answerRevision}
          onUpdateRegionBuilding={updateRegionBuilding}
          onUpdateRegionGeometry={updateRegionGeometry}
          onDeleteRegion={deleteRegion}
        />
      )}
    </div>
  );
}

function LoginScreen({ users, onLogin }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");

  function submit(event) {
    event.preventDefault();
    const user = users.find((item) => item.username === username && item.password === password);
    if (!user) {
      setError("Kullanıcı adı veya şifre hatalı.");
      return;
    }
    onLogin(user.id);
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <form className="login-form" onSubmit={submit}>
          <div className="login-title">
            <div className="brand-mark">
              <Building2 size={24} />
            </div>
            <div>
              <h1>Tugay Mekanik</h1>
              <p>Giriş yap</p>
            </div>
          </div>

          <label>
            Kullanıcı adı
            <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </label>

          <label>
            Şifre
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <button className="primary-action" type="submit">
            <Lock size={17} />
            Giriş
          </button>

        </form>
      </section>
    </main>
  );
}

function BuildingSidebar({ buildings, totalCount, query, onQuery, selectedBuildingId, onSelect }) {
  return (
    <aside className="sidebar">
      <div className="section-heading">
        <div>
          <span>Binalar</span>
          <strong>{totalCount} erişim</strong>
        </div>
      </div>
      <label className="search-field">
        <Search size={17} />
        <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Kod, ad veya hat ara" />
      </label>
      <div className="building-list">
        {buildings.map((building) => {
          const progress = getBuildingProgress(building);
          return (
            <button
              key={building.id}
              className={`building-row ${selectedBuildingId === building.id ? "active" : ""}`}
              onClick={() => onSelect(building.id)}
            >
              <div className="building-row-main">
                <strong>{building.code}</strong>
                <span>{building.name}</span>
              </div>
              <div className="row-meta">
                <span>{building.lineColor}</span>
                <b>{progress}%</b>
              </div>
              <div className="mini-progress">
                <i style={{ width: `${progress}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function MapPanel({
  map,
  regions,
  buildingsById,
  user,
  selectedRegionId,
  zoom,
  onZoom,
  progressRanges,
  manualMode,
  onManualModeChange,
  onManualRegionAdd,
  onSelect,
}) {
  const [draftPoints, setDraftPoints] = useState([]);

  function getSvgPoint(event) {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(map.width, Math.max(0, ((event.clientX - box.left) / box.width) * map.width)),
      y: Math.min(map.height, Math.max(0, ((event.clientY - box.top) / box.height) * map.height)),
    };
  }

  function addManualPoint(event) {
    if (user.role !== "admin" || !manualMode) return;
    const point = getSvgPoint(event);
    setDraftPoints((previous) => [...previous, point]);
  }

  function finishManualPolygon() {
    if (draftPoints.length < 3) return;
    onManualRegionAdd({
      points: draftPoints.map((point) => ({
        x: Number((point.x / map.width).toFixed(5)),
        y: Number((point.y / map.height).toFixed(5)),
      })),
    });
    setDraftPoints([]);
  }

  function getRegionGeometry(region) {
    if (region.points?.length) {
      return {
        type: "polygon",
        points: region.points.map((point) => `${point.x * map.width},${point.y * map.height}`).join(" "),
      };
    }
    return {
      type: "rect",
      x: region.x * map.width,
      y: region.y * map.height,
      width: region.width * map.width,
      height: region.height * map.height,
    };
  }

  return (
    <section className="map-section">
      <div className="map-toolbar">
        <div>
          <strong>PDF Harita</strong>
          <span>{regions.length} mor şekil</span>
        </div>
        <div className="map-actions">
          {user.role === "admin" && (
            <button
              className={`secondary-action tool-toggle ${manualMode ? "active" : ""}`}
              onClick={() => onManualModeChange(!manualMode)}
            >
              <Plus size={16} />
              Poligon çiz
            </button>
          )}
          {manualMode && (
            <>
              <button className="secondary-action" disabled={draftPoints.length < 3} onClick={finishManualPolygon}>
                <Check size={16} />
                Bitir
              </button>
              <button className="icon-button" title="Çizimi temizle" onClick={() => setDraftPoints([])}>
                <X size={16} />
              </button>
            </>
          )}
          <button className="icon-button" title="Uzaklaştır" onClick={() => onZoom(Math.max(0.45, zoom - 0.15))}>
            <ZoomOut size={17} />
          </button>
          <input
            aria-label="Harita yakınlaştırma"
            type="range"
            min="0.45"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(event) => onZoom(Number(event.target.value))}
          />
          <button className="icon-button" title="Yakınlaştır" onClick={() => onZoom(Math.min(3, zoom + 0.15))}>
            <ZoomIn size={17} />
          </button>
        </div>
      </div>

      <div className="map-scroll">
        <div className={`map-canvas ${manualMode ? "manual" : ""}`} style={{ width: `${map.width * zoom}px` }}>
          <img src={map.image} alt="TBS-2 PDF haritası" />
          <svg
            viewBox={`0 0 ${map.width} ${map.height}`}
            preserveAspectRatio="none"
            onClick={addManualPoint}
          >
            {regions.map((region) => {
              const building = buildingsById[region.buildingId];
              const allowed = canAccess(user, region.buildingId);
              const progress = getBuildingProgress(building);
              const tone = progressTone(progress);
              const progressRange = getProgressRange(progress, progressRanges);
              const geometry = getRegionGeometry(region);
              const shapeProps = {
                className: `hotspot-shape ${selectedRegionId === region.id ? "selected" : ""}`,
                style: {
                  fill: allowed ? `${progressRange?.color || "#d91acb"}55` : "rgba(86, 98, 116, 0.08)",
                  stroke: "#6d747c",
                },
                onClick: (event) => {
                  event.stopPropagation();
                  onSelect(region);
                },
              };
              return (
                <g key={region.id} className={`hotspot ${allowed ? "allowed" : "locked"} ${tone}`}>
                  {geometry.type === "polygon" ? (
                    <polygon points={geometry.points} {...shapeProps} />
                  ) : (
                    <rect x={geometry.x} y={geometry.y} width={geometry.width} height={geometry.height} rx="2" {...shapeProps} />
                  )}
                  <title>{`${region.id} · ${building?.code || "Bina seçilmedi"} · ${progress}%`}</title>
                </g>
              );
            })}
            {draftPoints.length > 0 && (
              <>
                <polyline className="manual-draft-line" points={draftPoints.map((point) => `${point.x},${point.y}`).join(" ")} />
                {draftPoints.map((point, index) => (
                  <circle className="manual-draft-point" key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r="7" />
                ))}
              </>
            )}
          </svg>
        </div>
      </div>
    </section>
  );
}

function SummaryPanel({
  user,
  buildings,
  requests,
  progressRanges,
  onUpdateProgressRange,
  onAddProgressRange,
  onDeleteProgressRange,
  onReset,
}) {
  const progressSum = buildings.reduce((sum, building) => sum + getBuildingProgress(building), 0);
  const average = buildings.length && progressSum > 0 ? Math.max(1, Math.round(progressSum / buildings.length)) : 0;
  const pending = requests.filter((request) => request.status === "pending").length;
  const revision = requests.filter((request) => request.status === "revision").length;

  return (
    <aside className="summary-panel">
      <div className="metric-block">
        <span>Genel ilerleme</span>
        <strong>{average}%</strong>
        <div className="big-progress">
          <i style={{ width: `${average}%` }} />
        </div>
      </div>
      <div className="metric-grid">
        <div>
          <span>Erişim</span>
          <strong>{buildings.length}</strong>
        </div>
        <div>
          <span>Bekleyen</span>
          <strong>{pending}</strong>
        </div>
        <div>
          <span>Revize</span>
          <strong>{revision}</strong>
        </div>
        <div>
          <span>Rol</span>
          <strong>{user.role === "admin" ? "Admin" : "Formen"}</strong>
        </div>
      </div>
      {user.role === "admin" && (
        <button className="secondary-action full-width" onClick={onReset}>
          <RotateCcw size={16} />
          Veriyi sıfırla
        </button>
      )}
    </aside>
  );
}

function BuildingModal({
  user,
  building,
  region,
  regions,
  buildings,
  requests,
  onClose,
  onSetWorkProgress,
  onSetWorkQuantity,
  onSetWorkWeight,
  onUpdateWorkLabel,
  onAddBuildingWork,
  onDeleteBuildingWork,
  onAddBuildingFile,
  onCreateRequest,
  onApproveRequest,
  onRevision,
  onAnswerRevision,
  onUpdateRegionBuilding,
  onUpdateRegionGeometry,
  onDeleteRegion,
}) {
  const [requestQuantities, setRequestQuantities] = useState({});
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState("");
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [newWorkLabel, setNewWorkLabel] = useState("");
  const [adminTaskNote, setAdminTaskNote] = useState("");
  const [revisionAnswers, setRevisionAnswers] = useState({});

  useEffect(() => {
    setRequestQuantities({});
    setNote("");
    setPhoto("");
  }, [building.id]);

  const progress = getBuildingProgress(building);
  const allowedWorkKeys = getUserWorkPermissions(user, building.works);
  const requestableWorks = building.works.filter((work) => allowedWorkKeys.includes(work.key));
  const visibleWorks = user.role === "admin" ? building.works : requestableWorks;
  const requestItems = requestableWorks
    .map((work) => ({
      workKey: work.key,
      quantity: clampQuantity(requestQuantities[work.key]),
    }))
    .filter((item) => item.quantity > 0);
  const canSubmit = user.role !== "admin" && requestItems.length > 0;

  function setRequestQuantity(workKey, value) {
    setRequestQuantities((previous) => ({
      ...previous,
      [workKey]: value,
    }));
  }

  function handlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result));
    reader.readAsDataURL(file);
  }

  function handleBuildingFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      onAddBuildingFile(building.id, {
        id: `FILE-${Date.now()}`,
        name: file.name,
        type: file.type,
        data: String(reader.result),
        uploadedAt: new Date().toISOString(),
        uploadedBy: user.name,
      });
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function submitRequest(event) {
    event.preventDefault();
    if (!canSubmit) return;
    onCreateRequest({
      buildingId: building.id,
      items: requestItems,
      note,
      photo,
    });
    setNote("");
    setPhoto("");
    setRequestQuantities({});
  }

  function submitAdminTask(event) {
    event.preventDefault();
    if (!adminTaskNote.trim()) return;
    onCreateRequest({
      buildingId: building.id,
      items: [],
      note: adminTaskNote,
      photo: "",
      adminTask: true,
    });
    setAdminTaskNote("");
  }

  function submitRevisionAnswer(requestId) {
    const draft = revisionAnswers[requestId] || {};
    if (!draft.note?.trim() && !draft.photo) return;
    onAnswerRevision(requestId, draft.note, draft.photo);
    setRevisionAnswers((previous) => ({ ...previous, [requestId]: { note: "", photo: "" } }));
  }

  function handleRevisionPhoto(requestId, event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      setRevisionAnswers((previous) => ({
        ...previous,
        [requestId]: { ...(previous[requestId] || {}), photo: String(reader.result) },
      }));
    reader.readAsDataURL(file);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="building-modal">
        <header className="modal-header">
          <div>
            <span>{region?.id || "Bina kaydı"}</span>
            <h2>
              {building.code} · {building.name}
            </h2>
            <p>{building.lineColor} hat</p>
          </div>
          <button className="icon-button" title="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="modal-grid">
          <section className="work-panel">
            <div className="progress-header">
              <div>
                <span>Genel yüzde</span>
                <strong>{progress}%</strong>
              </div>
              <div className={`status-dot ${progressTone(progress)}`} />
            </div>
            <div className="big-progress">
              <i style={{ width: `${progress}%` }} />
            </div>

            <div className="work-list">
              {visibleWorks.map((work) => {
                const value = Number(building.progress?.[work.key] || 0);
                return (
                  <div className="work-item" key={work.key}>
                    <div>
                      {user.role === "admin" ? (
                        <input
                          className="inline-text-input"
                          value={work.label}
                          onChange={(event) => onUpdateWorkLabel(building.id, work.key, event.target.value)}
                        />
                      ) : (
                        <strong>{work.label}</strong>
                      )}
                      <span>{formatQuantity(work.quantity)} adet/metraj</span>
                    </div>
                    {user.role === "admin" ? (
                      <div className="admin-work-edit">
                        <label>
                          Toplam
                          <input
                            type="number"
                            min="0"
                            value={work.quantity}
                            onChange={(event) => onSetWorkQuantity(building.id, work.key, event.target.value)}
                          />
                        </label>
                        <label>
                          Ağırlık
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={work.weight ?? 0}
                            onChange={(event) => onSetWorkWeight(building.id, work.key, event.target.value)}
                          />
                        </label>
                        <label className="range-line">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={value}
                            onChange={(event) => onSetWorkProgress(building.id, work.key, event.target.value)}
                          />
                          <b>{value}%</b>
                        </label>
                        <button
                          className="icon-button danger"
                          title="İşi sil"
                          type="button"
                          onClick={() => onDeleteBuildingWork(building.id, work.key)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="inline-progress">
                        <i style={{ width: `${value}%` }} />
                        <b>{value}%</b>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {user.role === "admin" && (
              <form
                className="add-work-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  onAddBuildingWork(building.id, newWorkLabel);
                  setNewWorkLabel("");
                }}
              >
                <input value={newWorkLabel} onChange={(event) => setNewWorkLabel(event.target.value)} placeholder="Ek iş kalemi adı" />
                <button className="secondary-action" type="submit">
                  <Plus size={16} />
                  Ekle
                </button>
              </form>
            )}
          </section>

          <section className="request-panel">
            {user.role === "admin" && region && (
              <div className="admin-box">
                <span>{region.points?.length ? `${region.points.length} noktalı poligon` : "PDF bölgesi"} · {regions.length} harita alanı</span>
                {region.source === "manual" && (
                  <button className="secondary-action" onClick={() => onDeleteRegion(region.id)}>
                    <X size={16} />
                    Harita alanını sil
                  </button>
                )}
              </div>
            )}

            {user.role === "admin" && (
              <>
                <form className="request-form" onSubmit={submitAdminTask}>
                  <div className="section-heading flat">
                    <div>
                      <span>Süper admin isteği</span>
                      <strong>{building.code}</strong>
                    </div>
                  </div>
                  <textarea
                    value={adminTaskNote}
                    onChange={(event) => setAdminTaskNote(event.target.value)}
                    placeholder="Formenlere gönderilecek istek"
                  />
                  <button className="primary-action" type="submit" disabled={!adminTaskNote.trim()}>
                    <MessageSquare size={17} />
                    İstek gönder
                  </button>
                </form>
                <div className="file-panel">
                  <label className="photo-upload">
                    <Upload size={17} />
                    Bina dosyası yükle
                    <input type="file" onChange={handleBuildingFile} />
                  </label>
                  {(building.files || []).map((file) => (
                    <a className="file-row" key={file.id} href={file.data} download={file.name}>
                      <FileText size={16} />
                      <span>{file.name}</span>
                    </a>
                  ))}
                </div>
              </>
            )}

            {user.role !== "admin" && (
              <form className="request-form" onSubmit={submitRequest}>
                <div className="section-heading flat">
                  <div>
                    <span>İlerleme talebi</span>
                    <strong>{building.code}</strong>
                  </div>
                </div>
                {requestableWorks.length === 0 && (
                  <div className="empty-state">Bu binada işaretleyebileceğin iş kalemi yok.</div>
                )}
                <div className="work-quantity-grid">
                  {requestableWorks.map((work) => (
                    <label key={work.key}>
                      <span>
                        <strong>{work.label}</strong>
                        Toplam: {formatQuantity(work.quantity)}
                      </span>
                      <input
                        type="number"
                        min="0"
                        max={work.quantity || undefined}
                        value={requestQuantities[work.key] || ""}
                        onChange={(event) => setRequestQuantity(work.key, event.target.value)}
                        placeholder="Yapılan"
                      />
                    </label>
                  ))}
                </div>
                <label>
                  Not
                  <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Kısa açıklama" />
                </label>
                <label className="photo-upload">
                  <Upload size={17} />
                  Fotoğraf yükle
                  <input type="file" accept="image/*" onChange={handlePhoto} />
                </label>
                {photo && <img className="photo-preview" src={photo} alt="Talep fotoğrafı" />}
                <button className="primary-action" type="submit" disabled={!canSubmit}>
                  <Camera size={17} />
                  Talep gönder
                </button>
              </form>
            )}

            <div className="request-history">
              <div className="section-heading flat">
                <div>
                  <span>Talep geçmişi</span>
                  <strong>{requests.length}</strong>
                </div>
              </div>
              {requests.length === 0 && <div className="empty-state">Bu bina için talep yok.</div>}
              {requests.map((request) => {
                const items = getRequestItems(request);
                const workLabels = items
                  .map((item) => {
                    const work = building.works.find((buildingWork) => buildingWork.key === item.workKey);
                    return `${work?.label || item.workKey}: ${formatQuantity(item.quantity)}`;
                  })
                  .join(", ") || "Süper admin isteği";
                const draft = reviewDrafts[request.id] || {
                  items: items.map((item) => ({
                    workKey: item.workKey,
                    approvedQuantity: item.approvedQuantity ?? item.quantity,
                  })),
                  note: request.adminNote || "",
                };
                return (
                  <article className="request-card" key={request.id}>
                    <div className="request-card-top">
                      <span className={`status-pill ${statusTone(request.status)}`}>{statusLabels[request.status]}</span>
                      <small>{new Date(request.createdAt).toLocaleDateString("tr-TR")}</small>
                    </div>
                    <strong>{workLabels}</strong>
                    <p>
                      {request.createdByName} · yapılan iş talebi
                    </p>
                    {request.note && <p className="request-note">{request.note}</p>}
                    {request.photo && <img className="request-photo" src={request.photo} alt="Talep eki" />}
                    {request.revisionAnswer && <p className="request-note">Formen cevabı: {request.revisionAnswer}</p>}
                    {request.answerPhoto && <img className="request-photo" src={request.answerPhoto} alt="Revize cevabı eki" />}
                    {user.role !== "admin" && request.status === "revision" && request.createdBy === user.id && (
                      <div className="review-controls">
                        <label>
                          Revize cevabı
                          <input
                            value={revisionAnswers[request.id]?.note || ""}
                            onChange={(event) =>
                              setRevisionAnswers((previous) => ({
                                ...previous,
                                [request.id]: { ...(previous[request.id] || {}), note: event.target.value },
                              }))
                            }
                            placeholder="Revize için açıklama"
                          />
                        </label>
                        <label className="photo-upload">
                          <Upload size={17} />
                          Fotoğraf ekle
                          <input type="file" accept="image/*" onChange={(event) => handleRevisionPhoto(request.id, event)} />
                        </label>
                        <button className="primary-action" onClick={() => submitRevisionAnswer(request.id)}>
                          <MessageSquare size={17} />
                          Cevapla
                        </button>
                      </div>
                    )}
                    {user.role === "admin" && ["pending", "answered"].includes(request.status) && (
                      <div className="review-controls">
                        <label>
                          Onaylanan işler
                          <div className="approval-quantity-list">
                            {items.map((item) => {
                              const work = building.works.find((buildingWork) => buildingWork.key === item.workKey);
                              const approvedItem = draft.items.find((draftItem) => draftItem.workKey === item.workKey);
                              return (
                                <div key={item.workKey}>
                                  <span>{work?.label || item.workKey}</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max={work?.quantity || undefined}
                                    value={approvedItem?.approvedQuantity ?? item.quantity}
                                    onChange={(event) =>
                                      setReviewDrafts((previous) => ({
                                        ...previous,
                                        [request.id]: {
                                          ...draft,
                                          items: draft.items.map((draftItem) =>
                                            draftItem.workKey === item.workKey
                                              ? { ...draftItem, approvedQuantity: event.target.value }
                                              : draftItem,
                                          ),
                                        },
                                      }))
                                    }
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </label>
                        <label>
                          Admin notu
                          <input
                            value={draft.note}
                            onChange={(event) =>
                              setReviewDrafts((previous) => ({
                                ...previous,
                                [request.id]: { ...draft, note: event.target.value },
                              }))
                            }
                          />
                        </label>
                        <div className="split-actions">
                          <button className="secondary-action" onClick={() => onRevision(request.id, draft.note)}>
                            <Edit3 size={16} />
                            Revize
                          </button>
                          <button className="primary-action" onClick={() => onApproveRequest(request.id, draft.items, draft.note)}>
                            <Check size={16} />
                            Onayla
                          </button>
                        </div>
                      </div>
                    )}
                    {request.adminNote && <p className="admin-note">Admin: {request.adminNote}</p>}
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function RequestsPanel({ user, requests, buildingsById, onApprove, onRevision, onAnswerRevision, onOpenBuilding }) {
  const [status, setStatus] = useState("all");
  const [drafts, setDrafts] = useState({});
  const [answers, setAnswers] = useState({});

  const visible = requests
    .filter((request) => {
      const mine = user.role === "admin" || request.createdBy === user.id || (request.adminTask && canAccess(user, request.buildingId));
      const matchesStatus = status === "all" || request.status === status;
      return mine && matchesStatus;
    })
    .sort((a, b) => {
      const order = { pending: 0, answered: 1, revision: 2, approved: 3 };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9) || new Date(b.createdAt) - new Date(a.createdAt);
    });

  return (
    <main className="page-panel">
      <div className="panel-title-row">
        <div>
          <h2>İlerleme talepleri</h2>
          <p>{visible.length} kayıt</p>
        </div>
        <div className="segmented">
          {["all", "pending", "answered", "revision", "approved"].map((item) => (
            <button key={item} className={status === item ? "active" : ""} onClick={() => setStatus(item)}>
              {item === "all" ? "Tümü" : statusLabels[item]}
            </button>
          ))}
        </div>
      </div>

      <div className="request-table">
        {visible.length === 0 && <div className="empty-state">Kriterlere uygun talep yok.</div>}
        {visible.map((request) => {
          const building = buildingsById[request.buildingId];
          const items = getRequestItems(request);
          const itemText = items
            .map((item) => {
              const work = building?.works.find((buildingWork) => buildingWork.key === item.workKey);
              return `${work?.label || item.workKey}: ${formatQuantity(item.quantity)}`;
            })
            .join(", ") || "Süper admin isteği";
          const draft = drafts[request.id] || {
            items: items.map((item) => ({
              workKey: item.workKey,
              approvedQuantity: item.approvedQuantity ?? item.quantity,
            })),
            note: request.adminNote || "",
          };
          return (
            <article className="wide-request" key={request.id}>
              <div className="wide-main">
                <span className={`status-pill ${statusTone(request.status)}`}>{statusLabels[request.status]}</span>
                <h3>
                  {building?.code} · {building?.name}
                </h3>
                <p>{request.createdByName} · {new Date(request.createdAt).toLocaleString("tr-TR")}</p>
                <p>{itemText}</p>
              </div>
              {request.photo && <img src={request.photo} alt="Talep fotoğrafı" />}
              <div className="wide-actions">
                <button className="secondary-action" onClick={() => onOpenBuilding(request.buildingId)}>
                  <Eye size={16} />
                  Aç
                </button>
                {user.role !== "admin" && request.status === "revision" && request.createdBy === user.id && (
                  <>
                    <input
                      value={answers[request.id] || ""}
                      onChange={(event) => setAnswers((previous) => ({ ...previous, [request.id]: event.target.value }))}
                      placeholder="Revize cevabı"
                    />
                    <button className="primary-action" onClick={() => onAnswerRevision(request.id, answers[request.id] || "", "")}>
                      <MessageSquare size={16} />
                      Cevapla
                    </button>
                  </>
                )}
                {user.role === "admin" && ["pending", "answered"].includes(request.status) && (
                  <>
                    <div className="approval-quantity-list compact">
                      {items.map((item) => {
                        const work = building?.works.find((buildingWork) => buildingWork.key === item.workKey);
                        const approvedItem = draft.items.find((draftItem) => draftItem.workKey === item.workKey);
                        return (
                          <label key={item.workKey}>
                            <span>{work?.label || item.workKey}</span>
                            <input
                              type="number"
                              min="0"
                              max={work?.quantity || undefined}
                              value={approvedItem?.approvedQuantity ?? item.quantity}
                              onChange={(event) =>
                                setDrafts((previous) => ({
                                  ...previous,
                                  [request.id]: {
                                    ...draft,
                                    items: draft.items.map((draftItem) =>
                                      draftItem.workKey === item.workKey
                                        ? { ...draftItem, approvedQuantity: event.target.value }
                                        : draftItem,
                                    ),
                                  },
                                }))
                              }
                            />
                          </label>
                        );
                      })}
                    </div>
                    <button className="secondary-action" onClick={() => onRevision(request.id, draft.note)}>
                      <Edit3 size={16} />
                      Revize
                    </button>
                    <button className="primary-action" onClick={() => onApprove(request.id, draft.items, draft.note)}>
                      <Check size={16} />
                      Onayla
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}

function BuildingsPanel({
  buildings,
  selectedBuildingId,
  onSelectBuilding,
  onOpenBuilding,
  onSetWorkProgress,
  onSetWorkQuantity,
  onSetWorkWeight,
  onUpdateWorkLabel,
  onAddBuildingWork,
  onDeleteBuildingWork,
  progressRanges,
  onUpdateProgressRange,
  onAddProgressRange,
  onDeleteProgressRange,
}) {
  const [query, setQuery] = useState("");
  const [newWorkLabel, setNewWorkLabel] = useState("");
  const filteredBuildings = buildings.filter((building) => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    if (!needle) return true;
    return `${building.code} ${building.name} ${building.lineColor}`.toLocaleLowerCase("tr-TR").includes(needle);
  });
  const selectedBuilding =
    buildings.find((building) => building.id === selectedBuildingId) || filteredBuildings[0] || buildings[0];

  return (
    <main className="buildings-layout">
      <aside className="building-admin-list-panel">
        <div className="panel-title-row compact">
          <div>
            <h2>Binalar</h2>
            <p>{buildings.length} bina</p>
          </div>
        </div>
        <label className="search-field">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Kod, ad veya hat ara" />
        </label>
        <div className="building-admin-list">
          {filteredBuildings.map((building) => {
            const progress = getBuildingProgress(building);
            return (
              <button
                key={building.id}
                className={`building-admin-row ${selectedBuilding?.id === building.id ? "active" : ""}`}
                onClick={() => onSelectBuilding(building.id)}
              >
                <div>
                  <strong>{building.code}</strong>
                  <span>{building.name}</span>
                </div>
                <b>{progress}%</b>
              </button>
            );
          })}
        </div>
      </aside>

      {selectedBuilding && (
        <section className="building-admin-detail">
          <div className="panel-title-row">
            <div>
              <h2>{selectedBuilding.code}</h2>
              <p>
                {selectedBuilding.name} · {selectedBuilding.lineColor}
              </p>
            </div>
            <button className="secondary-action" onClick={() => onOpenBuilding(selectedBuilding.id)}>
              <Eye size={16} />
              Popup aç
            </button>
          </div>

          <div className="building-admin-summary">
            <div>
              <span>Genel ilerleme</span>
              <strong>{getBuildingProgress(selectedBuilding)}%</strong>
            </div>
            <div>
              <span>İş kalemi</span>
              <strong>{selectedBuilding.works.length}</strong>
            </div>
            <div>
              <span>Toplam adet</span>
              <strong>{selectedBuilding.works.reduce((sum, work) => sum + Number(work.quantity || 0), 0)}</strong>
            </div>
          </div>

          <div className="range-editor building-range-editor">
            <div className="section-heading flat">
              <div>
                <span>Harita renkleri</span>
                <strong>{progressRanges?.length || 0} dilim</strong>
              </div>
              <button className="icon-button" title="Dilim ekle" onClick={onAddProgressRange}>
                <Plus size={16} />
              </button>
            </div>
            {(progressRanges || defaultProgressRanges).map((range) => (
              <div className="range-editor-row" key={range.id}>
                <input
                  aria-label="Minimum yüzde"
                  type="number"
                  min="0"
                  max="100"
                  value={range.min}
                  onChange={(event) => onUpdateProgressRange(range.id, { min: event.target.value })}
                />
                <input
                  aria-label="Maksimum yüzde"
                  type="number"
                  min="0"
                  max="100"
                  value={range.max}
                  onChange={(event) => onUpdateProgressRange(range.id, { max: event.target.value })}
                />
                <input
                  aria-label="RGB renk"
                  type="color"
                  value={range.color}
                  onChange={(event) => onUpdateProgressRange(range.id, { color: event.target.value })}
                />
                <button className="icon-button" title="Dilim sil" onClick={() => onDeleteProgressRange(range.id)}>
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>

          <form
            className="add-work-form"
            onSubmit={(event) => {
              event.preventDefault();
              onAddBuildingWork(selectedBuilding.id, newWorkLabel);
              setNewWorkLabel("");
            }}
          >
            <input value={newWorkLabel} onChange={(event) => setNewWorkLabel(event.target.value)} placeholder="Ek iş kalemi adı" />
            <button className="secondary-action" type="submit">
              <Plus size={16} />
              Ekle
            </button>
          </form>

          <div className="building-admin-work-list">
            {selectedBuilding.works.map((work) => {
              const value = Number(selectedBuilding.progress?.[work.key] || 0);
              return (
                <article className="building-admin-work-row" key={work.key}>
                  <div>
                    <input
                      className="inline-text-input"
                      value={work.label}
                      onChange={(event) => onUpdateWorkLabel(selectedBuilding.id, work.key, event.target.value)}
                    />
                    <span>
                      Ağırlık {work.weight ?? 0}% · {work.quantity || 0} toplam
                    </span>
                  </div>
                  <label>
                    Toplam
                    <input
                      type="number"
                      min="0"
                      value={work.quantity}
                      onChange={(event) => onSetWorkQuantity(selectedBuilding.id, work.key, event.target.value)}
                    />
                  </label>
                  <label>
                    Ağırlık
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={work.weight ?? 0}
                      onChange={(event) => onSetWorkWeight(selectedBuilding.id, work.key, event.target.value)}
                    />
                  </label>
                  <label>
                    Yüzde
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={value}
                      onChange={(event) => onSetWorkProgress(selectedBuilding.id, work.key, event.target.value)}
                    />
                  </label>
                  <b>{value}%</b>
                  <button
                    className="icon-button danger"
                    title="İşi sil"
                    type="button"
                    onClick={() => onDeleteBuildingWork(selectedBuilding.id, work.key)}
                  >
                    <Trash2 size={16} />
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

function LogsPanel({ logs }) {
  return (
    <main className="page-panel">
      <div className="panel-title-row">
        <div>
          <h2>Log kayıtları</h2>
          <p>{logs.length} işlem</p>
        </div>
      </div>
      <div className="log-list">
        {logs.length === 0 && <div className="empty-state">Henüz kayıt yok.</div>}
        {logs.map((log) => (
          <article className="log-row" key={log.id}>
            <div>
              <strong>{log.action}</strong>
              <span>{log.detail}</span>
            </div>
            <div>
              <b>{log.actor}</b>
              <time>{new Date(log.at).toLocaleString("tr-TR")}</time>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}

function UsersPanel({
  users,
  buildings,
  workItems,
  onUpdateUser,
  onTogglePermission,
  onToggleWorkPermission,
  onBulkPermissions,
  onBulkWorkPermissions,
  onAddUser,
  onDeleteUser,
}) {
  const [selectedUserId, setSelectedUserId] = useState(users.find((user) => user.role !== "admin")?.id || users[0]?.id);
  const [query, setQuery] = useState("");
  const [newUser, setNewUser] = useState(initialNewUser);

  const selectedUser = users.find((user) => user.id === selectedUserId) || users[0];
  const filteredBuildings = buildings.filter((building) => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    if (!needle) return true;
    return `${building.code} ${building.name} ${building.lineColor}`.toLocaleLowerCase("tr-TR").includes(needle);
  });
  const selectedWorkPermissions = getUserWorkPermissions(selectedUser, workItems);

  function submitNewUser(event) {
    event.preventDefault();
    if (!newUser.name || !newUser.username || !newUser.password) return;
    onAddUser(newUser);
    setNewUser(initialNewUser);
  }

  return (
    <main className="users-layout">
      <aside className="user-list-panel">
        <div className="panel-title-row compact">
          <div>
            <h2>Kullanıcılar</h2>
            <p>{users.length} hesap</p>
          </div>
        </div>
        {users.map((user) => (
          <button
            key={user.id}
            className={`user-row ${selectedUser?.id === user.id ? "active" : ""}`}
            onClick={() => setSelectedUserId(user.id)}
          >
            <CircleUserRound size={18} />
            <div>
              <strong>{user.name}</strong>
              <span>{user.username}</span>
            </div>
            <ChevronRight size={16} />
          </button>
        ))}

        <form className="new-user-form" onSubmit={submitNewUser}>
          <strong>Yeni kullanıcı</strong>
          <input
            placeholder="Ad soyad"
            value={newUser.name}
            onChange={(event) => setNewUser((previous) => ({ ...previous, name: event.target.value }))}
          />
          <input
            placeholder="Kullanıcı adı"
            value={newUser.username}
            onChange={(event) => setNewUser((previous) => ({ ...previous, username: event.target.value }))}
          />
          <input
            placeholder="Şifre"
            value={newUser.password}
            onChange={(event) => setNewUser((previous) => ({ ...previous, password: event.target.value }))}
          />
          <select
            value={newUser.role}
            onChange={(event) => setNewUser((previous) => ({ ...previous, role: event.target.value }))}
          >
            <option value="foreman">Formen</option>
            <option value="admin">Süper Admin</option>
          </select>
          <button className="primary-action" type="submit">
            <Plus size={16} />
            Ekle
          </button>
        </form>
      </aside>

      {selectedUser && (
        <section className="permission-panel">
          <div className="panel-title-row">
            <div>
              <h2>{selectedUser.name}</h2>
              <p>{selectedUser.permissions.length} bina izni</p>
            </div>
            <div className="role-edit">
              <select value={selectedUser.role} onChange={(event) => onUpdateUser(selectedUser.id, { role: event.target.value })}>
                <option value="foreman">Formen</option>
                <option value="admin">Süper Admin</option>
              </select>
              <button className="icon-button danger" title="Kullanıcıyı sil" onClick={() => onDeleteUser(selectedUser.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <div className="edit-grid">
            <label>
              Ad
              <input value={selectedUser.name} onChange={(event) => onUpdateUser(selectedUser.id, { name: event.target.value })} />
            </label>
            <label>
              Kullanıcı adı
              <input
                value={selectedUser.username}
                onChange={(event) => onUpdateUser(selectedUser.id, { username: event.target.value })}
              />
            </label>
            <label>
              Şifre
              <input
                value={selectedUser.password}
                onChange={(event) => onUpdateUser(selectedUser.id, { password: event.target.value })}
              />
            </label>
          </div>

          {selectedUser.role !== "admin" && (
            <>
              <div className="work-permission-panel">
                <div className="section-heading flat">
                  <div>
                    <span>İş kalemi izinleri</span>
                    <strong>{selectedWorkPermissions.length} iş</strong>
                  </div>
                  <div className="permission-actions">
                    <button onClick={() => onBulkWorkPermissions(selectedUser.id, "all")}>Tümü</button>
                    <button onClick={() => onBulkWorkPermissions(selectedUser.id, "clear")}>Temizle</button>
                  </div>
                </div>
                <div className="work-permission-grid">
                  {workItems.map((work) => {
                    const checked = selectedWorkPermissions.includes(work.key);
                    return (
                      <label className={checked ? "checked" : ""} key={work.key}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleWorkPermission(selectedUser.id, work.key)}
                        />
                        <span>{work.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="permission-toolbar">
                <label className="search-field">
                  <Search size={17} />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Bina izni ara" />
                </label>
                <div className="permission-actions">
                  <button onClick={() => onBulkPermissions(selectedUser.id, "all")}>Tümü</button>
                  <button onClick={() => onBulkPermissions(selectedUser.id, ["KIRMIZI"])}>Kırmızı</button>
                  <button onClick={() => onBulkPermissions(selectedUser.id, ["TURKUAZ"])}>Turkuaz</button>
                  <button onClick={() => onBulkPermissions(selectedUser.id, ["MOR", "MAGENTA", "MAVİ"])}>Mor</button>
                  <button onClick={() => onBulkPermissions(selectedUser.id, "clear")}>Temizle</button>
                </div>
              </div>

              <div className="permission-grid">
                {filteredBuildings.map((building) => {
                  const checked = selectedUser.permissions.includes(building.id);
                  return (
                    <label className={checked ? "checked" : ""} key={building.id}>
                      <input type="checkbox" checked={checked} onChange={() => onTogglePermission(selectedUser.id, building.id)} />
                      <span>
                        <strong>{building.code}</strong>
                        {building.name}
                      </span>
                      <em>{building.lineColor}</em>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}

export default App;
