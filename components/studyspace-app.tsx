"use client";

import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ClipboardCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  EyeOff,
  File,
  FileText,
  Files,
  GraduationCap,
  Home,
  LogOut,
  MapPin,
  Paperclip,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Timer,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useDragControls,
} from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ExamPage } from "@/components/exam-page";
import { StudyPage } from "@/components/study-page";
import { DayTasks } from "@/components/day-tasks";
import { ThemeSelect } from "@/components/theme-select";
import type {
  ColorTone,
  CourseRecord,
  MaterialRecord,
  SchedulePayload,
  ScheduleRecord,
  UserProfile,
} from "@/lib/models";

type Section = "ringkasan" | "jadwal" | "kuliah" | "materi" | "ujian" | "belajar" | "berkas";
type CalendarMode = "minggu" | "hari";
type FormMode =
  | { kind: "buat"; date: string }
  | { kind: "edit"; schedule: ScheduleRecord }
  | null;
type Toast = { id: number; message: string; error?: boolean };

const JAM_AWAL = 7;
const JAM_AKHIR = 19;
const TINGGI_JAM = 72;
const HARI_PENDEK = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const HARI_PANJANG = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];
const spring = { type: "spring" as const, bounce: 0, duration: 0.38 };
const MOBILE_QUERY = "(max-width: 960px)";
const COLOR_LABEL: Record<ColorTone, string> = {
  berry: "Merah",
  violet: "Ungu",
  lime: "Hijau",
  sky: "Biru",
  orange: "Oranye",
};

function subscribeMobileLayout(callback: () => void) {
  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getMobileLayoutSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function useMobileLayout() {
  return useSyncExternalStore(
    subscribeMobileLayout,
    getMobileLayoutSnapshot,
    () => false,
  );
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const offset = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - offset);
  next.setHours(12, 0, 0, 0);
  return next;
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(fromDateKey(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
  }).format(fromDateKey(value));
}

function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function fileKind(name: string) {
  const extension = name.split(".").pop()?.toUpperCase();
  return extension && extension.length <= 5 ? extension : "FILE";
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "U"
  );
}

export default function StudySpaceApp() {
  const today = useMemo(() => new Date(), []);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [section, setSection] = useState<Section>("ringkasan");
  const [mode, setMode] = useState<CalendarMode>("minggu");
  const [activeDate, setActiveDate] = useState(today);
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [materialOpen, setMaterialOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [mobileSearch, setMobileSearch] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const weekStart = useMemo(() => startOfWeek(activeDate), [activeDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const activeKey = toDateKey(activeDate);

  const range = useMemo(() => {
    if (section === "kuliah" || section === "berkas") {
      const year = activeDate.getFullYear();
      const startYear = activeDate.getMonth() >= 7 ? year : year - 1;
      return {
        start: `${startYear}-08-01`,
        end: `${startYear + 1}-02-28`,
      };
    }
    if (mode === "hari") return { start: activeKey, end: activeKey };
    return {
      start: toDateKey(weekStart),
      end: toDateKey(addDays(weekStart, 6)),
    };
  }, [activeDate, activeKey, mode, section, weekStart]);

  const notify = useCallback((text: string, error = false) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message: text, error }]);
    window.setTimeout(
      () => setToasts((current) => current.filter((item) => item.id !== id)),
      2800,
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!cancelled) setUser(body?.user ?? null);
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/schedules?start=${range.start}&end=${range.end}`,
        { cache: "no-store" },
      );
      const body = await response.json();
      if (response.status === 401) {
        setUser(null);
        return;
      }
      if (!response.ok)
        throw new Error(body.message || "Data belum bisa dibuka.");
      setSchedules(body.schedules);
      setCourses(body.courses);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Data belum bisa dibuka.",
      );
    } finally {
      setLoading(false);
    }
  }, [range.end, range.start, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch(`/api/schedules?start=${range.start}&end=${range.end}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json();
        if (response.status === 401) {
          if (!cancelled) setUser(null);
          return null;
        }
        if (!response.ok)
          throw new Error(body.message || "Data belum bisa dibuka.");
        return body;
      })
      .then((body) => {
        if (cancelled || !body) return;
        setSchedules(body.schedules);
        setCourses(body.courses);
        setMessage("");
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setMessage(
            error instanceof Error ? error.message : "Data belum bisa dibuka.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range.end, range.start, user]);

  const loadMaterials = useCallback(async () => {
    if (!user) return;
    setMaterialsLoading(true);
    try {
      const response = await fetch("/api/materials", { cache: "no-store" });
      const body = await response.json();
      if (response.status === 401) {
        setUser(null);
        return;
      }
      if (!response.ok) throw new Error(body.message || "Materi belum bisa dibuka.");
      setMaterials(body.materials ?? []);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Materi belum bisa dibuka.",
        true,
      );
    } finally {
      setMaterialsLoading(false);
    }
  }, [notify, user]);

  useEffect(() => {
    if (!user) return;
    void loadMaterials();
  }, [loadMaterials, user]);

  useEffect(() => {
    const openCreate = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === "c" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement)
      ) {
        setFormMode({ kind: "buat", date: activeKey });
      }
      if (event.key === "Escape") {
        setFormMode(null);
        setSelectedId(null);
        setMaterialOpen(false);
      }
    };
    window.addEventListener("keydown", openCreate);
    return () => window.removeEventListener("keydown", openCreate);
  }, [activeKey]);

  useEffect(() => {
    document.body.style.overflow = formMode || selectedId || materialOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [formMode, materialOpen, selectedId]);

  const selected = schedules.find((item) => item.id === selectedId) ?? null;
  const filteredSchedules = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("id-ID");
    if (!value) return schedules;
    return schedules.filter((item) =>
      `${item.title} ${item.courseCode ?? ""} ${item.location ?? ""}`
        .toLocaleLowerCase("id-ID")
        .includes(value),
    );
  }, [query, schedules]);

  const moveDate = (direction: number) => {
    const amount = mode === "minggu" ? 7 : 1;
    setActiveDate((current) => addDays(current, direction * amount));
  };

  const goToSection = (next: Section) => {
    setSection(next);
    setMobileMenu(false);
    setMobileSearch(false);
    setQuery("");
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setSchedules([]);
    setCourses([]);
    setMaterials([]);
    setMaterialOpen(false);
    setSection("ringkasan");
  };

  if (authLoading) return <AppLoading />;
  if (!user) return <AuthScreen onAuthenticated={setUser} />;

  return (
    <MotionConfig reducedMotion="user">
      <div className="study-app">
        <Sidebar
          section={section}
          user={user}
          onChange={goToSection}
          onCreate={() => setFormMode({ kind: "buat", date: activeKey })}
          onLogout={() => void logout()}
        />
        <div className="study-main">
          <Topbar
            section={section}
            user={user}
            query={query}
            setQuery={setQuery}
            onAccount={() => setMobileMenu(true)}
            onSearch={() => setMobileSearch((current) => !current)}
            searching={mobileSearch}
          />
          <AnimatePresence>
            {mobileSearch && (
              <motion.label
                className="mobile-search-panel"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={spring}
              >
                <Search size={18} />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    section === "materi"
                      ? "Cari nama file atau mata kuliah"
                      : section === "ujian"
                        ? "Cari topik atau mata kuliah"
                      : section === "belajar"
                        ? "Cari riwayat belajar"
                        : "Cari nama kelas atau ruang"
                  }
                />
                <button
                  onClick={() => {
                    setQuery("");
                    setMobileSearch(false);
                  }}
                  aria-label="Tutup pencarian"
                >
                  <X size={17} />
                </button>
              </motion.label>
            )}
          </AnimatePresence>

          <main className="content-shell">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={section}
                initial={{ opacity: 0, y: 7 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={spring}
              >
                {section === "ringkasan" && (
                  <OverviewPage
                    user={user}
                    today={today}
                    schedules={filteredSchedules}
                    courses={courses}
                    loading={loading}
                    onCreate={() =>
                      setFormMode({ kind: "buat", date: activeKey })
                    }
                    onSelect={setSelectedId}
                    onNavigate={goToSection}
                  />
                )}
                {section === "jadwal" && (
                  <CalendarPage
                    today={today}
                    activeDate={activeDate}
                    setActiveDate={setActiveDate}
                    weekDays={weekDays}
                    mode={mode}
                    setMode={setMode}
                    schedules={filteredSchedules}
                    courses={courses}
                    loading={loading}
                    error={message}
                    onMove={moveDate}
                    onToday={() => setActiveDate(today)}
                    onCreate={(date) => setFormMode({ kind: "buat", date })}
                    onSelect={setSelectedId}
                    notify={notify}
                  />
                )}
                {section === "kuliah" && (
                  <CoursesPage
                    courses={courses}
                    schedules={filteredSchedules}
                    loading={loading}
                  />
                )}
                {section === "ujian" && (
                  <ExamPage
                    materials={materials}
                    query={query}
                    loading={materialsLoading}
                  />
                )}
                {section === "materi" && (
                  <MaterialsPage
                    courses={courses}
                    materials={materials}
                    query={query}
                    loading={materialsLoading}
                    onAdd={() => setMaterialOpen(true)}
                    onChanged={async (text, error) => {
                      notify(text, error);
                      await Promise.all([loadMaterials(), refresh()]);
                    }}
                  />
                )}
                {section === "belajar" && (
                  <StudyPage
                    courses={courses}
                    materials={materials}
                    query={query}
                    notify={notify}
                  />
                )}
                {section === "berkas" && (
                  <FilesPage
                    schedules={filteredSchedules}
                    loading={loading}
                    onSelect={setSelectedId}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        <MobileNav section={section} onChange={goToSection} />

        <AnimatePresence>
          {mobileMenu && (
            <AccountSheet
              user={user}
              onClose={() => setMobileMenu(false)}
              onLogout={() => void logout()}
            />
          )}
          {formMode && (
            <ScheduleForm
              mode={formMode}
              courses={courses}
              onClose={() => setFormMode(null)}
              onSaved={async (text) => {
                setFormMode(null);
                notify(text);
                await refresh();
              }}
            />
          )}
          {materialOpen && (
            <MaterialForm
              courses={courses}
              initialDate={activeKey}
              onClose={() => setMaterialOpen(false)}
              onSaved={async (text) => {
                setMaterialOpen(false);
                notify(text);
                await loadMaterials();
              }}
            />
          )}
          {selected && (
            <ScheduleDetail
              schedule={selected}
              onClose={() => setSelectedId(null)}
              onEdit={() => {
                setFormMode({ kind: "edit", schedule: selected });
                setSelectedId(null);
              }}
              onChanged={async (text, error) => {
                notify(text, error);
                await Promise.all([refresh(), loadMaterials()]);
              }}
              onDeleted={async () => {
                setSelectedId(null);
                notify("Jadwal sudah dihapus.");
                await Promise.all([refresh(), loadMaterials()]);
              }}
            />
          )}
        </AnimatePresence>

        <div className="toast-area" aria-live="polite">
          <AnimatePresence>
            {toasts.map((toast) => (
              <motion.div
                key={toast.id}
                className={`app-toast ${toast.error ? "error" : ""}`}
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                transition={spring}
              >
                <span>
                  {toast.error ? (
                    <X size={14} />
                  ) : (
                    <Check size={14} strokeWidth={3} />
                  )}
                </span>
                {toast.message}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}

function AppLoading() {
  return (
    <div className="app-loading">
      <Logo />
      <span />
    </div>
  );
}

function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (user: UserProfile) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.message || "Belum berhasil. Coba lagi.");
      onAuthenticated(body.user);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Belum berhasil. Coba lagi.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-showcase">
        <div className="auth-brand">
          <Logo />
        </div>
        <div className="auth-preview-card">
          <span className="auth-preview-orb one" />
          <span className="auth-preview-orb two" />
          <div className="auth-preview-foot">
            <b>
              <ArrowRight size={18} />
            </b>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-form-wrap">
          <div className="auth-mobile-logo">
            <Logo />
          </div>
          <span className="auth-shield">
            <ShieldCheck size={19} />
          </span>
          <h2>Selamat datang</h2>
          <form
            className="auth-form"
            onSubmit={submit}
            method="post"
            action="/api/auth/login"
            autoComplete="on"
          >
            <label>
              <span>Username</span>
              <input
                name="username"
                id="username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Username"
                required
              />
            </label>
            <label>
              <span>Kata sandi</span>
              <div className="password-input">
                <input
                  name="password"
                  id="current-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Kata sandi"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword ? "Sembunyikan kata sandi" : "Lihat kata sandi"
                  }
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            {error && (
              <div className="auth-error">
                <X size={15} />
                {error}
              </div>
            )}
            <button className="auth-submit" disabled={submitting}>
              {submitting ? "Tunggu sebentar..." : "Masuk"}
              <ArrowRight size={17} />
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function Logo() {
  return (
    <div className="app-logo">
      <span className="logo-mark">
        <i />
        <i />
      </span>
      <strong>StudySpace</strong>
    </div>
  );
}

function Sidebar({
  section,
  user,
  onChange,
  onCreate,
  onLogout,
}: {
  section: Section;
  user: UserProfile;
  onChange: (value: Section) => void;
  onCreate: () => void;
  onLogout: () => void;
}) {
  const links: { value: Section; label: string; icon: typeof CalendarDays }[] =
    [
      { value: "ringkasan", label: "Beranda", icon: Home },
      { value: "jadwal", label: "Jadwal", icon: CalendarDays },
      { value: "kuliah", label: "Mata kuliah", icon: GraduationCap },
      { value: "materi", label: "Materi", icon: BookOpen },
      { value: "ujian", label: "Ujian", icon: ClipboardCheck },
      { value: "belajar", label: "Belajar", icon: Timer },
      { value: "berkas", label: "File", icon: Files },
    ];
  return (
    <aside className="app-sidebar">
      <Logo />
      <button className="create-button" onClick={onCreate}>
        <Plus size={19} /> Buat jadwal
      </button>
      <nav className="main-nav">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <button
              key={link.value}
              className={section === link.value ? "active" : ""}
              onClick={() => onChange(link.value)}
            >
              <Icon size={19} />
              <span>{link.label}</span>
              {section === link.value && (
                <motion.i layoutId="active-nav" transition={spring} />
              )}
            </button>
          );
        })}
      </nav>
      <div className="user-row">
        <span className="avatar">{initials(user.name)}</span>
        <div>
          <strong>{user.name}</strong>
          <small>{user.username}</small>
        </div>
        <button className="logout-icon" onClick={onLogout} aria-label="Keluar">
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}

function Topbar({
  section,
  user,
  query,
  setQuery,
  onAccount,
  onSearch,
  searching,
}: {
  section: Section;
  user: UserProfile;
  query: string;
  setQuery: (value: string) => void;
  onAccount: () => void;
  onSearch: () => void;
  searching: boolean;
}) {
  const titles: Record<Section, string> = {
    ringkasan: "Beranda",
    jadwal: "Jadwal",
    kuliah: "Mata kuliah",
    materi: "Materi",
    ujian: "Ujian",
    belajar: "Belajar",
    berkas: "File",
  };
  return (
    <header className="app-topbar">
      <div className="mobile-page-title">
        <small>StudySpace</small>
        <strong>{titles[section]}</strong>
      </div>
      <label className="global-search">
        <Search size={17} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={
            section === "materi"
              ? "Cari nama file atau mata kuliah"
              : section === "ujian"
                ? "Cari topik atau mata kuliah"
              : section === "belajar"
                ? "Cari riwayat belajar"
                : "Cari nama kelas atau ruang"
          }
        />
      </label>
      <div className="topbar-actions">
        <button
          className={`mobile-search-trigger ${searching ? "active" : ""}`}
          onClick={onSearch}
          aria-label={searching ? "Tutup pencarian" : "Cari"}
        >
          {searching ? <X size={19} /> : <Search size={19} />}
        </button>
        <button
          className="mobile-avatar-button"
          onClick={onAccount}
          aria-label="Buka akun"
        >
          <span className="avatar">{initials(user.name)}</span>
        </button>
      </div>
    </header>
  );
}

function MobileNav({
  section,
  onChange,
}: {
  section: Section;
  onChange: (value: Section) => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="Navigasi utama">
      <button
        className={section === "ringkasan" ? "active" : ""}
        onClick={() => onChange("ringkasan")}
        aria-current={section === "ringkasan" ? "page" : undefined}
      >
        <Home size={21} />
        <span>Beranda</span>
      </button>
      <button
        className={section === "jadwal" ? "active" : ""}
        onClick={() => onChange("jadwal")}
        aria-current={section === "jadwal" ? "page" : undefined}
      >
        <CalendarDays size={21} />
        <span>Jadwal</span>
      </button>
      <button
        className={section === "ujian" ? "active" : ""}
        onClick={() => onChange("ujian")}
        aria-current={section === "ujian" ? "page" : undefined}
      >
        <ClipboardCheck size={21} />
        <span>Ujian</span>
      </button>
      <button
        className={section === "belajar" ? "active" : ""}
        onClick={() => onChange("belajar")}
        aria-current={section === "belajar" ? "page" : undefined}
      >
        <Timer size={21} />
        <span>Belajar</span>
      </button>
      <button
        className={section === "materi" ? "active" : ""}
        onClick={() => onChange("materi")}
        aria-current={section === "materi" ? "page" : undefined}
      >
        <BookOpen size={21} />
        <span>Materi</span>
      </button>
      <button
        className={section === "kuliah" ? "active" : ""}
        onClick={() => onChange("kuliah")}
        aria-current={section === "kuliah" ? "page" : undefined}
      >
        <GraduationCap size={21} />
        <span>Kuliah</span>
      </button>
    </nav>
  );
}

function AccountSheet({
  user,
  onClose,
  onLogout,
}: {
  user: UserProfile;
  onClose: () => void;
  onLogout: () => void;
}) {
  return (
    <motion.div
      className="menu-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <motion.aside
        className="account-sheet"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={spring}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-sheet-title"
      >
        <span className="sheet-handle" />
        <div className="account-head">
          <h2 id="account-sheet-title">Akun</h2>
          <button onClick={onClose} aria-label="Tutup">
            <X size={20} />
          </button>
        </div>
        <div className="account-identity">
          <span className="avatar">{initials(user.name)}</span>
          <span>
            <strong>{user.name}</strong>
            <small>{user.username}</small>
          </span>
        </div>
        <button className="account-logout" onClick={onLogout}>
          <LogOut size={18} /> Keluar dari akun
        </button>
      </motion.aside>
    </motion.div>
  );
}

function OverviewPage({
  user,
  today,
  schedules,
  courses,
  loading,
  onCreate,
  onSelect,
  onNavigate,
}: {
  user: UserProfile;
  today: Date;
  schedules: ScheduleRecord[];
  courses: CourseRecord[];
  loading: boolean;
  onCreate: () => void;
  onSelect: (id: number) => void;
  onNavigate: (section: Section) => void;
}) {
  const todayKey = toDateKey(today);
  const todaySchedules = schedules.filter((item) => item.date === todayKey);
  const nextSchedule = todaySchedules[0] ?? schedules[0] ?? null;

  if (loading)
    return (
      <section className="overview-page">
        <CalendarSkeleton />
      </section>
    );

  return (
    <section className="overview-page">
      <div className="overview-welcome">
        <div>
          <p className="overline">
            <span className="welcome-dot" /> {formatLongDate(todayKey)}
          </p>
          <h1>
            {greeting(today)}, {user.name.split(" ")[0]}
          </h1>
        </div>
      </div>

      <div className="overview-hero">
        {nextSchedule ? (
          <motion.button
            className="overview-next-card"
            onClick={() => onSelect(nextSchedule.id)}
            whileTap={{ scale: 0.985 }}
          >
            <span className="overview-orb one" />
            <span className="overview-orb two" />
            <div className="next-card-head">
              <span>
                <i /> Kelas terdekat
              </span>
              <b>
                {nextSchedule.date === todayKey
                  ? "Hari ini"
                  : formatShortDate(nextSchedule.date)}
              </b>
            </div>
            <div className="next-card-copy">
              <small>{nextSchedule.courseCode || "Jadwal"}</small>
              <h2>{nextSchedule.title}</h2>
              <p>
                <Clock3 size={16} /> {nextSchedule.startTime}–
                {nextSchedule.endTime}
                {nextSchedule.location ? (
                  <>
                    <i />
                    {nextSchedule.location}
                  </>
                ) : null}
              </p>
            </div>
            <div className="next-card-foot">
              <span>Buka detail</span>
              <i>
                <ArrowRight size={18} />
              </i>
            </div>
          </motion.button>
        ) : (
          <button className="overview-next-card empty" onClick={onCreate}>
            <span className="overview-orb one" />
            <span className="overview-orb two" />
            <div className="next-card-copy">
              <h2>Belum ada jadwal</h2>
            </div>
            <div className="next-card-foot">
              <span>Buat jadwal</span>
              <i>
                <Plus size={18} />
              </i>
            </div>
          </button>
        )}
      </div>

      <div className="overview-lower-grid">
        <div>
          <div className="overview-section-head">
            <h2>Hari ini</h2>
            <button onClick={() => onNavigate("jadwal")}>
              Lihat semua <ChevronRight size={16} />
            </button>
          </div>
          <div className="today-schedule-card">
            {todaySchedules.length ? (
              todaySchedules.map((item) => (
                <button key={item.id} onClick={() => onSelect(item.id)}>
                  <span className="today-time">
                    <strong>{item.startTime}</strong>
                    <small>{item.endTime}</small>
                  </span>
                  <i className={`schedule-accent ${item.color}`} />
                  <span className="today-copy">
                    <strong>{item.title}</strong>
                    <small>
                      {[
                        item.location,
                        item.attachments.length > 0
                          ? `${item.attachments.length} file`
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                  <ChevronRight size={18} />
                </button>
              ))
            ) : (
              <div className="overview-empty">
                <CalendarDays size={23} />
                <span>
                  <strong>Hari ini belum ada kelas</strong>
                </span>
                <button onClick={onCreate}>Tambah</button>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="overview-section-head">
            <h2>Mata kuliah</h2>
            <button onClick={() => onNavigate("kuliah")}>
              Lihat semua <ChevronRight size={16} />
            </button>
          </div>
          <div className="quick-course-card">
            {courses.length ? (
              courses.slice(0, 4).map((course) => {
                const related = schedules.filter(
                  (item) => item.courseId === course.id,
                );
                return (
                  <button
                    key={course.id}
                    className="quick-course-row"
                    onClick={() => onNavigate("kuliah")}
                  >
                    <span className={`quick-course-icon ${course.color}`}>
                      <BookOpen size={18} />
                    </span>
                    <span>
                      <small>{course.code}</small>
                      <strong>{course.name}</strong>
                    </span>
                    <b>{related.length} jadwal</b>
                  </button>
                );
              })
            ) : (
              <div className="overview-empty">
                <BookOpen size={22} />
                <span>
                  <strong>Belum ada mata kuliah</strong>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function CalendarPage({
  today,
  activeDate,
  setActiveDate,
  weekDays,
  mode,
  setMode,
  schedules,
  courses,
  loading,
  error,
  onMove,
  onToday,
  onCreate,
  onSelect,
  notify,
}: {
  today: Date;
  activeDate: Date;
  setActiveDate: (date: Date) => void;
  weekDays: Date[];
  mode: CalendarMode;
  setMode: (mode: CalendarMode) => void;
  schedules: ScheduleRecord[];
  courses: CourseRecord[];
  loading: boolean;
  error: string;
  onMove: (direction: number) => void;
  onToday: () => void;
  onCreate: (date: string) => void;
  onSelect: (id: number) => void;
  notify: (text: string, error?: boolean) => void;
}) {
  const activeKey = toDateKey(activeDate);
  const daySchedules = schedules.filter((item) => item.date === activeKey);
  return (
    <section className="calendar-page">
      <div className="page-header jadwal-header">
        <div>
          <h1>{formatMonth(activeDate)}</h1>
        </div>
        <button className="material-add" onClick={() => onCreate(activeKey)}>
          <Plus size={18} /> Buat jadwal
        </button>
      </div>
      <div className="calendar-toolbar">
        <div className="date-actions">
          <button className="today-button" onClick={onToday}>
            Hari ini
          </button>
          <button
            className="arrow-button"
            onClick={() => onMove(-1)}
            aria-label="Sebelumnya"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="arrow-button"
            onClick={() => onMove(1)}
            aria-label="Berikutnya"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="view-switch">
          <button
            className={mode === "minggu" ? "active" : ""}
            onClick={() => setMode("minggu")}
          >
            Minggu
          </button>
          <button
            className={mode === "hari" ? "active" : ""}
            onClick={() => setMode("hari")}
          >
            Hari
          </button>
        </div>
      </div>
      <WeekStrip
        days={weekDays}
        today={today}
        activeDate={activeDate}
        setActiveDate={setActiveDate}
      />
      {error && (
        <div className="error-banner">
          <X size={17} />
          {error}
        </div>
      )}
      {loading ? (
        <CalendarSkeleton />
      ) : mode === "minggu" ? (
        <WeekCalendar
          days={weekDays}
          today={today}
          schedules={schedules}
          onSelect={onSelect}
          onCreate={onCreate}
          setActiveDate={setActiveDate}
        />
      ) : (
        <DayCalendar
          date={activeDate}
          schedules={daySchedules}
          onSelect={onSelect}
          onCreate={onCreate}
        />
      )}
      <MobileAgenda
        date={activeDate}
        schedules={daySchedules}
        onSelect={onSelect}
        onCreate={onCreate}
      />
      <DayTasks date={activeKey} courses={courses} notify={notify} />
    </section>
  );
}

function WeekStrip({
  days,
  today,
  activeDate,
  setActiveDate,
}: {
  days: Date[];
  today: Date;
  activeDate: Date;
  setActiveDate: (date: Date) => void;
}) {
  return (
    <div className="week-strip">
      {days.map((day) => {
        const active = toDateKey(day) === toDateKey(activeDate);
        const isToday = toDateKey(day) === toDateKey(today);
        return (
          <button
            key={toDateKey(day)}
            className={`${active ? "active" : ""} ${isToday ? "today" : ""}`}
            onClick={() => setActiveDate(day)}
          >
            <span>{HARI_PENDEK[day.getDay()]}</span>
            <strong>{day.getDate()}</strong>
            {isToday && <i />}
          </button>
        );
      })}
    </div>
  );
}

function WeekCalendar({
  days,
  today,
  schedules,
  onSelect,
  onCreate,
  setActiveDate,
}: {
  days: Date[];
  today: Date;
  schedules: ScheduleRecord[];
  onSelect: (id: number) => void;
  onCreate: (date: string) => void;
  setActiveDate: (date: Date) => void;
}) {
  const hours = Array.from(
    { length: JAM_AKHIR - JAM_AWAL + 1 },
    (_, index) => JAM_AWAL + index,
  );
  return (
    <div className="calendar-card desktop-calendar">
      <div className="calendar-days-head">
        <span className="timezone">Jam</span>
        {days.map((day) => (
          <button
            key={toDateKey(day)}
            className={toDateKey(day) === toDateKey(today) ? "today" : ""}
            onClick={() => setActiveDate(day)}
          >
            <span>{HARI_PENDEK[day.getDay()]}</span>
            <strong>{day.getDate()}</strong>
          </button>
        ))}
      </div>
      <div className="calendar-scroll">
        <div className="time-column">
          {hours.map((hour) => (
            <span
              key={hour}
              style={{ top: `${(hour - JAM_AWAL) * TINGGI_JAM}px` }}
            >
              {pad(hour)}.00
            </span>
          ))}
        </div>
        <div className="days-grid">
          {days.map((day) => {
            const key = toDateKey(day);
            const events = schedules.filter((item) => item.date === key);
            return (
              <div
                className={`day-column ${key === toDateKey(today) ? "today" : ""}`}
                key={key}
              >
                {hours.slice(0, -1).map((hour) => (
                  <button
                    key={hour}
                    className="hour-cell"
                    onDoubleClick={() => onCreate(key)}
                    aria-label={`Tambah jadwal pukul ${hour}`}
                  />
                ))}
                {events.map((item) => (
                  <CalendarEvent
                    key={item.id}
                    schedule={item}
                    onClick={() => onSelect(item.id)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CalendarEvent({
  schedule,
  onClick,
}: {
  schedule: ScheduleRecord;
  onClick: () => void;
}) {
  const start = Math.max(minutes(schedule.startTime), JAM_AWAL * 60);
  const end = Math.min(minutes(schedule.endTime), JAM_AKHIR * 60);
  const top = ((start - JAM_AWAL * 60) / 60) * TINGGI_JAM;
  const height = Math.max(((end - start) / 60) * TINGGI_JAM, 38);
  return (
    <motion.button
      className={`calendar-event tone-${schedule.color}`}
      style={{ top, height }}
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
    >
      <span>{schedule.startTime}</span>
      <strong>{schedule.title}</strong>
      {schedule.location && <small>{schedule.location}</small>}
      {schedule.attachments.length > 0 && (
        <i>
          <Paperclip size={10} />
          {schedule.attachments.length}
        </i>
      )}
    </motion.button>
  );
}

function DayCalendar({
  date,
  schedules,
  onSelect,
  onCreate,
}: {
  date: Date;
  schedules: ScheduleRecord[];
  onSelect: (id: number) => void;
  onCreate: (date: string) => void;
}) {
  const hours = Array.from(
    { length: JAM_AKHIR - JAM_AWAL + 1 },
    (_, index) => JAM_AWAL + index,
  );
  return (
    <div className="calendar-card day-calendar desktop-calendar">
      <div className="day-title">
        <span>{HARI_PANJANG[date.getDay()]}</span>
        <strong>{date.getDate()}</strong>
        <small>{formatMonth(date)}</small>
      </div>
      <div className="calendar-scroll">
        <div className="time-column">
          {hours.map((hour) => (
            <span
              key={hour}
              style={{ top: `${(hour - JAM_AWAL) * TINGGI_JAM}px` }}
            >
              {pad(hour)}.00
            </span>
          ))}
        </div>
        <div className="single-day-column">
          {hours.slice(0, -1).map((hour) => (
            <button
              key={hour}
              className="hour-cell"
              onDoubleClick={() => onCreate(toDateKey(date))}
            />
          ))}
          {schedules.map((item) => (
            <CalendarEvent
              key={item.id}
              schedule={item}
              onClick={() => onSelect(item.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileAgenda({
  date,
  schedules,
  onSelect,
  onCreate,
}: {
  date: Date;
  schedules: ScheduleRecord[];
  onSelect: (id: number) => void;
  onCreate: (date: string) => void;
}) {
  return (
    <div className="mobile-agenda">
      <div className="agenda-head">
        <div>
          <span>{HARI_PANJANG[date.getDay()]}</span>
          <strong>{formatShortDate(toDateKey(date))}</strong>
        </div>
      </div>
      {schedules.length ? (
        schedules.map((item) => (
          <button
            className="agenda-item"
            key={item.id}
            onClick={() => onSelect(item.id)}
          >
            <span className={`agenda-line ${item.color}`} />
            <span className="agenda-time">
              <strong>{item.startTime}</strong>
              <small>{item.endTime}</small>
            </span>
            <span className="agenda-copy">
              <strong>{item.title}</strong>
              <small>
                {[
                  item.location,
                  item.attachments.length > 0
                    ? `${item.attachments.length} file`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </span>
            <ChevronRight size={18} />
          </button>
        ))
      ) : (
        <div className="empty-agenda">
          <CalendarDays size={25} />
          <strong>Hari ini belum ada kelas</strong>
          <button onClick={() => onCreate(toDateKey(date))}>Buat jadwal</button>
        </div>
      )}
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="calendar-skeleton">
      <div />
      <div />
      <div />
      <div />
    </div>
  );
}

function CoursesPage({
  courses,
  schedules,
  loading,
}: {
  courses: CourseRecord[];
  schedules: ScheduleRecord[];
  loading: boolean;
}) {
  return (
    <section className="simple-page">
      <div className="page-header">
        <div>
          <h1>Mata kuliah</h1>
        </div>
      </div>
      {loading ? (
        <CalendarSkeleton />
      ) : (
        <div className="course-list">
          {courses.length ? (
            courses.map((course) => {
              const related = schedules.filter(
                (item) => item.courseId === course.id,
              );
              const files = related.reduce(
                (total, item) => total + item.attachments.length,
                0,
              );
              return (
                <article className="course-row" key={course.id}>
                  <i className={`schedule-accent ${course.color}`} />
                  <div>
                    <strong>{course.name}</strong>
                    <small>
                      {[
                        course.code,
                        course.lecturer,
                        `${related.length} jadwal`,
                        `${files} file`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="page-empty">
              <GraduationCap size={28} />
              <strong>Belum ada mata kuliah</strong>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function FilesPage({
  schedules,
  loading,
  onSelect,
}: {
  schedules: ScheduleRecord[];
  loading: boolean;
  onSelect: (id: number) => void;
}) {
  const files = schedules.flatMap((schedule) =>
    schedule.attachments.map((file) => ({ file, schedule })),
  );
  return (
    <section className="simple-page">
      <div className="page-header">
        <div>
          <h1>File</h1>
        </div>
      </div>
      {loading ? (
        <CalendarSkeleton />
      ) : files.length ? (
        <div className="files-table">
          <div className="files-head">
            <span>Nama</span>
            <span>Jadwal</span>
            <span>Jenis</span>
            <span />
          </div>
          {files.map(({ file, schedule }) => (
            <div className="file-row" key={file.id}>
              <span className="file-main">
                <i className={`file-icon ${schedule.color}`}>
                  <FileText size={19} />
                </i>
                <span>
                  <strong>{file.originalName}</strong>
                  <small>{formatBytes(file.sizeBytes)}</small>
                </span>
              </span>
              <button
                className="file-schedule"
                onClick={() => onSelect(schedule.id)}
              >
                {schedule.title}
              </button>
              <span className={`type-tag ${file.category}`}>
                {file.category}
              </span>
              <a
                href={`/api/files/${file.id}`}
                aria-label={`Unduh ${file.originalName}`}
              >
                <Download size={17} />
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="page-empty">
          <Files size={28} />
          <strong>Belum ada file</strong>
        </div>
      )}
    </section>
  );
}

function MaterialsPage({
  courses,
  materials,
  query,
  loading,
  onAdd,
  onChanged,
}: {
  courses: CourseRecord[];
  materials: MaterialRecord[];
  query: string;
  loading: boolean;
  onAdd: () => void;
  onChanged: (message: string, error?: boolean) => Promise<void>;
}) {
  const [courseId, setCourseId] = useState<number | "semua">("semua");
  const needle = query.trim().toLocaleLowerCase("id-ID");
  const visible = materials.filter((item) => {
    if (courseId !== "semua" && item.courseId !== courseId) return false;
    if (!needle) return true;
    return `${item.topic ?? ""} ${item.originalName} ${item.courseName ?? ""} ${item.courseCode ?? ""} ${item.note ?? ""} ${item.scheduleTitle ?? ""} ${item.mtNumber ? `MT ${item.mtNumber}` : ""}`
      .toLocaleLowerCase("id-ID")
      .includes(needle);
  });
  const counts = new Map<number, number>();
  for (const item of materials) {
    if (item.courseId) counts.set(item.courseId, (counts.get(item.courseId) ?? 0) + 1);
  }
  const grouped = new Map<string, MaterialRecord[]>();
  for (const item of visible) {
    const key = String(item.courseId ?? 0);
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }
  const remove = async (item: MaterialRecord) => {
    if (!window.confirm("Hapus materi ini? File yang sudah dihapus tidak bisa dikembalikan.")) return;
    const response = await fetch(`/api/files/${item.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    await onChanged(
      response.ok ? "Materi sudah dihapus." : body.message || "Materi gagal dihapus.",
      !response.ok,
    );
  };

  return (
    <section className="simple-page materi-page">
      <div className="page-header materi-header">
        <div>
          <h1>Materi</h1>
        </div>
        <button className="material-add" onClick={onAdd}>
          <Plus size={18} /> Tambah materi
        </button>
      </div>
      <div className="course-chips" role="tablist" aria-label="Saring mata kuliah">
        <button
          className={courseId === "semua" ? "active" : ""}
          onClick={() => setCourseId("semua")}
        >
          <em>Semua</em>
          <span>{materials.length}</span>
        </button>
        {courses.map((course) => (
          <button
            key={course.id}
            className={courseId === course.id ? "active" : ""}
            onClick={() => setCourseId(course.id)}
          >
            <em>{course.name}</em>
            <span>{counts.get(course.id) ?? 0}</span>
          </button>
        ))}
      </div>
      {loading ? (
        <CalendarSkeleton />
      ) : visible.length ? (
        <div className="material-groups">
          {[...grouped.entries()].map(([key, items]) => {
            const first = items[0];
            const dates = new Map<string, MaterialRecord[]>();
            for (const item of items) {
              const bucket = dates.get(item.date) ?? [];
              bucket.push(item);
              dates.set(item.date, bucket);
            }
            return (
              <section className="material-course" key={key}>
                <header className="material-course-head">
                  <i className={`schedule-accent ${first.color}`} />
                  <div>
                    <strong>{first.courseName ?? "Tanpa mata kuliah"}</strong>
                    <small>
                      {first.courseCode ? `${first.courseCode} · ` : ""}
                      {items.length} file
                    </small>
                  </div>
                </header>
                {[...dates.entries()].map(([date, files]) => (
                  <div className="material-day" key={date || "tanpa-tanggal"}>
                    {date ? <h3>{formatLongDate(date)}</h3> : null}
                    {files.map((file) => (
                      <article className="material-item" key={file.id}>
                        <span className={`file-icon ${file.color}`}>
                          <FileText size={18} />
                        </span>
                        <span className="material-copy">
                          <strong>{file.topic || file.originalName}</strong>
                          <small>
                            {file.mtNumber ? (
                              <em className="mt-pill">MT {String(file.mtNumber).padStart(2, "0")}</em>
                            ) : null}
                            {file.topic ? `${file.originalName} · ` : ""}
                            {formatBytes(file.sizeBytes)}
                            {file.scheduleTitle
                              ? ` · Dari kelas ${file.scheduleTitle}`
                              : file.note
                                ? ` · ${file.note}`
                                : " · Ditambahkan sendiri"}
                            {file.category === "catatan" ? " · Catatan" : ""}
                          </small>
                        </span>
                        <a href={`/api/files/${file.id}`} aria-label={`Unduh ${file.originalName}`}>
                          <Download size={17} />
                        </a>
                        <button
                          onClick={() => void remove(file)}
                          aria-label={`Hapus ${file.originalName}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </article>
                    ))}
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="page-empty">
          <BookOpen size={28} />
          <strong>
            Belum ada materi
          </strong>
          {courses.length > 0 && (
            <button onClick={onAdd}>Tambah materi</button>
          )}
        </div>
      )}
    </section>
  );
}

function MaterialForm({
  courses,
  initialDate,
  onClose,
  onSaved,
}: {
  courses: CourseRecord[];
  initialDate: string;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [courseId, setCourseId] = useState(courses[0] ? String(courses[0].id) : "");
  const [date, setDate] = useState(initialDate);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError("Pilih file terlebih dahulu.");
      return;
    }
    setSaving(true);
    setError("");
    const form = new FormData();
    form.append("courseId", courseId);
    form.append("date", date);
    form.append("note", note);
    form.append("file", file);
    try {
      const response = await fetch("/api/materials", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Materi gagal ditambahkan.");
      await onSaved("Materi berhasil ditambahkan.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Materi gagal ditambahkan.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal onClose={onClose}>
      <div className="modal-head">
        <div>
          <span className="modal-icon">
            <BookOpen size={19} />
          </span>
          <div>
            <h2>Tambah materi</h2>
          </div>
        </div>
        <button onClick={onClose} aria-label="Tutup">
          <X size={20} />
        </button>
      </div>
      <form className="schedule-form" onSubmit={submit}>
        <label className="full-field">
          <span>Mata kuliah</span>
          <ThemeSelect
            required
            value={courseId}
            onChange={setCourseId}
            options={
              courses.length === 0
                ? [{ value: "", label: "Belum ada mata kuliah" }]
                : courses.map((course) => ({
                    value: String(course.id),
                    label: course.name,
                  }))
            }
          />
        </label>
        <label className="full-field">
          <span>Tanggal</span>
          <input
            required
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label className="full-field">
          <span>Catatan</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={240}
          />
        </label>
        <label className="upload-box">
          <input
            required
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <span>
            <Upload size={21} />
          </span>
          <strong>{file ? file.name : "Pilih file"}</strong>
          <small>PDF, foto, atau dokumen. Maksimal 25 MB.</small>
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="cancel-button" onClick={onClose}>
            Batal
          </button>
          <button className="save-button" disabled={saving || courses.length === 0}>
            {saving ? "Menyimpan..." : "Simpan materi"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({
  children,
  onClose,
  className = "",
}: {
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const isMobile = useMobileLayout();
  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <motion.div
        className={`modal-card ${className}`}
        initial={isMobile ? { y: "100%" } : { opacity: 0, y: 22, scale: 0.97 }}
        animate={isMobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
        exit={isMobile ? { y: "100%" } : { opacity: 0, y: 14, scale: 0.97 }}
        transition={spring}
        role="dialog"
        aria-modal="true"
      >
        <span className="sheet-handle" aria-hidden="true" />
        {children}
      </motion.div>
    </motion.div>
  );
}

function ScheduleForm({
  mode,
  courses,
  onClose,
  onSaved,
}: {
  mode: Exclude<FormMode, null>;
  courses: CourseRecord[];
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const edit = mode.kind === "edit" ? mode.schedule : null;
  const [form, setForm] = useState<SchedulePayload>({
    courseId: edit?.courseId ?? courses[0]?.id ?? null,
    title: edit?.title ?? courses[0]?.name ?? "",
    date:
      edit?.date ?? (mode.kind === "buat" ? mode.date : toDateKey(new Date())),
    startTime: edit?.startTime ?? "08:00",
    endTime: edit?.endTime ?? "09:40",
    location: edit?.location ?? "",
    description: edit?.description ?? "",
    color: edit?.color ?? courses[0]?.color ?? "berry",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const chooseCourse = (value: string) => {
    const id = value ? Number(value) : null;
    const course = courses.find((item) => item.id === id);
    setForm((current) => ({
      ...current,
      courseId: id,
      title: course?.name ?? current.title,
      color: course?.color ?? current.color,
    }));
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        edit ? `/api/schedules/${edit.id}` : "/api/schedules",
        {
          method: edit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.message || "Jadwal gagal disimpan.");
      await onSaved(
        edit ? "Jadwal berhasil diperbarui." : "Jadwal berhasil dibuat.",
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Jadwal gagal disimpan.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal onClose={onClose} className="schedule-form-modal">
      <div className="modal-head">
        <div>
          <span className="modal-icon">
            <CalendarDays size={19} />
          </span>
          <div>
            <h2>{edit ? "Ubah jadwal" : "Jadwal baru"}</h2>
          </div>
        </div>
        <button onClick={onClose} aria-label="Tutup">
          <X size={20} />
        </button>
      </div>
      <form className="schedule-form" onSubmit={submit}>
        <label className="full-field">
          <span>Nama kelas atau kegiatan</span>
          <input
            required
            autoFocus
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
            maxLength={180}
            spellCheck={false}
          />
        </label>
        <label className="full-field">
          <span>Mata kuliah</span>
          <ThemeSelect
            value={form.courseId == null ? "" : String(form.courseId)}
            onChange={chooseCourse}
            placeholder="Tidak dipilih"
            options={[
              { value: "", label: "Tidak dipilih" },
              ...courses.map((course) => ({
                value: String(course.id),
                label: course.code ? `${course.code} — ${course.name}` : course.name,
              })),
            ]}
          />
        </label>
        <label className="full-field">
          <span>Tanggal</span>
          <input
            required
            type="date"
            value={form.date}
            onChange={(event) => setForm({ ...form, date: event.target.value })}
          />
        </label>
        <div className="field-row">
          <label>
            <span>Jam mulai</span>
            <input
              required
              type="time"
              value={form.startTime}
              onChange={(event) =>
                setForm({ ...form, startTime: event.target.value })
              }
            />
          </label>
          <label>
            <span>Jam selesai</span>
            <input
              required
              type="time"
              value={form.endTime}
              onChange={(event) =>
                setForm({ ...form, endTime: event.target.value })
              }
            />
          </label>
        </div>
        <label className="full-field">
          <span>Ruang</span>
          <input
            value={form.location ?? ""}
            onChange={(event) =>
              setForm({ ...form, location: event.target.value })
            }
          />
        </label>
        <label className="full-field">
          <span>Catatan</span>
          <textarea
            rows={3}
            value={form.description ?? ""}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </label>
        <fieldset className="color-field">
          <legend>Warna penanda</legend>
          {(["berry", "violet", "lime", "sky", "orange"] as ColorTone[]).map(
            (tone) => (
              <button
                type="button"
                key={tone}
                className={`${tone} ${form.color === tone ? "active" : ""}`}
                aria-label={COLOR_LABEL[tone]}
                onClick={() => setForm({ ...form, color: tone })}
              >
                {form.color === tone && <Check size={13} />}
              </button>
            ),
          )}
        </fieldset>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="cancel-button" onClick={onClose}>
            Batal
          </button>
          <button className="save-button" disabled={saving}>
            {saving
              ? "Menyimpan..."
              : edit
                ? "Simpan perubahan"
                : "Simpan jadwal"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ScheduleDetail({
  schedule,
  onClose,
  onEdit,
  onChanged,
  onDeleted,
}: {
  schedule: ScheduleRecord;
  onClose: () => void;
  onEdit: () => void;
  onChanged: (message: string, error?: boolean) => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const isMobile = useMobileLayout();
  const dragControls = useDragControls();
  const [tab, setTab] = useState<"materi" | "catatan">("materi");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const attachments = schedule.attachments.filter(
    (item) => item.category === tab,
  );
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("category", tab);
    try {
      const response = await fetch(`/api/schedules/${schedule.id}/files`, {
        method: "POST",
        body: form,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "File gagal diunggah.");
      await onChanged(`${file.name} berhasil diunggah.`);
    } catch (error) {
      await onChanged(
        error instanceof Error ? error.message : "File gagal diunggah.",
        true,
      );
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };
  const removeFile = async (id: number) => {
    if (!window.confirm("Hapus file ini? File yang sudah dihapus tidak bisa dikembalikan.")) return;
    const response = await fetch(`/api/files/${id}`, { method: "DELETE" });
    const body = await response.json();
    await onChanged(
      response.ok
        ? "File sudah dihapus."
        : body.message || "File gagal dihapus.",
      !response.ok,
    );
  };
  const removeSchedule = async () => {
    if (!window.confirm("Hapus jadwal ini? Jadwal dan semua filenya akan ikut terhapus.")) return;
    const response = await fetch(`/api/schedules/${schedule.id}`, {
      method: "DELETE",
    });
    if (response.ok) await onDeleted();
  };
  return (
    <motion.div
      className="sheet-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <motion.aside
        className="detail-sheet"
        initial={isMobile ? { y: "100%" } : { x: "100%" }}
        animate={isMobile ? { y: 0 } : { x: 0 }}
        exit={isMobile ? { y: "100%" } : { x: "100%" }}
        transition={spring}
        drag={isMobile ? "y" : false}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.28 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 110 || info.velocity.y > 650) onClose();
        }}
        role="dialog"
        aria-modal="true"
      >
        <button
          className="detail-drag-handle"
          onPointerDown={(event) => dragControls.start(event)}
          aria-label="Tarik ke bawah untuk menutup"
        >
          <span />
        </button>
        <div className={`detail-hero tone-${schedule.color}`}>
          <div className="detail-top">
            <span>{schedule.courseCode || "JADWAL"}</span>
            <div>
              <button onClick={onClose} aria-label="Tutup">
                <X size={19} />
              </button>
            </div>
          </div>
          <h2>{schedule.title}</h2>
          <div className="detail-meta">
            <span>
              <CalendarDays size={15} />
              {formatLongDate(schedule.date)}
            </span>
            <span>
              <Clock3 size={15} />
              {schedule.startTime}—{schedule.endTime}
            </span>
            {schedule.location && (
              <span>
                <MapPin size={15} />
                {schedule.location}
              </span>
            )}
          </div>
        </div>
        <div className="detail-body">
          {schedule.description && (
            <div className="short-note">
              <span>Catatan</span>
              <p>{schedule.description}</p>
            </div>
          )}
          <div className="file-tabs">
            <button
              className={tab === "materi" ? "active" : ""}
              onClick={() => setTab("materi")}
            >
              Materi{" "}
              <span>
                {
                  schedule.attachments.filter(
                    (item) => item.category === "materi",
                  ).length
                }
              </span>
            </button>
            <button
              className={tab === "catatan" ? "active" : ""}
              onClick={() => setTab("catatan")}
            >
              Catatan{" "}
              <span>
                {
                  schedule.attachments.filter(
                    (item) => item.category === "catatan",
                  ).length
                }
              </span>
            </button>
          </div>
          <label className={`upload-box ${uploading ? "busy" : ""}`}>
            <input
              ref={fileInput}
              type="file"
              onChange={(event) => void upload(event.target.files?.[0])}
              disabled={uploading}
            />
            <span>
              <Upload size={21} />
            </span>
            <strong>
              {uploading
                ? "Sedang mengunggah..."
                : tab === "materi"
                  ? "Pilih file materi"
                  : "Pilih file catatan"}
            </strong>
            <small>PDF, foto, atau dokumen, maksimal 25 MB.</small>
          </label>
          <div className="detail-files">
            {attachments.length ? (
              attachments.map((file) => (
                <div className="detail-file" key={file.id}>
                  <span className="detail-file-icon">
                    <File size={18} />
                    <i>{fileKind(file.originalName)}</i>
                  </span>
                  <span>
                    <strong>{file.originalName}</strong>
                    <small>{formatBytes(file.sizeBytes)}</small>
                  </span>
                  <a
                    href={`/api/files/${file.id}`}
                    aria-label={`Unduh ${file.originalName}`}
                  >
                    <Download size={17} />
                  </a>
                  <button
                    onClick={() => void removeFile(file.id)}
                    aria-label={`Hapus ${file.originalName}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-files">
                <Paperclip size={22} />
                <span>
                  {tab === "materi" ? "Belum ada materi" : "Belum ada catatan"}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="detail-footer">
          <button className="danger-text" onClick={() => void removeSchedule()}>
            <Trash2 size={16} /> Hapus jadwal
          </button>
          <button className="edit-button" onClick={onEdit}>
            <Pencil size={16} /> Ubah jadwal
          </button>
        </div>
      </motion.aside>
    </motion.div>
  );
}
