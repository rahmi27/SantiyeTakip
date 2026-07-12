import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Camera,
  Check,
  ChevronDown,
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
  Moon,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  UserCog,
  X,
} from "lucide-react";
import seedData from "./data/siteData.json";

const SiteMapPanel = React.lazy(() => import("./components/SiteMapPanel.jsx"));

const APP_TITLE = "5. Zırhlı Tugayı Mekanik İşleri Proje Takibi";
const STORAGE_KEY = "tugay-santiye-state-v14";
const SESSION_KEY = "tugay-santiye-current-user";
const SESSION_START_KEY = "tugay-santiye-session-start";
const THEME_KEY = "tugay-santiye-theme";

const FOREMAN_HIDDEN_WORK_KEYS = [];

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Yerel kayıt yazılamadı: ${key}`, error);
  }
}

function removeStorage(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Tarayıcı depolama erişimi kapalıysa sessiz geç.
  }
}

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

const initialNewWork = {
  label: "",
  quantity: "100",
  weight: "",
  category: "sihhi_tesisat",
  sourceWorkKey: "",
};

const buildingLineOptions = [
  { value: "KIRMIZI", label: "Kırmızı Hat" },
  { value: "TURKUAZ", label: "Turkuaz Hat" },
  { value: "MAVİ", label: "Mavi Hat" },
  { value: "MOR", label: "Mor Hat" },
  { value: "MAGENTA", label: "Magenta Hat" },
];

const defaultWorkCategoryMeta = {
  sihhi_tesisat: { label: "Sıhhi Tesisat", order: 1 },
  karot: { label: "Karot", order: 2 },
  vrf: { label: "VRF", order: 3 },
  pis_su_pompasi: { label: "Pis Su Pompası", order: 4 },
  isitma_tesisati: { label: "Isıtma Tesisatı", order: 5 },
  yangin_tesisati: { label: "Yangın Tesisatı", order: 6 },
  ara_istasyon: { label: "Ara İstasyon", order: 7 },
  sihhi: { label: "Sıhhi", order: 1 },
  isitma: { label: "Isıtma", order: 2 },
  yangin: { label: "Yangın", order: 3 },
};

const workCategoryByKey = {
  grup_sayisi: "sihhi",
  dalgic_pompa: "sihhi",
  yag_tutucu: "sihhi",
  vrf_drenaj: "sihhi",
  ara_istasyon: "sihhi",
  karot_deligi: "sihhi",
  petek: "isitma",
  kollektor: "isitma",
  sprink: "yangin",
  yangin_dolabi: "yangin",
  i_b_a: "yangin",
};

function getWorkCategoryMeta(customCategories) {
  const categories = {
    ...defaultWorkCategoryMeta,
  };
  Object.entries(customCategories || {}).forEach(([key, meta]) => {
    if (meta?.deleted) delete categories[key];
    else categories[key] = meta;
  });
  return categories;
}

function makeCategoryKey(value) {
  const clean = String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return clean ? `custom_${clean}` : "";
}

const defaultThemeSettings = {
  light: {
    panel: "#dbe7f5",
    panelStrong: "#eef4fb",
    panelSoft: "#cbdcf0",
    line: "#8fa8c4",
    ink: "#10243f",
    textSoft: "#52677f",
    accent: "#2563eb",
    accentStrong: "#123b74",
    pageBg: "#b8cbe1",
  },
  dark: {
    panel: "#0b1220",
    panelStrong: "#111827",
    panelSoft: "#0f1b2d",
    line: "#26364f",
    ink: "#edf5ff",
    textSoft: "#9fb0c6",
    accent: "#4f8df7",
    accentStrong: "#8bb8ff",
    pageBg: "#050914",
  },
};

const defaultProgressRanges = [
  { id: "range-0-20", min: 0, max: 20, color: "#ff4040", label: "0-20" },
  { id: "range-20-40", min: 20, max: 40, color: "#ffac5a", label: "20-40" },
  { id: "range-40-60", min: 40, max: 60, color: "#ffff3b", label: "40-60" },
  { id: "range-60-80", min: 60, max: 80, color: "#91ff8f", label: "60-80" },
  { id: "range-80-100", min: 80, max: 100, color: "#00f75c", label: "80-100" },
];

const legacyProgressRangeColors = ["#d93636", "#e0b428", "#1f9d63"];

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

function safeColor(value, fallback = "#ef4444") {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : fallback;
}

function hexToRgb(color) {
  const safe = safeColor(color);
  return {
    r: parseInt(safe.slice(1, 3), 16) / 255,
    g: parseInt(safe.slice(3, 5), 16) / 255,
    b: parseInt(safe.slice(5, 7), 16) / 255,
  };
}

function colorChannelToLinear(value) {
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function colorLuminance(color) {
  const { r, g, b } = hexToRgb(color);
  return 0.2126 * colorChannelToLinear(r) + 0.7152 * colorChannelToLinear(g) + 0.0722 * colorChannelToLinear(b);
}

function contrastRatio(first, second) {
  const a = colorLuminance(first);
  const b = colorLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function isUsableThemePalette(palette, mode) {
  const textOnPanel = contrastRatio(palette.ink, palette.panel);
  const textOnStrongPanel = contrastRatio(palette.ink, palette.panelStrong);
  const softTextOnPanel = contrastRatio(palette.textSoft, palette.panel);
  const topbarBase = mode === "light" ? palette.accentStrong : "#020817";
  const topbarText = contrastRatio("#ffffff", topbarBase);
  return textOnPanel >= 4.2 && textOnStrongPanel >= 4.2 && softTextOnPanel >= 2.2 && topbarText >= 3;
}

function sanitizeProgressRanges(ranges) {
  const source = ranges?.length ? ranges : defaultProgressRanges;
  const isLegacyDefault =
    source.length === 3 &&
    source.every((range, index) => {
      const currentDefault = defaultProgressRanges[index];
      return (
        range.id === currentDefault.id &&
        Number(range.min) === currentDefault.min &&
        Number(range.max) === currentDefault.max &&
        String(range.color).toLowerCase() === legacyProgressRangeColors[index]
      );
    });
  if (isLegacyDefault) return JSON.parse(JSON.stringify(defaultProgressRanges));
  const cleaned = source
    .map((range, index) => {
      const min = clampPercent(range.min);
      const max = clampPercent(range.max);
      return {
        id: range.id || `range-${index}`,
        min: Math.min(min, max),
        max: Math.max(min, max),
        color: safeColor(range.color, defaultProgressRanges[index % defaultProgressRanges.length].color),
        label: `${Math.min(min, max)}-${Math.max(min, max)}`,
      };
    })
    .sort((a, b) => a.min - b.min || a.max - b.max);
  return cleaned.length ? cleaned : JSON.parse(JSON.stringify(defaultProgressRanges));
}

function makeThemeStyle(themeSettings, mode) {
  const palette = sanitizeThemeSettings(themeSettings)[mode] || defaultThemeSettings.light;
  return {
    "--panel": palette.panel,
    "--panel-strong": palette.panelStrong,
    "--panel-soft": palette.panelSoft,
    "--line": palette.line,
    "--ink": palette.ink,
    "--text-soft": palette.textSoft,
    "--accent": palette.accent,
    "--accent-strong": palette.accentStrong,
    "--page-bg": palette.pageBg,
    background: palette.pageBg,
  };
}

function isSessionLog(log) {
  return ["Giriş yapıldı", "Çıkış yapıldı"].includes(log?.action);
}

function getHistoryLabel(previous, draft) {
  const latest = draft.logs?.[0];
  const previousLatestId = previous.logs?.[0]?.id;
  if (!latest || latest.id === previousLatestId || isSessionLog(latest)) return "";
  return [latest.action, latest.detail].filter(Boolean).join(" · ");
}

function copySeed() {
  return normalizeState({ ...seedData, progressRanges: seedData.progressRanges || defaultProgressRanges });
}

function sanitizeBuildingCoordinates(coordinates, map) {
  if (!Array.isArray(coordinates)) return [];
  const points = coordinates
    .map((point) => [Number(point?.[0]), Number(point?.[1])])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
    .map(([x, y]) => [
      Number(Math.min(map.width, Math.max(0, x)).toFixed(2)),
      Number(Math.min(map.height, Math.max(0, y)).toFixed(2)),
    ]);
  return points.length >= 3 ? points : [];
}

function sanitizeThemeSettings(settings) {
  const source = settings || {};
  return Object.fromEntries(
    Object.entries(defaultThemeSettings).map(([mode, defaults]) => {
      const palette = Object.fromEntries(
        Object.entries(defaults).map(([key, value]) => [key, safeColor(source[mode]?.[key], value)]),
      );
      return [mode, isUsableThemePalette(palette, mode) ? palette : { ...defaults }];
    }),
  );
}

function normalizeState(raw) {
  const draft = JSON.parse(JSON.stringify(raw));
  draft.map = {
    ...(draft.map || {}),
    image: seedData.map.image,
    width: seedData.map.width,
    height: seedData.map.height,
  };
  draft.progressRanges = sanitizeProgressRanges(draft.progressRanges || defaultProgressRanges);
  draft.themeSettings = sanitizeThemeSettings(draft.themeSettings);
  draft.workCategories = draft.workCategories || {};
  const categoryMeta = getWorkCategoryMeta(draft.workCategories);
  draft.logs = (draft.logs || []).filter(isSessionLog);
  draft.workItems = (draft.workItems || []).map((work) => ({
    ...work,
    label: cleanText(work.label),
    category: getSafeWorkCategory(work.category, categoryMeta),
    weight: clampPercent(work.weight),
    unit: work.unit || "percent",
  }));
  draft.buildings = (draft.buildings || []).map((building) => {
    const count = Math.max(1, building.works?.length || 1);
    const works = (building.works || []).map((work) => ({
      ...work,
      label: cleanText(work.label),
      category: getSafeWorkCategory(getWorkCategory(work), categoryMeta),
      quantity: clampQuantity(work.quantity),
      weight: clampPercent(work.weight ?? Math.round(100 / count)),
      unit: work.unit || "percent",
    }));
    return {
      ...building,
      name: cleanText(building.name),
      lineColor: cleanText(building.lineColor),
      coordinates: sanitizeBuildingCoordinates(building.coordinates, draft.map),
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
  delete draft.regions;
  return draft;
}

function mergeSeedBuildings(savedBuildings = []) {
  const savedById = new Map(savedBuildings.map((building) => [building.id, building]));
  return seedData.buildings.map((seedBuilding) => {
    const saved = savedById.get(seedBuilding.id);
    if (!saved) return seedBuilding;
    const workKeys = seedBuilding.works.map((work) => work.key);
    return {
      ...seedBuilding,
      progress: Object.fromEntries(
        workKeys.map((key) => [key, clampPercent(saved.progress?.[key] ?? seedBuilding.progress?.[key] ?? 0)]),
      ),
      files: saved.files || [],
      coordinates: sanitizeBuildingCoordinates(saved.coordinates, seedData.map),
    };
  });
}

function loadInitialState() {
  const saved = readStorage(STORAGE_KEY);
  if (!saved) return copySeed();
  try {
    const seed = copySeed();
    const parsed = JSON.parse(saved);
    const allWorkKeys = seed.workItems.map((work) => work.key);
    const seedBuildingIds = new Set(seed.buildings.map((building) => building.id));
    const users = (parsed.users?.length ? parsed.users : seed.users).map((user) => ({
      ...user,
      workPermissions: user.role === "admin" ? allWorkKeys : user.workPermissions || [],
    }));
    return normalizeState({
      ...seed,
      ...parsed,
      buildings: mergeSeedBuildings(parsed.buildings || []),
      workItems: seedData.workItems,
      users,
      requests: (parsed.requests || []).filter((request) => seedBuildingIds.has(request.buildingId)),
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
  return getWorksProgress(building, building.works);
}

function getWorksProgress(building, works) {
  if (!building || !works?.length) return 0;
  const fallbackWeight = 100 / works.length;
  const totalWeight = works.reduce((sum, work) => sum + Number(work.weight || fallbackWeight), 0);
  const total = works.reduce((sum, work) => {
    const weight = Number(work.weight || fallbackWeight);
    return sum + Number(building.progress?.[work.key] || 0) * (weight / Math.max(1, totalWeight));
  }, 0);
  return clampPercent(total);
}

function getScopedBuildingWorks(user, building) {
  if (!user || !building?.works) return [];
  if (user.role === "admin") return building.works;
  const allowedWorkKeys = getUserWorkPermissions(user, building.works);
  return building.works.filter((work) => allowedWorkKeys.includes(work.key) && !isForemanHiddenWork(work));
}

function getScopedBuildingProgress(user, building) {
  return getWorksProgress(building, getScopedBuildingWorks(user, building));
}

function getProgressColor(progress, ranges) {
  return getProgressRange(progress, ranges)?.color || defaultProgressRanges[0].color;
}

function canAccess(user, buildingId) {
  if (!user) return false;
  return user.role === "admin" || user.permissions.includes(buildingId);
}

function statusTone(status) {
  if (status === "approved") return "good";
  if (status === "answered") return "mid";
  if (status === "revision") return "warn";
  return "info";
}

function canForemanAnswerRequest(user, request) {
  if (!user || user.role === "admin" || !request) return false;
  const ownRevision = request.status === "revision" && request.createdBy === user.id;
  const adminTask = request.adminTask && ["pending", "revision"].includes(request.status) && canAccess(user, request.buildingId);
  return ownRevision || adminTask;
}

function canEditRequestNote(user, request) {
  if (!user || !request) return false;
  if (user.role === "admin") return true;
  return request.createdBy === user.id && request.status !== "approved";
}

function formatQuantity(value) {
  if (!value) return "0";
  return Math.round(Number(value)).toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

function clampQuantity(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return 0;
  return Math.max(0, Math.round(number));
}

function getWorkCompletedQuantity(building, work) {
  if (!building || !work || Number(work.quantity) <= 0) return 0;
  return Math.min(Number(work.quantity), (Number(building.progress?.[work.key] || 0) / 100) * Number(work.quantity));
}

function getWorkRemainingQuantity(building, work) {
  return Math.max(0, Math.round(Number(work?.quantity || 0) - getWorkCompletedQuantity(building, work)));
}

function getWorkReservedQuantity(requests, buildingId, workKey, excludeRequestId = "") {
  const reservedStatuses = new Set(["pending", "revision", "answered"]);
  return requests
    .filter((request) => request.id !== excludeRequestId && request.buildingId === buildingId && reservedStatuses.has(request.status))
    .reduce((sum, request) => {
      return (
        sum +
        getRequestItems(request).reduce((itemSum, item) => {
          return item.workKey === workKey ? itemSum + Number(item.quantity || 0) : itemSum;
        }, 0)
      );
    }, 0);
}

function getWorkAvailableQuantity(building, work, requests, excludeRequestId = "") {
  return Math.max(0, getWorkRemainingQuantity(building, work) - getWorkReservedQuantity(requests, building.id, work.key, excludeRequestId));
}

function clampWorkRequestQuantity(building, work, value) {
  return Math.min(clampQuantity(value), getWorkRemainingQuantity(building, work));
}

function clampWorkAvailableRequestQuantity(building, work, requests, value, excludeRequestId = "") {
  return Math.min(clampQuantity(value), getWorkAvailableQuantity(building, work, requests, excludeRequestId));
}

function isForemanHiddenWork(work) {
  return FOREMAN_HIDDEN_WORK_KEYS.includes(work?.key);
}

function getWorkCategory(work) {
  return work?.category || workCategoryByKey[work?.key] || "sihhi_tesisat";
}

function getSafeWorkCategory(category, categoryMeta = defaultWorkCategoryMeta) {
  if (categoryMeta[category]) return category;
  return Object.keys(categoryMeta).find((key) => !["sihhi", "isitma", "yangin"].includes(key)) || Object.keys(categoryMeta)[0] || "sihhi_tesisat";
}

function WorkCategorySelect({ value, onChange, categoryMeta = defaultWorkCategoryMeta }) {
  const legacyCategories = new Set(["sihhi", "isitma", "yangin"]);
  const selectedValue = getSafeWorkCategory(value, categoryMeta);
  return (
    <select value={selectedValue} onChange={(event) => onChange(event.target.value)} aria-label="İş kategorisi">
      {Object.entries(categoryMeta)
        .filter(([key]) => !legacyCategories.has(key))
        .sort((a, b) => a[1].order - b[1].order)
        .map(([key, meta]) => (
          <option key={key} value={key}>
            {meta.label}
          </option>
        ))}
    </select>
  );
}

function ReadyWorkSelect({ workItems, value, onChange }) {
  const readyItems = (workItems || []).filter((work) => !isForemanHiddenWork(work));
  return (
    <select
      className="ready-work-select"
      value={value || ""}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Hazır iş kalemi"
    >
      <option value="">Hazır iş seç</option>
      {readyItems.map((work) => (
        <option key={work.key} value={work.key}>
          {work.label}
        </option>
      ))}
    </select>
  );
}

function LineSelect({ value, onChange }) {
  const normalizedValue = buildingLineOptions.some((option) => option.value === value) ? value : buildingLineOptions[0].value;
  const options = buildingLineOptions;

  return (
    <select value={normalizedValue} onChange={(event) => onChange(event.target.value)} aria-label="Hat seçimi">
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function makeNewWorkFromReady(previous, workItems, workKey) {
  const ready = (workItems || []).find((work) => work.key === workKey);
  if (!ready) return { ...previous, sourceWorkKey: "" };
  return {
    ...previous,
    sourceWorkKey: workKey,
    label: ready.label,
    category: getWorkCategory(ready),
    weight: ready.weight ?? previous.weight,
  };
}

function groupWorksByCategory(works, categoryMeta = defaultWorkCategoryMeta) {
  return Object.entries(
    works.reduce((groups, work) => {
      const category = getWorkCategory(work);
      groups[category] = groups[category] || [];
      groups[category].push(work);
      return groups;
    }, {}),
  )
    .map(([key, items]) => ({
      key,
      label: categoryMeta[key]?.label || key,
      order: categoryMeta[key]?.order || 99,
      items,
    }))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "tr"));
}

function getCategoryProgressItems(building, works, categoryMeta = defaultWorkCategoryMeta) {
  return groupWorksByCategory(works, categoryMeta).map((category) => ({
    ...category,
    progress: getWorksProgress(building, category.items),
    weight: category.items.reduce((sum, work) => sum + Number(work.weight || 0), 0),
  }));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("Dosya okunamadı."));
    reader.readAsDataURL(file);
  });
}

async function prepareImageAttachment(file) {
  if (!file.type.startsWith("image/")) return readFileAsDataUrl(file);
  const source = await readFileAsDataUrl(file);
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Fotoğraf işlenemedi."));
    img.src = source;
  });
  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

function confirmAction(message) {
  return window.confirm(message);
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
  const sorted = sanitizeProgressRanges(ranges);
  const value = clampPercent(progress);
  return (
    sorted.find((range, index) => {
      const isLast = index === sorted.length - 1;
      return value >= Number(range.min) && (isLast ? value <= Number(range.max) : value < Number(range.max));
    }) || sorted[sorted.length - 1]
  );
}

function App() {
  const [state, setState] = useState(loadInitialState);
  const [currentUserId, setCurrentUserId] = useState(() => readStorage(SESSION_KEY));
  const [activeTab, setActiveTab] = useState("map");
  const [selectedBuildingId, setSelectedBuildingId] = useState(null);
  const [buildingPanelSelectedId, setBuildingPanelSelectedId] = useState(null);
  const [openBuildingId, setOpenBuildingId] = useState(null);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState(() => readStorage(THEME_KEY) || "light");
  const undoHistoryRef = useRef([]);
  const redoHistoryRef = useRef([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const [historyStatus, setHistoryStatus] = useState("Henüz değişiklik yok");

  useEffect(() => {
    writeStorage(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (currentUserId) writeStorage(SESSION_KEY, currentUserId);
    else removeStorage(SESSION_KEY);
  }, [currentUserId]);

  useEffect(() => {
    writeStorage(THEME_KEY, theme);
  }, [theme]);

  const currentUser = state.users.find((user) => user.id === currentUserId);

  useEffect(() => {
    if (currentUserId && !currentUser) {
      setCurrentUserId(null);
    }
  }, [currentUser, currentUserId]);

  const buildingsById = useMemo(() => {
    return Object.fromEntries(state.buildings.map((building) => [building.id, building]));
  }, [state.buildings]);

  const selectedBuilding = buildingsById[selectedBuildingId];
  const openBuilding = buildingsById[openBuildingId];

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
      const historyLabel = getHistoryLabel(previous, draft);
      draft.logs = (draft.logs || []).filter(isSessionLog);
      if (currentUser?.role === "admin" && historyLabel) {
        undoHistoryRef.current = [
          ...undoHistoryRef.current.slice(-19),
          {
            id: `HIST-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            label: historyLabel,
            at: new Date().toISOString(),
            before: previous,
            after: draft,
          },
        ];
        redoHistoryRef.current = [];
        setUndoCount(undoHistoryRef.current.length);
        setRedoCount(0);
        setHistoryStatus(historyLabel);
      }
      return draft;
    });
  }

  function undoAdminActions(count = 1) {
    if (currentUser?.role !== "admin" || undoHistoryRef.current.length === 0) return;
    const stepCount = Math.min(Math.max(1, count), undoHistoryRef.current.length);
    const undone = undoHistoryRef.current.slice(-stepCount);
    const target = undone[0].before;
    undoHistoryRef.current = undoHistoryRef.current.slice(0, -stepCount);
    redoHistoryRef.current = [...undone, ...redoHistoryRef.current].slice(0, 20);
    setUndoCount(undoHistoryRef.current.length);
    setRedoCount(redoHistoryRef.current.length);
    setHistoryStatus(
      stepCount === 1 ? `Geri alındı: ${undone[0].label}` : `${stepCount} işlem geri alındı: ${undone[0].label}`,
    );
    setState(target);
  }

  function redoAdminActions(count = 1) {
    if (currentUser?.role !== "admin" || redoHistoryRef.current.length === 0) return;
    const stepCount = Math.min(Math.max(1, count), redoHistoryRef.current.length);
    const redone = redoHistoryRef.current.slice(0, stepCount);
    const target = redone[redone.length - 1].after;
    redoHistoryRef.current = redoHistoryRef.current.slice(stepCount);
    undoHistoryRef.current = [...undoHistoryRef.current, ...redone].slice(-20);
    setUndoCount(undoHistoryRef.current.length);
    setRedoCount(redoHistoryRef.current.length);
    setHistoryStatus(
      stepCount === 1 ? `İleri alındı: ${redone[0].label}` : `${stepCount} işlem ileri alındı: ${redone[0].label}`,
    );
    setState(target);
  }

  function login(userId) {
    setCurrentUserId(userId);
    const startedAt = new Date().toISOString();
    writeStorage(SESSION_START_KEY, startedAt);
    const user = state.users.find((item) => item.id === userId);
    updateState((draft) => {
      draft.logs.unshift(makeLog(user, "Giriş yapıldı", startedAt));
    });
    setActiveTab("map");
    const firstBuilding = state.buildings.find((building) => canAccess(user, building.id));
    setSelectedBuildingId(firstBuilding?.id || null);
  }

  function handleLogout() {
    const user = currentUser;
    const startedAt = readStorage(SESSION_START_KEY);
    const startedMs = startedAt ? new Date(startedAt).getTime() : Date.now();
    const minutes = Math.max(0, Math.round((Date.now() - startedMs) / 60000));
    updateState((draft) => {
      draft.logs.unshift(makeLog(user, "Çıkış yapıldı", `${minutes} dakika kaldı`));
    });
    removeStorage(SESSION_START_KEY);
    setCurrentUserId(null);
    setSelectedBuildingId(null);
    setBuildingPanelSelectedId(null);
    setOpenBuildingId(null);
  }

  function resetDemoData() {
    const fresh = copySeed();
    undoHistoryRef.current = [];
    redoHistoryRef.current = [];
    setUndoCount(0);
    setRedoCount(0);
    setHistoryStatus("Veri sıfırlandı");
    setState(fresh);
    const user = fresh.users.find((item) => item.role === "admin");
    setCurrentUserId(user?.id || null);
    setSelectedBuildingId(null);
    setBuildingPanelSelectedId(null);
    setOpenBuildingId(null);
    setActiveTab("map");
  }

  function setWorkProgress(buildingId, workKey, value) {
    updateState((draft) => {
      const building = draft.buildings.find((item) => item.id === buildingId);
      if (!building) return;
      const work = building.works.find((item) => item.key === workKey);
      const previousWorkProgress = clampPercent(building.progress?.[workKey] || 0);
      const previousBuildingProgress = getBuildingProgress(building);
      const nextWorkProgress = clampPercent(value);
      building.progress = building.progress || {};
      building.progress[workKey] = nextWorkProgress;
      building.updatedAt = new Date().toISOString();
      const nextBuildingProgress = getBuildingProgress(building);
      draft.logs.unshift(
        makeLog(
          currentUser,
          "Bina iş yüzdesi değişti",
          `${building.code} · ${work?.label || workKey}: iş %${previousWorkProgress} → %${nextWorkProgress}, bina genel %${previousBuildingProgress} → %${nextBuildingProgress}`,
        ),
      );
    });
  }

  function setWorkQuantity(buildingId, workKey, value) {
    updateState((draft) => {
      const building = draft.buildings.find((item) => item.id === buildingId);
      const work = building?.works.find((item) => item.key === workKey);
      if (!work) return;
      const previousQuantity = clampQuantity(work.quantity);
      const nextQuantity = clampQuantity(value);
      work.quantity = nextQuantity;
      building.updatedAt = new Date().toISOString();
      draft.logs.unshift(
        makeLog(currentUser, "Talep limiti değişti", `${building.code} · ${work.label}: %${formatQuantity(previousQuantity)} → %${formatQuantity(nextQuantity)}`),
      );
    });
  }

  function setWorkWeight(buildingId, workKey, value) {
    updateState((draft) => {
      const building = draft.buildings.find((item) => item.id === buildingId);
      const work = building?.works.find((item) => item.key === workKey);
      if (!work) return;
      const previousWeight = clampPercent(work.weight);
      const nextWeight = clampPercent(value);
      work.weight = nextWeight;
      building.updatedAt = new Date().toISOString();
      draft.logs.unshift(makeLog(currentUser, "Hakediş payı değişti", `${building.code} · ${work.label}: %${previousWeight} → %${nextWeight}`));
    });
  }

  function updateWorkLabel(buildingId, workKey, label) {
    updateState((draft) => {
      const building = draft.buildings.find((item) => item.id === buildingId);
      const work = building?.works.find((item) => item.key === workKey);
      if (!work) return;
      const previousLabel = work.label;
      work.label = label;
      building.updatedAt = new Date().toISOString();
      const globalWork = draft.workItems.find((item) => item.key === workKey);
      if (globalWork) globalWork.label = label;
      draft.logs.unshift(makeLog(currentUser, "İş kalemi adı değişti", `${building.code} · ${previousLabel} → ${label}`));
    });
  }

  function addBuildingWork(buildingId, workInput) {
    const payload = typeof workInput === "string" ? { ...initialNewWork, label: workInput } : workInput;
    const cleanLabel = String(payload?.label || "").trim();
    if (!cleanLabel) return;
    updateState((draft) => {
      const building = draft.buildings.find((item) => item.id === buildingId);
      if (!building) return;
      const keyBase = cleanLabel
        .toLocaleLowerCase("tr-TR")
        .replace(/[^a-z0-9ığüşöç]+/gi, "_")
        .replace(/^_+|_+$/g, "");
      const key = `${keyBase || "ek_is"}_${Date.now()}`;
      building.works.push({
        key,
        label: cleanLabel,
        quantity: clampQuantity(payload?.quantity),
        weight: clampPercent(payload?.weight),
        category: getSafeWorkCategory(payload?.category, getWorkCategoryMeta(draft.workCategories)),
        unit: "percent",
      });
      building.progress = building.progress || {};
      building.progress[key] = 0;
      building.updatedAt = new Date().toISOString();
      draft.workItems.push({
        key,
        label: cleanLabel,
        category: getSafeWorkCategory(payload?.category, getWorkCategoryMeta(draft.workCategories)),
        weight: clampPercent(payload?.weight),
        unit: "percent",
      });
      draft.logs.unshift(makeLog(currentUser, "Ek iş kalemi eklendi", `${building.code} / ${cleanLabel}`));
    });
  }

  function addGlobalWorkItem(workInput) {
    const payload = typeof workInput === "string" ? { ...initialNewWork, label: workInput } : workInput;
    const cleanLabel = String(payload?.label || "").trim();
    if (!cleanLabel) return;
    updateState((draft) => {
      const keyBase = cleanLabel
        .toLocaleLowerCase("tr-TR")
        .replace(/[^a-z0-9ğıüşöç]+/gi, "_")
        .replace(/^_+|_+$/g, "");
      const key = `${keyBase || "hazir_is"}_${Date.now()}`;
      draft.workItems.push({
        key,
        label: cleanLabel,
        category: getSafeWorkCategory(payload?.category, getWorkCategoryMeta(draft.workCategories)),
        weight: clampPercent(payload?.weight),
        unit: "percent",
      });
      draft.users.forEach((user) => {
        if (user.role === "admin") user.workPermissions = [...(user.workPermissions || []), key];
      });
      draft.logs.unshift(makeLog(currentUser, "Hazır iş kalemi eklendi", cleanLabel));
    });
  }

  function addWorkCategory(label) {
    const cleanLabel = String(label || "").trim();
    const keyBase = makeCategoryKey(cleanLabel);
    if (!cleanLabel || !keyBase) return;
    updateState((draft) => {
      draft.workCategories = draft.workCategories || {};
      const categoryMeta = getWorkCategoryMeta(draft.workCategories);
      let key = keyBase;
      let counter = 2;
      while (categoryMeta[key]) {
        key = `${keyBase}_${counter}`;
        counter += 1;
      }
      const maxOrder = Math.max(0, ...Object.values(categoryMeta).map((item) => Number(item.order || 0)));
      draft.workCategories[key] = { label: cleanLabel, order: maxOrder + 1 };
      draft.logs.unshift(makeLog(currentUser, "İş kategorisi eklendi", cleanLabel));
    });
  }

  function updateWorkCategory(categoryKey, label) {
    const cleanLabel = String(label || "").trim();
    if (!cleanLabel) return;
    updateState((draft) => {
      draft.workCategories = draft.workCategories || {};
      const current = getWorkCategoryMeta(draft.workCategories)[categoryKey];
      if (!current || current.label === cleanLabel) return;
      draft.workCategories[categoryKey] = { ...current, label: cleanLabel, deleted: false };
      draft.logs.unshift(makeLog(currentUser, "İş kategorisi düzenlendi", `${current.label} → ${cleanLabel}`));
    });
  }

  function deleteWorkCategory(categoryKey) {
    const categoryMeta = getWorkCategoryMeta(state.workCategories);
    const category = categoryMeta[categoryKey];
    const remainingKeys = Object.keys(categoryMeta).filter((key) => key !== categoryKey && !["sihhi", "isitma", "yangin"].includes(key));
    if (!category || remainingKeys.length === 0) return;
    if (!confirmAction(`“${category.label}” kategorisini silmek istediğine emin misin? İçindeki işler başka kategoriye taşınacak.`)) return;
    updateState((draft) => {
      draft.workCategories = draft.workCategories || {};
      const current = getWorkCategoryMeta(draft.workCategories)[categoryKey];
      const nextMeta = getWorkCategoryMeta({
        ...draft.workCategories,
        [categoryKey]: { ...(draft.workCategories[categoryKey] || current), deleted: true },
      });
      const fallbackCategory = getSafeWorkCategory("", nextMeta);
      if (defaultWorkCategoryMeta[categoryKey]) {
        draft.workCategories[categoryKey] = { ...current, deleted: true };
      } else {
        delete draft.workCategories[categoryKey];
      }
      draft.workItems.forEach((work) => {
        if (getWorkCategory(work) === categoryKey) work.category = fallbackCategory;
      });
      draft.buildings.forEach((building) => {
        building.works.forEach((work) => {
          if (getWorkCategory(work) === categoryKey) work.category = fallbackCategory;
        });
      });
      draft.logs.unshift(makeLog(currentUser, "İş kategorisi silindi", `${current.label} · işler ${nextMeta[fallbackCategory]?.label || fallbackCategory} kategorisine taşındı`));
    });
  }

  function updateGlobalWorkItem(workKey, patch) {
    updateState((draft) => {
      const work = draft.workItems.find((item) => item.key === workKey);
      if (!work || isForemanHiddenWork(work)) return;
      const previousLabel = work.label;
      const previousCategory = getWorkCategory(work);
      const categoryMeta = getWorkCategoryMeta(draft.workCategories);
      const nextLabel = patch.label === undefined ? work.label : String(patch.label || "").trim();
      const nextCategory = patch.category === undefined ? previousCategory : getSafeWorkCategory(patch.category, categoryMeta);
      if (!nextLabel) return;
      if (nextLabel === previousLabel && nextCategory === previousCategory) return;
      work.label = nextLabel;
      work.category = nextCategory;
      draft.buildings.forEach((building) => {
        building.works.forEach((buildingWork) => {
          if (buildingWork.key !== workKey) return;
          buildingWork.label = nextLabel;
          buildingWork.category = nextCategory;
        });
      });
      draft.logs.unshift(
        makeLog(currentUser, "Hazır iş kalemi düzenlendi", `${previousLabel} → ${nextLabel} · ${categoryMeta[nextCategory]?.label || nextCategory}`),
      );
    });
  }

  function deleteGlobalWorkItem(workKey) {
    if (!confirmAction("Bu hazır iş kalemini tüm binalardan, izinlerden ve açık taleplerden silmek istediğine emin misin?")) return;
    updateState((draft) => {
      const work = draft.workItems.find((item) => item.key === workKey);
      if (!work || isForemanHiddenWork(work)) return;
      draft.workItems = draft.workItems.filter((item) => item.key !== workKey);
      draft.users.forEach((user) => {
        user.workPermissions = (user.workPermissions || []).filter((key) => key !== workKey);
      });
      draft.buildings.forEach((building) => {
        building.works = building.works.filter((item) => item.key !== workKey);
        if (building.progress) delete building.progress[workKey];
      });
      draft.requests.forEach((request) => {
        request.items = (request.items || []).filter((item) => item.workKey !== workKey);
        request.workKeys = (request.workKeys || []).filter((key) => key !== workKey);
      });
      draft.logs.unshift(makeLog(currentUser, "Hazır iş kalemi kaldırıldı", work.label));
    });
  }

  function deleteBuildingWork(buildingId, workKey) {
    if (!confirmAction("Bu iş kalemini silmek istediğine emin misin?")) return;
    updateState((draft) => {
      const building = draft.buildings.find((item) => item.id === buildingId);
      const work = building?.works.find((item) => item.key === workKey);
      if (!building || !work) return;
      building.works = building.works.filter((item) => item.key !== workKey);
      if (building.progress) delete building.progress[workKey];
      building.updatedAt = new Date().toISOString();
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

  function updateBuilding(buildingId, patch) {
    updateState((draft) => {
      const building = draft.buildings.find((item) => item.id === buildingId);
      if (!building) return;
      const before = {
        code: building.code,
        name: building.name,
        lineColor: building.lineColor,
      };
      Object.assign(building, patch);
      if (patch.code) building.id = buildingId;
      const changes = Object.entries(patch)
        .filter(([key]) => before[key] !== undefined && before[key] !== building[key])
        .map(([key]) => `${key}: ${before[key]} → ${building[key]}`)
        .join(", ");
      draft.logs.unshift(makeLog(currentUser, "Bina bilgisi değişti", `${building.code} · ${changes || building.name}`));
    });
  }

  function deleteBuilding(buildingId) {
    if (!confirmAction("Bu binayı ve bağlı harita/talep kayıtlarını silmek istediğine emin misin?")) return;
    updateState((draft) => {
      const building = draft.buildings.find((item) => item.id === buildingId);
      if (!building) return;
      draft.buildings = draft.buildings.filter((item) => item.id !== buildingId);
      draft.requests = draft.requests.filter((request) => request.buildingId !== buildingId);
      draft.users.forEach((user) => {
        user.permissions = (user.permissions || []).filter((id) => id !== buildingId);
      });
      draft.logs.unshift(makeLog(currentUser, "Bina silindi", `${building.code} / ${building.name}`));
    });
    setSelectedBuildingId(null);
    setBuildingPanelSelectedId(null);
    setOpenBuildingId(null);
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
      const building = draft.buildings.find((item) => item.id === request.buildingId);
      if (!building) return;
      const previousBuildingProgress = getBuildingProgress(building);
      request.status = "approved";
      const requestedItems = getRequestItems(request);
      request.items = requestedItems.map((item) => {
        const work = building.works.find((buildingWork) => buildingWork.key === item.workKey);
        const approved = approvedItems?.find((approvedItem) => approvedItem.workKey === item.workKey);
        return {
          ...item,
          approvedQuantity: work ? clampWorkRequestQuantity(building, work, approved?.approvedQuantity ?? item.quantity) : 0,
        };
      });
      request.adminNote = note || "";
      request.revisionReason = "";
      request.reviewedAt = new Date().toISOString();
      request.reviewedBy = currentUser.name;
      request.adminTask = false;

      building.progress = building.progress || {};
      request.items.forEach((item) => {
        const work = building.works.find((buildingWork) => buildingWork.key === item.workKey);
        if (!work || Number(work.quantity) <= 0) return;
        const addPercent = (Number(item.approvedQuantity || 0) / Number(work.quantity)) * 100;
        building.progress[item.workKey] = clampPercent(Number(building.progress[item.workKey] || 0) + addPercent);
      });
      building.updatedAt = new Date().toISOString();
      const nextBuildingProgress = getBuildingProgress(building);
      const itemText = request.items
        .map((item) => {
          const work = building.works.find((buildingWork) => buildingWork.key === item.workKey);
          return `${work?.label || item.workKey} +%${formatQuantity(item.approvedQuantity || 0)}`;
        })
        .join(", ");
      draft.logs.unshift(
        makeLog(currentUser, "Talep onaylandı", `${building.code} · ${itemText || request.id}; bina genel %${previousBuildingProgress} → %${nextBuildingProgress}`),
      );
    });
  }

  function requestRevision(requestId, note) {
    updateState((draft) => {
      const request = draft.requests.find((item) => item.id === requestId);
      if (!request) return;
      request.status = "revision";
      request.adminNote = note || "Revize gerekli";
      request.revisionReason = note || "Revize gerekli";
      request.reviewedAt = new Date().toISOString();
      request.reviewedBy = currentUser.name;
      draft.logs.unshift(makeLog(currentUser, "Revize istendi", `${request.buildingId} / ${request.id}`));
    });
  }

  function updateRequest(requestId, patch) {
    updateState((draft) => {
      const request = draft.requests.find((item) => item.id === requestId);
      if (!request) return;
      if (patch.note !== undefined) request.note = patch.note;
      if (patch.adminNote !== undefined) request.adminNote = patch.adminNote;
      if (patch.revisionReason !== undefined) request.revisionReason = patch.revisionReason;
      request.updatedAt = new Date().toISOString();
      draft.logs.unshift(makeLog(currentUser, "Talep notu güncellendi", request.id));
    });
  }

  function cancelRequest(requestId) {
    if (!confirmAction("Bu talebi iptal etmek istediğine emin misin?")) return;
    updateState((draft) => {
      const request = draft.requests.find((item) => item.id === requestId);
      if (!request || request.status === "approved") return;
      draft.requests = draft.requests.filter((item) => item.id !== requestId);
      draft.logs.unshift(makeLog(currentUser, "Talep iptal edildi", request.id));
    });
  }

  function answerRevision(requestId, answer, photo, updatedItems) {
    updateState((draft) => {
      const request = draft.requests.find((item) => item.id === requestId);
      if (!request) return;
      const building = draft.buildings.find((item) => item.id === request.buildingId);
      if (building && updatedItems?.length) {
        request.items = updatedItems
          .map((item) => {
            const work = building.works.find((buildingWork) => buildingWork.key === item.workKey);
            if (!work) return null;
            return {
              ...item,
              quantity: clampWorkAvailableRequestQuantity(building, work, draft.requests || [], item.quantity, requestId),
            };
          })
          .filter(Boolean);
      }
      request.status = "answered";
      request.revisionAnswer = answer || "";
      request.answerPhoto = photo || "";
      request.answeredAt = new Date().toISOString();
      draft.logs.unshift(makeLog(currentUser, "Revize cevaplandı", `${request.buildingId} / ${request.id}`));
    });
  }

  function assignBuildingCoordinates(buildingId, coordinates) {
    updateState((draft) => {
      const building = draft.buildings.find((item) => item.id === buildingId);
      if (!building) return;
      const sanitized = sanitizeBuildingCoordinates(coordinates, draft.map);
      if (sanitized.length < 3) return;
      building.coordinates = sanitized;
      building.updatedAt = new Date().toISOString();
      draft.logs.unshift(
        makeLog(currentUser, "Harita bina eşleşmesi kaydedildi", `${building.code} · ${sanitized.length} köşe`),
      );
    });
    setSelectedBuildingId(buildingId);
  }

  function removeBuildingCoordinates(buildingId) {
    if (!confirmAction("Bu binanın harita eşleşmesini kaldırmak istediğine emin misin?")) return;
    updateState((draft) => {
      const building = draft.buildings.find((item) => item.id === buildingId);
      if (!building?.coordinates?.length) return;
      building.coordinates = [];
      building.updatedAt = new Date().toISOString();
      draft.logs.unshift(makeLog(currentUser, "Harita bina eşleşmesi kaldırıldı", building.code));
    });
  }

  function updateProgressRange(rangeId, patch) {
    updateState((draft) => {
      draft.progressRanges = sanitizeProgressRanges(draft.progressRanges);
      const range = draft.progressRanges.find((item) => item.id === rangeId);
      if (!range) return;
      Object.assign(range, patch);
      if (patch.min !== undefined) range.min = clampPercent(patch.min);
      if (patch.max !== undefined) range.max = clampPercent(patch.max);
      if (patch.color !== undefined) range.color = safeColor(patch.color, range.color);
      if (range.min > range.max) [range.min, range.max] = [range.max, range.min];
      range.label = `${range.min}-${range.max}`;
      draft.progressRanges = sanitizeProgressRanges(draft.progressRanges);
      draft.logs.unshift(makeLog(currentUser, "Harita renk dilimi değişti", `${range.label} · ${range.color}`));
    });
  }

  function addProgressRange() {
    updateState((draft) => {
      draft.progressRanges = sanitizeProgressRanges(draft.progressRanges);
      draft.progressRanges.push({
        id: `range-${Date.now()}`,
        min: 0,
        max: 100,
        color: "#2b6cb0",
        label: "0-100",
      });
      draft.logs.unshift(makeLog(currentUser, "Harita renk dilimi eklendi", "0-100 · #2b6cb0"));
    });
  }

  function deleteProgressRange(rangeId) {
    if (!confirmAction("Bu renk dilimini silmek istediğine emin misin?")) return;
    updateState((draft) => {
      const removedRange = sanitizeProgressRanges(draft.progressRanges).find((range) => range.id === rangeId);
      draft.progressRanges = sanitizeProgressRanges(draft.progressRanges).filter((range) => range.id !== rangeId);
      if (draft.progressRanges.length === 0) draft.progressRanges = JSON.parse(JSON.stringify(defaultProgressRanges));
      draft.progressRanges = sanitizeProgressRanges(draft.progressRanges);
      draft.logs.unshift(makeLog(currentUser, "Harita renk dilimi silindi", removedRange ? `${removedRange.label} · ${removedRange.color}` : rangeId));
    });
  }

  function resetProgressRanges() {
    updateState((draft) => {
      draft.progressRanges = JSON.parse(JSON.stringify(defaultProgressRanges));
      draft.logs.unshift(makeLog(currentUser, "Harita renkleri sıfırlandı", "Kırmızı / sarı / yeşil"));
    });
  }

  function updateThemeColor(mode, key, value) {
    updateState((draft) => {
      draft.themeSettings = sanitizeThemeSettings(draft.themeSettings);
      if (!draft.themeSettings[mode] || !(key in draft.themeSettings[mode])) return;
      const previousColor = draft.themeSettings[mode][key];
      draft.themeSettings[mode][key] = safeColor(value, defaultThemeSettings[mode][key]);
      draft.logs.unshift(makeLog(currentUser, "Tema rengi değişti", `${mode} · ${key}: ${previousColor} → ${draft.themeSettings[mode][key]}`));
    });
  }

  function resetThemeSettings() {
    updateState((draft) => {
      draft.themeSettings = sanitizeThemeSettings(defaultThemeSettings);
      draft.logs.unshift(makeLog(currentUser, "Tema renkleri sıfırlandı", "Açık mod ve dark mode varsayılanları"));
    });
  }

  function updateUser(userId, patch) {
    updateState((draft) => {
      const user = draft.users.find((item) => item.id === userId);
      if (!user) return;
      const previous = { name: user.name, username: user.username, role: user.role };
      Object.assign(user, patch);
      if (user.role === "admin") {
        user.permissions = draft.buildings.map((building) => building.id);
      }
      const changes = Object.entries(patch)
        .filter(([key]) => previous[key] !== undefined && previous[key] !== user[key])
        .map(([key]) => `${key}: ${previous[key]} → ${user[key]}`)
        .join(", ");
      draft.logs.unshift(makeLog(currentUser, "Kullanıcı bilgisi değişti", `${user.username} · ${changes || "bilgi güncellendi"}`));
    });
  }

  function toggleUserPermission(userId, buildingId) {
    updateState((draft) => {
      const user = draft.users.find((item) => item.id === userId);
      if (!user || user.role === "admin") return;
      const hasPermission = user.permissions.includes(buildingId);
      const building = draft.buildings.find((item) => item.id === buildingId);
      user.permissions = hasPermission
        ? user.permissions.filter((id) => id !== buildingId)
        : [...user.permissions, buildingId];
      draft.logs.unshift(
        makeLog(currentUser, "Bina izni değişti", `${user.username} · ${hasPermission ? "kaldırıldı" : "eklendi"}: ${building?.code || buildingId}`),
      );
    });
  }

  function toggleUserWorkPermission(userId, workKey) {
    updateState((draft) => {
      const user = draft.users.find((item) => item.id === userId);
      if (!user || user.role === "admin") return;
      const assignableWorkKeys = draft.workItems.filter((work) => !isForemanHiddenWork(work)).map((work) => work.key);
      user.workPermissions = user.workPermissions || assignableWorkKeys;
      const hasPermission = user.workPermissions.includes(workKey);
      const work = draft.workItems.find((item) => item.key === workKey);
      user.workPermissions = hasPermission
        ? user.workPermissions.filter((key) => key !== workKey)
        : [...user.workPermissions, workKey];
      draft.logs.unshift(
        makeLog(currentUser, "İş kalemi izni değişti", `${user.username} · ${hasPermission ? "kaldırıldı" : "eklendi"}: ${work?.label || workKey}`),
      );
    });
  }

  function bulkSetWorkPermissions(userId, mode) {
    updateState((draft) => {
      const user = draft.users.find((item) => item.id === userId);
      if (!user || user.role === "admin") return;
      const assignable = draft.workItems.filter((work) => !isForemanHiddenWork(work)).map((work) => work.key);
      if (mode === "all") {
        user.workPermissions = assignable;
        draft.logs.unshift(makeLog(currentUser, "İş izinleri değişti", `${user.username} · tüm işler seçildi (${assignable.length})`));
      } else if (mode === "clear") {
        user.workPermissions = [];
        draft.logs.unshift(makeLog(currentUser, "İş izinleri değişti", `${user.username} · tüm işler temizlendi`));
      } else if (mode?.type === "add") {
        const keys = mode.keys || [];
        user.workPermissions = Array.from(new Set([...(user.workPermissions || []), ...keys]));
        draft.logs.unshift(makeLog(currentUser, "İş izinleri değişti", `${user.username} · kategori seçildi (${keys.length})`));
      } else if (mode?.type === "remove") {
        const keySet = new Set(mode.keys || []);
        user.workPermissions = (user.workPermissions || []).filter((key) => !keySet.has(key));
        draft.logs.unshift(makeLog(currentUser, "İş izinleri değişti", `${user.username} · kategori temizlendi (${keySet.size})`));
      }
    });
  }

  function bulkSetPermissions(userId, mode) {
    updateState((draft) => {
      const user = draft.users.find((item) => item.id === userId);
      if (!user || user.role === "admin") return;
      if (mode === "all") {
        user.permissions = draft.buildings.map((building) => building.id);
        draft.logs.unshift(makeLog(currentUser, "Bina izinleri değişti", `${user.username} · tüm binalar seçildi (${user.permissions.length})`));
      } else if (mode === "clear") {
        user.permissions = [];
        draft.logs.unshift(makeLog(currentUser, "Bina izinleri değişti", `${user.username} · tüm binalar temizlendi`));
      } else {
        user.permissions = draft.buildings
          .filter((building) => mode.includes(building.lineColor.toLocaleUpperCase("tr-TR")))
          .map((building) => building.id);
        draft.logs.unshift(makeLog(currentUser, "Bina izinleri değişti", `${user.username} · ${mode.join(", ")} seçildi (${user.permissions.length})`));
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
    if (!confirmAction("Bu kullanıcıyı silmek istediğine emin misin?")) return;
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
    <div className={`app-shell ${theme === "dark" ? "theme-dark" : ""}`} style={makeThemeStyle(state.themeSettings, theme)}>
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <MapPinned size={24} />
          </div>
          <div>
            <h1>{APP_TITLE}</h1>
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
          {currentUser.role === "admin" && (
            <button
              className={`icon-button ${activeTab === "settings" ? "active" : ""}`}
              title="Ayarlar"
              onClick={() => setActiveTab("settings")}
            >
              <Settings size={17} />
            </button>
          )}
          <div>
            <strong>{currentUser.name}</strong>
            <span>{currentUser.role === "admin" ? "Süper Admin" : "Formen"}</span>
          </div>
          <button className="icon-button" title="Tema değiştir" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
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
          />
          <main className="workspace">
            <BuildingSidebar
              buildings={visibleBuildings}
              user={currentUser}
              progressRanges={state.progressRanges}
              totalCount={accessibleBuildings.length}
              query={query}
              onQuery={setQuery}
              selectedBuildingId={selectedBuilding?.id}
              onSelect={(buildingId) => {
                setSelectedBuildingId(buildingId);
                setOpenBuildingId(buildingId);
              }}
            />
            <React.Suspense fallback={<section className="map-section map-loading">Vaziyet planı yükleniyor…</section>}>
              <SiteMapPanel
                map={state.map}
                buildings={state.buildings}
                user={currentUser}
                selectedBuildingId={selectedBuildingId}
                progressRanges={state.progressRanges}
                getProgress={(building) => getScopedBuildingProgress(currentUser, building)}
                getProgressColor={(progress, ranges) => getProgressRange(progress, ranges)?.color || "#ef4444"}
                onAssignCoordinates={assignBuildingCoordinates}
                undoItems={undoHistoryRef.current}
                redoItems={redoHistoryRef.current}
                undoCount={undoCount}
                redoCount={redoCount}
                historyStatus={historyStatus}
                onUndo={undoAdminActions}
                onRedo={redoAdminActions}
                onSelect={(buildingId) => {
                  if (!canAccess(currentUser, buildingId)) return;
                  setSelectedBuildingId(buildingId);
                  setOpenBuildingId(buildingId);
                }}
              />
            </React.Suspense>
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
          onUpdateRequest={updateRequest}
          onCancelRequest={cancelRequest}
          onOpenBuilding={(buildingId) => {
            setSelectedBuildingId(buildingId);
            setOpenBuildingId(buildingId);
            setActiveTab("map");
          }}
        />
      )}

      {activeTab === "logs" && currentUser.role === "admin" && <LogsPanel logs={state.logs} />}

      {activeTab === "buildings" && currentUser.role === "admin" && (
        <BuildingsPanel
          buildings={state.buildings}
          workItems={state.workItems}
          workCategories={state.workCategories}
          selectedBuildingId={buildingPanelSelectedId}
          onSelectBuilding={(buildingId) => {
            if (buildingPanelSelectedId === buildingId) {
              setBuildingPanelSelectedId(null);
              return;
            }
            setBuildingPanelSelectedId(buildingId);
            setSelectedBuildingId(buildingId);
          }}
          onOpenBuilding={(buildingId) => {
            setBuildingPanelSelectedId(buildingId);
            setSelectedBuildingId(buildingId);
            setOpenBuildingId(buildingId);
          }}
          onSetWorkProgress={setWorkProgress}
          onSetWorkQuantity={setWorkQuantity}
          onSetWorkWeight={setWorkWeight}
          onUpdateBuilding={updateBuilding}
          onDeleteBuilding={deleteBuilding}
          onUpdateWorkLabel={updateWorkLabel}
          onAddBuildingWork={addBuildingWork}
          onDeleteBuildingWork={deleteBuildingWork}
        />
      )}

      {activeTab === "users" && currentUser.role === "admin" && (
        <UsersPanel
          users={state.users}
          buildings={state.buildings}
          workItems={state.workItems}
          workCategories={state.workCategories}
          onUpdateUser={updateUser}
          onTogglePermission={toggleUserPermission}
          onToggleWorkPermission={toggleUserWorkPermission}
          onBulkPermissions={bulkSetPermissions}
          onBulkWorkPermissions={bulkSetWorkPermissions}
          onAddGlobalWorkItem={addGlobalWorkItem}
          onAddWorkCategory={addWorkCategory}
          onUpdateWorkCategory={updateWorkCategory}
          onDeleteWorkCategory={deleteWorkCategory}
          onUpdateGlobalWorkItem={updateGlobalWorkItem}
          onDeleteGlobalWorkItem={deleteGlobalWorkItem}
          onAddUser={addUser}
          onDeleteUser={deleteUser}
        />
      )}

      {activeTab === "settings" && currentUser.role === "admin" && (
        <SettingsPanel
          progressRanges={state.progressRanges}
          themeSettings={state.themeSettings}
          onUpdateProgressRange={updateProgressRange}
          onAddProgressRange={addProgressRange}
          onDeleteProgressRange={deleteProgressRange}
          onResetProgressRanges={resetProgressRanges}
          onUpdateThemeColor={updateThemeColor}
          onResetThemeSettings={resetThemeSettings}
        />
      )}

      {openBuilding && (
        <BuildingModal
          user={currentUser}
          building={openBuilding}
          buildings={state.buildings}
          workItems={state.workItems}
          workCategories={state.workCategories}
          requests={state.requests.filter((request) => request.buildingId === openBuilding.id)}
          allRequests={state.requests}
          progressRanges={state.progressRanges}
          onClose={() => setOpenBuildingId(null)}
          onSetWorkProgress={setWorkProgress}
          onSetWorkQuantity={setWorkQuantity}
          onSetWorkWeight={setWorkWeight}
          onUpdateBuilding={updateBuilding}
          onDeleteBuilding={deleteBuilding}
          onUpdateWorkLabel={updateWorkLabel}
          onAddBuildingWork={addBuildingWork}
          onDeleteBuildingWork={deleteBuildingWork}
          onAddBuildingFile={addBuildingFile}
          onCreateRequest={createRequest}
          onApproveRequest={approveRequest}
          onRevision={requestRevision}
          onAnswerRevision={answerRevision}
          onUpdateRequest={updateRequest}
          onCancelRequest={cancelRequest}
          onRemoveCoordinates={removeBuildingCoordinates}
        />
      )}
    </div>
  );
}

function LoginScreen({ users, onLogin }) {
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || "");
  const [password, setPassword] = useState("");
  const [passwordStep, setPasswordStep] = useState(false);
  const [error, setError] = useState("");
  const selectedUser = users.find((user) => user.id === selectedUserId);

  function submit(event) {
    event.preventDefault();
    if (!selectedUser) {
      setError("Kullanıcı seç.");
      return;
    }
    if (!passwordStep) {
      setPasswordStep(true);
      setPassword("");
      setError("");
      return;
    }
    if (selectedUser.password && selectedUser.password !== password) {
      setError("Şifre hatalı.");
      return;
    }
    onLogin(selectedUser.id);
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
              <h1>{APP_TITLE}</h1>
              <p>Giriş yap</p>
            </div>
          </div>

          <div className="login-user-list">
            {users.map((user) => (
              <button
                className={selectedUserId === user.id ? "active" : ""}
                key={user.id}
                type="button"
                onClick={() => {
                  setSelectedUserId(user.id);
                  setPasswordStep(false);
                  setPassword("");
                  setError("");
                }}
              >
                <CircleUserRound size={18} />
                <span>
                  <strong>{user.name}</strong>
                  {user.role === "admin" ? "Süper Admin" : "Formen"}
                </span>
              </button>
            ))}
          </div>

          {passwordStep && (
            <label>
              Şifre
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                type="password"
                autoFocus
              />
            </label>
          )}

          {error && <div className="form-error">{error}</div>}

          <button className="primary-action" type="submit">
            <Lock size={17} />
            {passwordStep ? "Giriş yap" : "Şifre sor"}
          </button>

        </form>
      </section>
    </main>
  );
}

function BuildingSidebar({ buildings, user, progressRanges, totalCount, query, onQuery, selectedBuildingId, onSelect }) {
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
          const progress = getScopedBuildingProgress(user, building);
          const color = getProgressColor(progress, progressRanges);
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
                <i style={{ width: `${progress}%`, background: color }} />
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function SummaryPanel({
  user,
  buildings,
  requests,
  progressRanges,
}) {
  const scopedRequests =
    user.role === "admin"
      ? requests
      : requests.filter((request) => request.createdBy === user.id || (request.adminTask && canAccess(user, request.buildingId)));
  const progressSum = buildings.reduce((sum, building) => sum + getScopedBuildingProgress(user, building), 0);
  const average = buildings.length && progressSum > 0 ? Math.max(1, Math.round(progressSum / buildings.length)) : 0;
  const pending = scopedRequests.filter((request) => request.status === "pending").length;
  const revision = scopedRequests.filter((request) => request.status === "revision").length;
  const progressColor = getProgressColor(average, progressRanges);

  return (
    <aside className="summary-panel">
      <div className="metric-block">
        <span>Genel ilerleme</span>
        <strong>{average}%</strong>
        <div className="big-progress">
          <i style={{ width: `${average}%`, background: progressColor }} />
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
    </aside>
  );
}

function BuildingModal({
  user,
  building,
  buildings,
  workItems,
  workCategories,
  requests,
  allRequests,
  progressRanges,
  onClose,
  onSetWorkProgress,
  onSetWorkQuantity,
  onSetWorkWeight,
  onUpdateBuilding,
  onDeleteBuilding,
  onUpdateWorkLabel,
  onAddBuildingWork,
  onDeleteBuildingWork,
  onAddBuildingFile,
  onCreateRequest,
  onApproveRequest,
  onRevision,
  onAnswerRevision,
  onUpdateRequest,
  onCancelRequest,
  onRemoveCoordinates,
}) {
  const [requestQuantities, setRequestQuantities] = useState({});
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState("");
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [newWork, setNewWork] = useState(initialNewWork);
  const [adminTaskNote, setAdminTaskNote] = useState("");
  const [revisionAnswers, setRevisionAnswers] = useState({});

  useEffect(() => {
    setRequestQuantities({});
    setNote("");
    setPhoto("");
  }, [building.id]);

  const progress = getScopedBuildingProgress(user, building);
  const progressColor = getProgressColor(progress, progressRanges);
  const categoryMeta = getWorkCategoryMeta(workCategories);
  const allowedWorkKeys = getUserWorkPermissions(user, building.works);
  const visibleWorks =
    user.role === "admin"
      ? building.works
      : building.works.filter((work) => allowedWorkKeys.includes(work.key) && !isForemanHiddenWork(work));
  const categoryProgressItems = getCategoryProgressItems(building, visibleWorks, categoryMeta);
  const requestableWorks = visibleWorks.filter(
    (work) =>
      allowedWorkKeys.includes(work.key) &&
      !isForemanHiddenWork(work) &&
      getWorkAvailableQuantity(building, work, allRequests) > 0,
  );
  const requestItems = requestableWorks
    .map((work) => ({
      workKey: work.key,
      quantity: clampWorkAvailableRequestQuantity(building, work, allRequests, requestQuantities[work.key]),
    }))
    .filter((item) => item.quantity > 0);
  const canSubmit = user.role !== "admin" && requestItems.length > 0;

  function setRequestQuantity(workKey, value) {
    const work = building.works.find((item) => item.key === workKey);
    setRequestQuantities((previous) => ({
      ...previous,
      [workKey]: work ? clampWorkAvailableRequestQuantity(building, work, allRequests, value) : clampQuantity(value),
    }));
  }

  async function handlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setPhoto(await prepareImageAttachment(file));
    } catch {
      alert("Fotoğraf yüklenemedi. Daha küçük bir dosya dene.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleBuildingFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = file.type.startsWith("image/") ? await prepareImageAttachment(file) : await readFileAsDataUrl(file);
      onAddBuildingFile(building.id, {
        id: `FILE-${Date.now()}`,
        name: file.name,
        type: file.type,
        data,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user.name,
      });
    } catch {
      alert("Dosya yüklenemedi. Daha küçük bir dosya dene.");
    } finally {
      event.target.value = "";
    }
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
    const request = requests.find((item) => item.id === requestId);
    if (!request) return;
    const draft = revisionAnswers[requestId] || {};
    const items =
      draft.items ||
      getRequestItems(request).map((item) => ({
        workKey: item.workKey,
        quantity: item.quantity,
      }));
    if (!draft.note?.trim() && !draft.photo && !draft.items) return;
    onAnswerRevision(requestId, draft.note, draft.photo, items);
    setRevisionAnswers((previous) => ({ ...previous, [requestId]: { note: "", photo: "", items: [] } }));
  }

  async function handleRevisionPhoto(requestId, event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = await prepareImageAttachment(file);
      setRevisionAnswers((previous) => ({
        ...previous,
        [requestId]: { ...(previous[requestId] || {}), photo: data },
      }));
    } catch {
      alert("Fotoğraf yüklenemedi. Daha küçük bir dosya dene.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className={`building-modal ${user.role !== "admin" ? "foreman-modal" : ""}`}>
        <header className="modal-header">
          <div>
            <span>{building.coordinates?.length ? "Haritayla eşleştirildi" : "Harita eşleşmesi bekliyor"}</span>
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
            {user.role === "admin" && (
              <div className="building-info-editor">
                <label>
                  Kod
                  <input value={building.code} onChange={(event) => onUpdateBuilding(building.id, { code: event.target.value })} />
                </label>
                <label>
                  Bina adı
                  <input value={building.name} onChange={(event) => onUpdateBuilding(building.id, { name: event.target.value })} />
                </label>
                <label>
                  Hat
                  <LineSelect
                    value={building.lineColor}
                    onChange={(lineColor) => onUpdateBuilding(building.id, { lineColor })}
                  />
                </label>
                <button className="icon-button danger" title="Binayı sil" onClick={() => onDeleteBuilding(building.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            )}
            <div className="progress-header">
              <div>
                <span>Genel yüzde</span>
                <strong>{progress}%</strong>
              </div>
              <div className="status-dot" style={{ background: progressColor }} />
            </div>
            <div className="big-progress">
              <i style={{ width: `${progress}%`, background: progressColor }} />
            </div>
            <div className="category-progress-grid">
              {categoryProgressItems.map((category) => (
                <div key={category.key}>
                  <span>{category.label}</span>
                  <strong>{category.progress}%</strong>
                  <div className="mini-progress">
                    <i style={{ width: `${category.progress}%`, background: getProgressColor(category.progress, progressRanges) }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="work-list">
              {groupWorksByCategory(visibleWorks, categoryMeta).map((category) => (
                <details className="work-category" key={category.key}>
                  <summary>
                    <span>{category.label}</span>
                    <b>{getWorksProgress(building, category.items)}%</b>
                    <ChevronDown size={16} />
                  </summary>
                  {category.items.map((work) => {
                    const value = Number(building.progress?.[work.key] || 0);
                    const remaining = getWorkRemainingQuantity(building, work);
                    const workColor = getProgressColor(value, progressRanges);
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
                      <span>
                        Hakediş payı %{formatQuantity(work.weight ?? 0)} · İlerleme %{value} · Kalan %{formatQuantity(remaining)}
                      </span>
                    </div>
                    {user.role === "admin" ? (
                      <div className="admin-work-edit">
                        <label>
                          Talep limiti %
                          <input
                            type="number"
                            min="0"
                            value={work.quantity}
                            onChange={(event) => onSetWorkQuantity(building.id, work.key, event.target.value)}
                          />
                        </label>
                        <label>
                          Hakediş payı %
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
                        <i style={{ width: `${value}%`, background: workColor }} />
                        <b>{value}%</b>
                      </div>
                    )}
                      </div>
                    );
                  })}
                </details>
              ))}
            </div>
            {user.role === "admin" && (
              <form
                className="add-work-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  onAddBuildingWork(building.id, newWork);
                  setNewWork(initialNewWork);
                }}
              >
                <ReadyWorkSelect
                  workItems={workItems}
                  value={newWork.sourceWorkKey}
                  onChange={(workKey) => setNewWork((previous) => makeNewWorkFromReady(previous, workItems, workKey))}
                />
                <input
                  value={newWork.label}
                  onChange={(event) => setNewWork((previous) => ({ ...previous, label: event.target.value }))}
                  placeholder="Ek iş kalemi adı"
                />
                <input
                  type="number"
                  min="0"
                  value={newWork.quantity}
                  onChange={(event) => setNewWork((previous) => ({ ...previous, quantity: event.target.value }))}
                  placeholder="Limit %"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newWork.weight}
                  onChange={(event) => setNewWork((previous) => ({ ...previous, weight: event.target.value }))}
                  placeholder="Pay %"
                />
                <WorkCategorySelect
                  categoryMeta={categoryMeta}
                  value={newWork.category}
                  onChange={(category) => setNewWork((previous) => ({ ...previous, category }))}
                />
                <button className="secondary-action" type="submit">
                  <Plus size={16} />
                  Ekle
                </button>
              </form>
            )}
          </section>

          <section className="request-panel">
            {user.role === "admin" && building.coordinates?.length >= 3 && (
              <div className="admin-box">
                <button className="secondary-action" onClick={() => onRemoveCoordinates(building.id)}>
                  <X size={16} />
                  Harita eşleşmesini kaldır
                </button>
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
              </>
            )}

            {(user.role === "admin" || (building.files || []).length > 0) && (
              <div className="file-panel">
                <div className="section-heading flat">
                  <div>
                    <span>Bina dosyaları</span>
                    <strong>{(building.files || []).length}</strong>
                  </div>
                </div>
                {user.role === "admin" && (
                  <label className="photo-upload">
                    <Upload size={17} />
                    Bina dosyası yükle
                    <input type="file" onChange={handleBuildingFile} />
                  </label>
                )}
                {(building.files || []).length === 0 && user.role === "admin" && (
                  <div className="empty-state compact">Bu bina için dosya yok.</div>
                )}
                {(building.files || []).map((file) => (
                  <a className="file-row" key={file.id} href={file.data} download={file.name}>
                    <FileText size={16} />
                    <span>{file.name}</span>
                  </a>
                ))}
              </div>
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
                  {groupWorksByCategory(requestableWorks, categoryMeta).map((category) => (
                    <details className="request-category" key={category.key}>
                      <summary>
                        <span>{category.label}</span>
                        <b>{category.items.length}</b>
                        <ChevronDown size={16} />
                      </summary>
                      {category.items.map((work) => {
                        const remaining = getWorkAvailableQuantity(building, work, allRequests);
                        return (
                          <label key={work.key}>
                            <span>
                              <strong>{work.label}</strong>
                              Kalan: %{formatQuantity(remaining)}
                            </span>
                            <input
                              type="number"
                              min="0"
                              max={remaining || undefined}
                              value={requestQuantities[work.key] || ""}
                              onChange={(event) => setRequestQuantity(work.key, event.target.value)}
                              placeholder="Yapılan %"
                            />
                          </label>
                        );
                      })}
                    </details>
                  ))}
                </div>
                <details className="secondary-details">
                  <summary>Not ve fotoğraf</summary>
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
                </details>
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
                    return `${work?.label || item.workKey}: %${formatQuantity(item.quantity)}`;
                  })
                  .join(", ") || "Süper admin isteği";
                const draft = reviewDrafts[request.id] || {
                  items: items.map((item) => ({
                    workKey: item.workKey,
                    approvedQuantity: item.approvedQuantity ?? item.quantity,
                  })),
                  note: request.adminNote || "",
                };
                const answerDraft = revisionAnswers[request.id] || {};
                const revisionItems =
                  answerDraft.items ||
                  items.map((item) => ({
                    workKey: item.workKey,
                    quantity: item.quantity,
                  }));
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
                    {request.revisionReason && <p className="admin-note">Revize sebebi: {request.revisionReason}</p>}
                    {request.photo && <img className="request-photo" src={request.photo} alt="Talep eki" />}
                    {request.revisionAnswer && <p className="request-note">Formen cevabı: {request.revisionAnswer}</p>}
                    {request.answerPhoto && <img className="request-photo" src={request.answerPhoto} alt="Revize cevabı eki" />}
                    {canEditRequestNote(user, request) && (
                      <div className="request-edit-controls">
                        <input
                          value={user.role === "admin" ? draft.note : answerDraft.editNote ?? request.note ?? ""}
                          onChange={(event) => {
                            if (user.role === "admin") {
                              setReviewDrafts((previous) => ({
                                ...previous,
                                [request.id]: { ...draft, note: event.target.value },
                              }));
                            } else {
                              setRevisionAnswers((previous) => ({
                                ...previous,
                                [request.id]: { ...(previous[request.id] || {}), editNote: event.target.value },
                              }));
                            }
                          }}
                          placeholder={user.role === "admin" ? "Admin notu / revize sebebi" : "Talep notu"}
                        />
                        <button
                          className="secondary-action"
                          type="button"
                          onClick={() =>
                            user.role === "admin"
                              ? onUpdateRequest(request.id, {
                                  adminNote: draft.note,
                                  revisionReason: request.status === "revision" ? draft.note : request.revisionReason,
                                })
                              : onUpdateRequest(request.id, { note: answerDraft.editNote ?? request.note ?? "" })
                          }
                        >
                          <Edit3 size={16} />
                          Kaydet
                        </button>
                        {request.status !== "approved" && (
                          <button className="icon-button danger" title="Talebi iptal et" type="button" onClick={() => onCancelRequest(request.id)}>
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    )}
                    {canForemanAnswerRequest(user, request) && (
                      <div className="review-controls">
                        {items.length > 0 && (
                        <label>
                          Güncel talep miktarı
                          <div className="approval-quantity-list">
                            {items.map((item) => {
                              const work = building.works.find((buildingWork) => buildingWork.key === item.workKey);
                              const revisionItem = revisionItems.find((draftItem) => draftItem.workKey === item.workKey);
                              const remaining = work ? getWorkAvailableQuantity(building, work, allRequests, request.id) : 0;
                              return (
                                <div key={item.workKey}>
                                  <span>{work?.label || item.workKey}</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max={remaining || undefined}
                                    value={revisionItem?.quantity ?? item.quantity}
                                    onChange={(event) =>
                                      setRevisionAnswers((previous) => ({
                                        ...previous,
                                        [request.id]: {
                                          ...answerDraft,
                                          items: revisionItems.map((draftItem) =>
                                            draftItem.workKey === item.workKey
                                              ? {
                                                  ...draftItem,
                                                  quantity: work
                                                    ? clampWorkAvailableRequestQuantity(building, work, allRequests, event.target.value, request.id)
                                                    : clampQuantity(event.target.value),
                                                }
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
                        )}
                        <label>
                          {request.adminTask ? "İstek cevabı" : "Revize cevabı"}
                          <input
                            value={answerDraft.note || ""}
                            onChange={(event) =>
                              setRevisionAnswers((previous) => ({
                                ...previous,
                                [request.id]: { ...(previous[request.id] || {}), note: event.target.value, items: revisionItems },
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
                              const remaining = work ? getWorkRemainingQuantity(building, work) : 0;
                              return (
                                <div key={item.workKey}>
                                  <span>{work?.label || item.workKey}</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max={remaining || undefined}
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

function RequestsPanel({
  user,
  requests,
  buildingsById,
  onApprove,
  onRevision,
  onAnswerRevision,
  onUpdateRequest,
  onCancelRequest,
  onOpenBuilding,
}) {
  const [status, setStatus] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [drafts, setDrafts] = useState({});
  const [answers, setAnswers] = useState({});

  const scopedRequests = requests.filter((request) => {
    return user.role === "admin" || request.createdBy === user.id || (request.adminTask && canAccess(user, request.buildingId));
  });
  const creators = Array.from(
    new Map(scopedRequests.map((request) => [request.createdBy, { id: request.createdBy, name: request.createdByName }])).values(),
  ).sort((a, b) => a.name.localeCompare(b.name, "tr-TR"));
  const visible = scopedRequests
    .filter((request) => {
      const matchesStatus = status === "all" || request.status === status;
      const matchesUser = userFilter === "all" || request.createdBy === userFilter;
      return matchesStatus && matchesUser;
    })
    .sort((a, b) => {
      const order = { pending: 0, revision: 1, answered: 2, approved: 3 };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9) || new Date(b.createdAt) - new Date(a.createdAt);
    });

  return (
    <main className="page-panel">
      <div className="panel-title-row">
        <div>
          <h2>İlerleme talepleri</h2>
          <p>{visible.length} kayıt</p>
        </div>
        <div className="request-filters">
          {user.role === "admin" && (
            <select value={userFilter} onChange={(event) => setUserFilter(event.target.value)} aria-label="Formen filtresi">
              <option value="all">Tüm formenler</option>
              {creators.map((creator) => (
                <option key={creator.id} value={creator.id}>
                  {creator.name}
                </option>
              ))}
            </select>
          )}
          <div className="segmented">
            {["all", "pending", "answered", "revision", "approved"].map((item) => (
              <button key={item} className={status === item ? "active" : ""} onClick={() => setStatus(item)}>
                {item === "all" ? "Tümü" : statusLabels[item]}
              </button>
            ))}
          </div>
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
              return `${work?.label || item.workKey}: %${formatQuantity(item.quantity)}`;
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
                {request.revisionReason && <p className="admin-note">Revize sebebi: {request.revisionReason}</p>}
              </div>
              {request.photo && <img src={request.photo} alt="Talep fotoğrafı" />}
              <div className="wide-actions">
                <button className="secondary-action" onClick={() => onOpenBuilding(request.buildingId)}>
                  <Eye size={16} />
                  Aç
                </button>
                {canEditRequestNote(user, request) && (
                  <>
                    <input
                      className="wide-note-input"
                      value={user.role === "admin" ? draft.note : answers[`edit-${request.id}`] ?? request.note ?? ""}
                      onChange={(event) => {
                        if (user.role === "admin") {
                          setDrafts((previous) => ({
                            ...previous,
                            [request.id]: { ...draft, note: event.target.value },
                          }));
                        } else {
                          setAnswers((previous) => ({ ...previous, [`edit-${request.id}`]: event.target.value }));
                        }
                      }}
                      placeholder={user.role === "admin" ? "Admin notu / revize sebebi" : "Talep notu"}
                    />
                    <button
                      className="secondary-action"
                      onClick={() =>
                        user.role === "admin"
                          ? onUpdateRequest(request.id, {
                              adminNote: draft.note,
                              revisionReason: request.status === "revision" ? draft.note : request.revisionReason,
                            })
                          : onUpdateRequest(request.id, { note: answers[`edit-${request.id}`] ?? request.note ?? "" })
                      }
                    >
                      <Edit3 size={16} />
                      Kaydet
                    </button>
                    {request.status !== "approved" && (
                      <button className="icon-button danger" title="Talebi iptal et" onClick={() => onCancelRequest(request.id)}>
                        <X size={16} />
                      </button>
                    )}
                  </>
                )}
                {canForemanAnswerRequest(user, request) && (
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
                        const remaining = work ? getWorkRemainingQuantity(building, work) : 0;
                        return (
                          <label key={item.workKey}>
                            <span>{work?.label || item.workKey}</span>
                            <input
                              type="number"
                              min="0"
                              max={remaining || undefined}
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
                    <input
                      className="wide-note-input"
                      value={draft.note}
                      onChange={(event) =>
                        setDrafts((previous) => ({
                          ...previous,
                          [request.id]: { ...draft, note: event.target.value },
                        }))
                      }
                      placeholder="Revize sebebi / admin notu"
                    />
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
  workItems,
  workCategories,
  selectedBuildingId,
  onSelectBuilding,
  onOpenBuilding,
  onSetWorkProgress,
  onSetWorkQuantity,
  onSetWorkWeight,
  onUpdateBuilding,
  onDeleteBuilding,
  onUpdateWorkLabel,
  onAddBuildingWork,
  onDeleteBuildingWork,
}) {
  const [query, setQuery] = useState("");
  const [newWork, setNewWork] = useState(initialNewWork);
  const filteredBuildings = buildings.filter((building) => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    if (!needle) return true;
    return `${building.code} ${building.name} ${building.lineColor}`.toLocaleLowerCase("tr-TR").includes(needle);
  });
  const selectedBuilding = buildings.find((building) => building.id === selectedBuildingId);
  const categoryMeta = getWorkCategoryMeta(workCategories);
  const selectedCategoryProgressItems = selectedBuilding ? getCategoryProgressItems(selectedBuilding, selectedBuilding.works, categoryMeta) : [];
  const selectedWorkGroups = selectedBuilding ? groupWorksByCategory(selectedBuilding.works, categoryMeta) : [];

  return (
    <main className={`buildings-layout ${selectedBuilding ? "" : "list-only"}`}>
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
            <div className="detail-actions">
              <button className="secondary-action" onClick={() => onOpenBuilding(selectedBuilding.id)}>
                <Eye size={16} />
                Popup aç
              </button>
              <button className="icon-button danger" title="Binayı sil" onClick={() => onDeleteBuilding(selectedBuilding.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <div className="building-info-editor wide">
            <label>
              Kod
              <input
                value={selectedBuilding.code}
                onChange={(event) => onUpdateBuilding(selectedBuilding.id, { code: event.target.value })}
              />
            </label>
            <label>
              Bina adı
              <input
                value={selectedBuilding.name}
                onChange={(event) => onUpdateBuilding(selectedBuilding.id, { name: event.target.value })}
              />
            </label>
            <label>
              Hat
              <LineSelect
                value={selectedBuilding.lineColor}
                onChange={(lineColor) => onUpdateBuilding(selectedBuilding.id, { lineColor })}
              />
            </label>
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
              <span>Hakediş grubu</span>
              <strong>{selectedCategoryProgressItems.length}</strong>
            </div>
          </div>
          <div className="category-progress-grid admin">
            {selectedCategoryProgressItems.map((category) => (
              <div key={category.key}>
                <span>{category.label}</span>
                <strong>{category.progress}%</strong>
                <div className="mini-progress">
                  <i style={{ width: `${category.progress}%` }} />
                </div>
              </div>
            ))}
          </div>

          <form
            className="add-work-form"
            onSubmit={(event) => {
              event.preventDefault();
                  onAddBuildingWork(selectedBuilding.id, newWork);
                  setNewWork(initialNewWork);
                }}
              >
            <ReadyWorkSelect
              workItems={workItems}
              value={newWork.sourceWorkKey}
              onChange={(workKey) => setNewWork((previous) => makeNewWorkFromReady(previous, workItems, workKey))}
            />
            <input
              value={newWork.label}
              onChange={(event) => setNewWork((previous) => ({ ...previous, label: event.target.value }))}
              placeholder="Ek iş kalemi adı"
            />
            <input
              type="number"
              min="0"
              value={newWork.quantity}
              onChange={(event) => setNewWork((previous) => ({ ...previous, quantity: event.target.value }))}
              placeholder="Limit %"
            />
            <input
              type="number"
              min="0"
              max="100"
              value={newWork.weight}
              onChange={(event) => setNewWork((previous) => ({ ...previous, weight: event.target.value }))}
              placeholder="Pay %"
            />
            <WorkCategorySelect
              categoryMeta={categoryMeta}
              value={newWork.category}
              onChange={(category) => setNewWork((previous) => ({ ...previous, category }))}
            />
            <button className="secondary-action" type="submit">
              <Plus size={16} />
              Ekle
            </button>
          </form>

          <div className="building-admin-work-list">
            {selectedBuilding.works.length === 0 && <div className="empty-state">Bu bina için iş kalemi yok.</div>}
            {selectedWorkGroups.map((category) => (
              <details className="building-work-category" key={category.key} open>
                <summary>
                  <span>{category.label}</span>
                  <b>{getWorksProgress(selectedBuilding, category.items)}%</b>
                  <ChevronDown size={16} />
                </summary>
                {category.items.map((work) => {
              const value = Number(selectedBuilding.progress?.[work.key] || 0);
              const remaining = getWorkRemainingQuantity(selectedBuilding, work);
              return (
                <article className="building-admin-work-row" key={work.key}>
                  <div>
                    <input
                      className="inline-text-input"
                      value={work.label}
                      onChange={(event) => onUpdateWorkLabel(selectedBuilding.id, work.key, event.target.value)}
                    />
                    <span>
                      Hakediş payı %{formatQuantity(work.weight ?? 0)} · İlerleme %{value} · Kalan %{formatQuantity(remaining)}
                    </span>
                  </div>
                  <label>
                    Talep limiti %
                    <input
                      type="number"
                      min="0"
                      value={work.quantity}
                      onChange={(event) => onSetWorkQuantity(selectedBuilding.id, work.key, event.target.value)}
                    />
                  </label>
                  <label>
                    Hakediş payı %
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
              </details>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function SettingsPanel({
  progressRanges,
  themeSettings,
  onUpdateProgressRange,
  onAddProgressRange,
  onDeleteProgressRange,
  onResetProgressRanges,
  onUpdateThemeColor,
  onResetThemeSettings,
}) {
  const themeLabels = {
    panel: "Panel",
    panelStrong: "Panel üst",
    panelSoft: "Yumuşak zemin",
    line: "Çizgi",
    ink: "Ana yazı",
    textSoft: "Soluk yazı",
    accent: "Ana mavi",
    accentStrong: "Güçlü mavi",
    pageBg: "Sayfa zemini",
  };
  const palettes = sanitizeThemeSettings(themeSettings);

  return (
    <main className="settings-layout">
      <section className="settings-panel">
        <div className="panel-title-row">
          <div>
            <h2>Renk ayarları</h2>
            <p>Harita, popup ve tema renkleri</p>
          </div>
        </div>

        <div className="settings-grid">
          <section className="settings-card">
            <div className="section-heading">
              <div>
                <span>İlerleme paleti</span>
                <strong>{progressRanges.length} dilim</strong>
              </div>
              <div className="split-actions compact-actions">
                <button className="secondary-action" onClick={onAddProgressRange}>
                  <Plus size={16} />
                  Dilim
                </button>
                <button className="secondary-action" onClick={onResetProgressRanges}>
                  Sıfırla
                </button>
              </div>
            </div>
            <div className="range-editor">
              {progressRanges.map((range) => (
                <div className="range-editor-row" key={range.id}>
                  <span className="range-swatch" style={{ background: range.color }} />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={range.min}
                    onChange={(event) => onUpdateProgressRange(range.id, { min: event.target.value })}
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={range.max}
                    onChange={(event) => onUpdateProgressRange(range.id, { max: event.target.value })}
                  />
                  <input
                    type="color"
                    value={range.color}
                    onChange={(event) => onUpdateProgressRange(range.id, { color: event.target.value })}
                  />
                  <button className="icon-button" title="Dilimi sil" onClick={() => onDeleteProgressRange(range.id)}>
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {Object.entries(palettes).map(([mode, palette]) => (
            <section className="settings-card" key={mode}>
              <div className="section-heading">
                <div>
                  <span>{mode === "light" ? "Açık mod" : "Dark mode"}</span>
                  <strong>{mode === "light" ? "Mavi tonlar" : "Siyah taban"}</strong>
                </div>
                <button className="secondary-action" onClick={onResetThemeSettings}>
                  Sıfırla
                </button>
              </div>
              <div className="theme-color-grid">
                {Object.entries(palette).map(([key, value]) => (
                  <label key={key}>
                    <span>{themeLabels[key] || key}</span>
                    <input type="color" value={value} onChange={(event) => onUpdateThemeColor(mode, key, event.target.value)} />
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}

function LogsPanel({ logs }) {
  const sessionLogs = logs.filter((log) => ["Giriş yapıldı", "Çıkış yapıldı"].includes(log.action));

  return (
    <main className="page-panel">
      <div className="panel-title-row">
        <div>
          <h2>Giriş çıkış logları</h2>
          <p>{sessionLogs.length} oturum kaydı</p>
        </div>
      </div>
      <div className="log-list">
        {sessionLogs.length === 0 && <div className="empty-state">Henüz giriş çıkış kaydı yok.</div>}
        {sessionLogs.map((log) => (
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
  workCategories,
  onUpdateUser,
  onTogglePermission,
  onToggleWorkPermission,
  onBulkPermissions,
  onBulkWorkPermissions,
  onAddGlobalWorkItem,
  onAddWorkCategory,
  onUpdateWorkCategory,
  onDeleteWorkCategory,
  onUpdateGlobalWorkItem,
  onDeleteGlobalWorkItem,
  onAddUser,
  onDeleteUser,
}) {
  const [selectedUserId, setSelectedUserId] = useState(users.find((user) => user.role !== "admin")?.id || users[0]?.id);
  const [query, setQuery] = useState("");
  const [newUser, setNewUser] = useState(initialNewUser);
  const [newWorkItem, setNewWorkItem] = useState(initialNewWork);
  const [newCategoryName, setNewCategoryName] = useState("");

  const selectedUser = users.find((user) => user.id === selectedUserId) || users[0];
  const filteredBuildings = buildings.filter((building) => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    if (!needle) return true;
    return `${building.code} ${building.name} ${building.lineColor}`.toLocaleLowerCase("tr-TR").includes(needle);
  });
  const selectedWorkPermissions = getUserWorkPermissions(selectedUser, workItems);
  const visibleWorkItems = workItems.filter((work) => !isForemanHiddenWork(work));
  const categoryMeta = getWorkCategoryMeta(workCategories);
  const visibleWorkGroups = groupWorksByCategory(visibleWorkItems, categoryMeta);
  const editableCategories = Object.entries(categoryMeta)
    .filter(([key]) => !["sihhi", "isitma", "yangin"].includes(key))
    .sort((a, b) => a[1].order - b[1].order);

  function submitNewUser(event) {
    event.preventDefault();
    if (!newUser.name || !newUser.username || !newUser.password) return;
    onAddUser(newUser);
    setNewUser(initialNewUser);
  }

  function submitNewWorkItem(event) {
    event.preventDefault();
    if (!newWorkItem.label.trim()) return;
    onAddGlobalWorkItem(newWorkItem);
    setNewWorkItem(initialNewWork);
  }

  function submitNewCategory(event) {
    event.preventDefault();
    if (!newCategoryName.trim()) return;
    onAddWorkCategory(newCategoryName);
    setNewCategoryName("");
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

          <div className="ready-work-manager">
            <div className="section-heading flat">
              <div>
                <span>Hazır iş kalemleri</span>
                <strong>{visibleWorkItems.length} kalem</strong>
              </div>
            </div>
            <form className="ready-work-form" onSubmit={submitNewWorkItem}>
              <input
                value={newWorkItem.label}
                onChange={(event) => setNewWorkItem((previous) => ({ ...previous, label: event.target.value }))}
                placeholder="Yeni hazır iş kalemi"
              />
              <WorkCategorySelect
                categoryMeta={categoryMeta}
                value={newWorkItem.category}
                onChange={(category) => setNewWorkItem((previous) => ({ ...previous, category }))}
              />
              <button className="secondary-action" type="submit">
                <Plus size={16} />
                Ekle
              </button>
            </form>
            <form className="category-form" onSubmit={submitNewCategory}>
              <input
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                placeholder="Yeni kategori adı"
              />
              <button className="secondary-action" type="submit">
                <Plus size={16} />
                Kategori ekle
              </button>
            </form>
            <div className="category-manager-list">
              {editableCategories.map(([categoryKey, category]) => (
                <div className="category-manager-row" key={`${categoryKey}-${category.label}`}>
                  <input
                    aria-label={`${category.label} kategori adı`}
                    defaultValue={category.label}
                    onBlur={(event) => onUpdateWorkCategory(categoryKey, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                  />
                  <button
                    className="icon-button danger"
                    type="button"
                    title={`${category.label} kategorisini sil`}
                    disabled={editableCategories.length <= 1}
                    onClick={() => onDeleteWorkCategory(categoryKey)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <div className="ready-work-list">
              {visibleWorkGroups.map((category) => (
                <details className="category-work-section" key={category.key} open>
                  <summary>
                    <span>{category.label}</span>
                    <b>{category.items.length} kalem</b>
                    <ChevronDown size={16} />
                  </summary>
                  <div className="ready-work-list-inner">
                    {category.items.map((work) => (
                      <span className="ready-work-edit-row" key={work.key}>
                        <input
                          aria-label={`${work.label} iş kalemi adı`}
                          key={`${work.key}-${work.label}`}
                          defaultValue={work.label}
                          onBlur={(event) => onUpdateGlobalWorkItem(work.key, { label: event.target.value })}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") event.currentTarget.blur();
                          }}
                        />
                        <WorkCategorySelect
                          categoryMeta={categoryMeta}
                          value={getWorkCategory(work)}
                          onChange={(category) => onUpdateGlobalWorkItem(work.key, { category })}
                        />
                        <button
                          className="icon-button danger"
                          type="button"
                          title="Hazır iş kalemini sil"
                          onClick={() => onDeleteGlobalWorkItem(work.key)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </span>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>

          {selectedUser.role !== "admin" && (
            <>
              <div className="work-permission-panel">
                <div className="section-heading flat">
                  <div>
                    <span>İş kalemi izinleri</span>
                    <strong>{selectedWorkPermissions.filter((key) => visibleWorkItems.some((work) => work.key === key)).length} iş</strong>
                  </div>
                  <div className="permission-actions">
                    <button onClick={() => onBulkWorkPermissions(selectedUser.id, "all")}>Tümü</button>
                    <button onClick={() => onBulkWorkPermissions(selectedUser.id, "clear")}>Temizle</button>
                  </div>
                </div>
                <div className="work-permission-grid">
                  {visibleWorkGroups.map((category) => (
                    <details className="category-work-section permission-category" key={category.key} open>
                      <summary>
                        <span>{category.label}</span>
                        <b>
                          {category.items.filter((work) => selectedWorkPermissions.includes(work.key)).length}/{category.items.length}
                        </b>
                        <div className="category-actions">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              onBulkWorkPermissions(selectedUser.id, { type: "add", keys: category.items.map((work) => work.key) });
                            }}
                          >
                            Seç
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              onBulkWorkPermissions(selectedUser.id, { type: "remove", keys: category.items.map((work) => work.key) });
                            }}
                          >
                            Temizle
                          </button>
                        </div>
                        <ChevronDown size={16} />
                      </summary>
                      <div className="work-permission-grid-inner">
                        {category.items.map((work) => {
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
                    </details>
                  ))}
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
