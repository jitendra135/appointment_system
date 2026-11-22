import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowLeft, ArrowRight, Bell, BellRing, Building2, CalendarDays, Check, CheckCheck,
  ChevronDown, Clock3, FileDown, FilePlus2, HeartPulse, LayoutDashboard, ListFilter,
  LogOut, Menu, MoreHorizontal, Pencil, Plus, Search, Settings2, Stethoscope,
  Trash2, UserRound, UsersRound, X,
} from "lucide-react";
import "./appointments.css";

type Provider = { id: string; name: string; specialty: string; email: string; phone: string; color: string };
type Status = "scheduled" | "confirmed" | "checked-in" | "in-progress" | "completed" | "rejected" | "cancelled" | "no-show";
type Role = "patient" | "doctor" | "receptionist" | "admin";
type ClinicSettings = { isOpen: boolean; openingTime: string; closingTime: string };
type BlockedSlot = { id: string; providerId: string; date: string; time: string; duration: number; reason: string };
type Appointment = {
  id: string; patientName: string; patientEmail: string; patientPhone: string;
  providerId: string; date: string; time: string; duration: number;
  type: string; status: Status; notes: string; reminderSentAt?: string;
};
type View = "overview" | "schedule" | "providers" | "patient" | "departments" | "availability" | "reports";
type FormData = Omit<Appointment, "id">;
const roles: Role[] = ["patient", "doctor", "receptionist", "admin"];
const demoUserId = "admin";
const demoPassword = "admin";

const api = async <T,>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`/api/${path}`, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Something went wrong.");
  return result as T;
};

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const today = dateKey(new Date());
const displayDate = (date: string, options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" }) => new Date(`${date}T12:00:00`).toLocaleDateString("en-US", options);
const initials = (name: string) => name.split(" ").filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase();
const emptyForm = (date: string): FormData => ({ patientName: "", patientEmail: "", patientPhone: "", providerId: "", date, time: "09:00", duration: 30, type: "Consultation", status: "scheduled", notes: "" });

function LoginPage({ onLogin }: { onLogin: (userId: string, password: string) => boolean }) {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submitLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onLogin(userId.trim(), password)) setError("That user ID or password is not correct.");
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <a className="login-brand" href="/" aria-label="Wellnest home">
          <span className="brand-mark"><HeartPulse size={20} strokeWidth={2.2} /></span>
          <span>wellnest<span className="brand-period">.</span><small>CARE OPERATIONS</small></span>
        </a>
        <div className="login-intro">
          <span className="eyebrow">WELCOME BACK</span>
          <h1>Sign in to your clinic</h1>
          <p>Manage appointments and keep care moving.</p>
        </div>
        <form className="login-form" onSubmit={submitLogin}>
          <label className="login-field">
            <span>User ID</span>
            <input autoFocus required autoComplete="username" value={userId} onChange={(event) => { setUserId(event.target.value); setError(""); }} placeholder="Enter your user ID" />
          </label>
          <label className="login-field">
            <span>Password</span>
            <input required type="password" autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="Enter your password" />
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="primary-button login-submit" type="submit">Sign in <ArrowRight size={16} /></button>
        </form>
        <p className="login-demo-hint">Demo login: user ID <strong>admin</strong> · password <strong>admin</strong></p>
      </section>
      <p className="login-footer">WELLNEST <i>·</i> CARE, IN GOOD ORDER</p>
    </main>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem("wellnest-demo-auth") === "signed-in");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [clinic, setClinic] = useState<ClinicSettings>({ isOpen: true, openingTime: "09:00", closingTime: "18:00" });
  const [role, setRole] = useState<Role>(() => {
    const savedRole = localStorage.getItem("wellnest-demo-role");
    return roles.includes(savedRole as Role) ? savedRole as Role : "admin";
  });
  const [view, setView] = useState<View>(() => localStorage.getItem("wellnest-demo-role") === "patient" ? "patient" : "overview");
  const [doctorProviderId, setDoctorProviderId] = useState("");
  const [patientName, setPatientName] = useState(() => localStorage.getItem("wellnest-patient-name") || "");
  const [patientEmail, setPatientEmail] = useState(() => localStorage.getItem("wellnest-patient-email") || "");
  const [patientForm, setPatientForm] = useState<FormData>(() => ({ ...emptyForm(today), patientName: localStorage.getItem("wellnest-patient-name") || "", patientEmail: localStorage.getItem("wellnest-patient-email") || "" }));
  const [providerSearch, setProviderSearch] = useState("");
  const [patientDepartment, setPatientDepartment] = useState("all");
  const [departmentName, setDepartmentName] = useState("");
  const [blockForm, setBlockForm] = useState({ providerId: "", date: today, time: "12:00", duration: 30, reason: "Unavailable" });
  const [notice, setNotice] = useState("");
  const [calendarMode, setCalendarMode] = useState<"week" | "list">("week");
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekStart, setWeekStart] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return date;
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialog, setDialog] = useState<"appointment" | "provider" | null>(null);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm(today));
  const [providerForm, setProviderForm] = useState({ name: "", specialty: "", email: "", phone: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsSeen, setNotificationsSeen] = useState(false);
  const [clinicDialogOpen, setClinicDialogOpen] = useState(false);
  const [clinicForm, setClinicForm] = useState({ openingTime: "09:00", closingTime: "18:00" });

  const login = (userId: string, password: string) => {
    if (userId !== demoUserId || password !== demoPassword) return false;
    sessionStorage.setItem("wellnest-demo-auth", "signed-in");
    localStorage.setItem("wellnest-demo-role", "admin");
    setRole("admin");
    setView("overview");
    setIsAuthenticated(true);
    return true;
  };
  const logout = () => {
    sessionStorage.removeItem("wellnest-demo-auth");
    setIsAuthenticated(false);
    setAccountOpen(false);
  };

  const refresh = async () => {
    try {
      const [appointmentData, providerData, clinicData, departmentData, blockData] = await Promise.all([
        api<Appointment[]>("appointments"), api<Provider[]>("providers"), api<ClinicSettings>("clinic"),
        api<string[]>("departments"), api<BlockedSlot[]>("blocks"),
      ]);
      setAppointments(appointmentData);
      setProviders(providerData);
      setClinic(clinicData);
      setDepartments(departmentData);
      setBlockedSlots(blockData);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not connect to the appointment server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (providers.length && !doctorProviderId) setDoctorProviderId(providers[0].id);
    if (providers.length && !patientForm.providerId) setPatientForm((current) => ({ ...current, providerId: providers[0].id }));
    if (providers.length && !blockForm.providerId) setBlockForm((current) => ({ ...current, providerId: providers[0].id }));
  }, [providers, doctorProviderId, patientForm.providerId, blockForm.providerId]);
  useEffect(() => {
    if (role === "doctor" && doctorProviderId) setBlockForm((current) => current.providerId === doctorProviderId ? current : { ...current, providerId: doctorProviderId });
  }, [role, doctorProviderId]);

  const providerById = useMemo(() => new Map(providers.map((provider) => [provider.id, provider])), [providers]);
  const searchableProviders = providers.filter((provider) => `${provider.name} ${provider.specialty}`.toLowerCase().includes(providerSearch.toLowerCase()) && (patientDepartment === "all" || provider.specialty === patientDepartment));
  const providerAppointments = role === "doctor" ? appointments.filter((appointment) => appointment.providerId === doctorProviderId) : appointments;
  const todaysAppointments = appointments.filter((appointment) => appointment.date === today && !["cancelled", "no-show"].includes(appointment.status));
  const upcoming = appointments.filter((appointment) => appointment.date >= today && !["cancelled", "no-show", "completed"].includes(appointment.status));
  const patientAppointments = appointments.filter((appointment) => patientEmail
    ? appointment.patientEmail.toLowerCase() === patientEmail.toLowerCase()
    : patientName && appointment.patientName.toLowerCase() === patientName.toLowerCase());
  const clinicOpensAt = Number(clinic.openingTime.slice(0, 2)) * 60 + Number(clinic.openingTime.slice(3));
  const clinicClosesAt = Number(clinic.closingTime.slice(0, 2)) * 60 + Number(clinic.closingTime.slice(3));
  const availableSlots = Array.from({ length: Math.ceil((clinicClosesAt - clinicOpensAt) / 30) }, (_, index) => {
    const minutes = clinicOpensAt + index * 30;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }).filter((time) => {
    const start = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    if (start + Number(patientForm.duration) > clinicClosesAt) return false;
    const conflictsWithAppointment = appointments.some((appointment) => appointment.providerId === patientForm.providerId && appointment.date === patientForm.date && !["cancelled", "rejected", "no-show"].includes(appointment.status) && start < Number(appointment.time.slice(0, 2)) * 60 + Number(appointment.time.slice(3)) + appointment.duration && Number(appointment.time.slice(0, 2)) * 60 + Number(appointment.time.slice(3)) < start + Number(patientForm.duration));
    const conflictsWithBlock = blockedSlots.some((block) => block.providerId === patientForm.providerId && block.date === patientForm.date && start < Number(block.time.slice(0, 2)) * 60 + Number(block.time.slice(3)) + block.duration && Number(block.time.slice(0, 2)) * 60 + Number(block.time.slice(3)) < start + Number(patientForm.duration));
    return !conflictsWithAppointment && !conflictsWithBlock;
  });
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return date;
  });
  const visibleAppointments = providerAppointments
    .filter((appointment) => view === "schedule" || calendarMode === "list" || appointment.date === selectedDate)
    .filter((appointment) => role !== "patient" || patientAppointments.some((item) => item.id === appointment.id))
    .filter((appointment) => statusFilter === "all" || appointment.status === statusFilter)
    .filter((appointment) => {
      const provider = providerById.get(appointment.providerId);
      const haystack = `${appointment.patientName} ${appointment.patientEmail} ${appointment.type} ${provider?.name ?? ""}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  const moveWeek = (amount: number) => {
    setWeekStart((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + amount * 7);
      return next;
    });
    setSelectedDate((current) => {
      const next = new Date(`${current}T12:00:00`);
      next.setDate(next.getDate() + amount * 7);
      return dateKey(next);
    });
  };
  const openNewAppointment = (date = selectedDate) => {
    setEditing(null);
    setForm({ ...emptyForm(date), providerId: providers[0]?.id ?? "" });
    setDialog("appointment");
  };
  const openEditAppointment = (appointment: Appointment) => {
    setEditing(appointment);
    setForm({ ...appointment });
    setDialog("appointment");
  };
  const changeStatus = async (appointment: Appointment, status: Status) => {
    try {
      await api<Appointment>(`appointments/${appointment.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update appointment."); }
  };
  const switchRole = (nextRole: Role) => {
    setRole(nextRole);
    setView(nextRole === "patient" ? "patient" : "overview");
    localStorage.setItem("wellnest-demo-role", nextRole);
    setMobileNav(false);
  };
  const savePatientProfile = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    localStorage.setItem("wellnest-patient-name", patientName.trim());
    localStorage.setItem("wellnest-patient-email", patientEmail.trim());
    setPatientForm((current) => ({ ...current, patientName: patientName.trim(), patientEmail: patientEmail.trim() }));
    setNotice("Patient profile saved on this device.");
  };
  const submitPatientBooking = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api<Appointment>("appointments", { method: "POST", body: JSON.stringify({ ...patientForm, patientName: patientName.trim(), patientEmail: patientEmail.trim(), status: "scheduled" }) });
      setPatientForm((current) => ({ ...current, date: today, time: "09:00", notes: "" }));
      setNotice("Appointment request sent to the care team.");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not book appointment."); }
    finally { setSaving(false); }
  };
  const sendReminder = async (appointment: Appointment) => {
    try {
      await api<Appointment>(`appointments/${appointment.id}/reminder`, { method: "POST" });
      setNotice(`Reminder recorded for ${appointment.patientName}. Connect an email or SMS service to deliver it.`);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not record reminder."); }
  };
  const addDepartment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await api<string[]>("departments", { method: "POST", body: JSON.stringify({ name: departmentName }) });
      setDepartments(updated);
      setDepartmentName("");
      setNotice("Department added.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add department."); }
    finally { setSaving(false); }
  };
  const createBlockedSlot = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api<BlockedSlot>("blocks", { method: "POST", body: JSON.stringify(blockForm) });
      setNotice("Unavailable time saved.");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not block this time."); }
    finally { setSaving(false); }
  };
  const removeBlockedSlot = async (slot: BlockedSlot) => {
    try {
      await api(`blocks/${slot.id}`, { method: "DELETE" });
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not release this time."); }
  };
  const downloadReport = () => {
    const rows = [["Patient", "Email", "Provider", "Department", "Date", "Time", "Visit type", "Status"]];
    appointments.forEach((appointment) => {
      const provider = providerById.get(appointment.providerId);
      rows.push([appointment.patientName, appointment.patientEmail, provider?.name ?? "", provider?.specialty ?? "", appointment.date, appointment.time, appointment.type, appointment.status]);
    });
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `appointments-${today}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Appointment report downloaded.");
  };
  const deleteAppointment = async (appointment: Appointment) => {
    if (!window.confirm(`Permanently remove the appointment for ${appointment.patientName}?`)) return;
    try {
      await api(`appointments/${appointment.id}`, { method: "DELETE" });
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not remove appointment."); }
  };
  const submitAppointment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api(editing ? `appointments/${editing.id}` : "appointments", {
        method: editing ? "PATCH" : "POST", body: JSON.stringify(form),
      });
      setDialog(null);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save appointment."); }
    finally { setSaving(false); }
  };
  const submitProvider = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api<Provider>("providers", { method: "POST", body: JSON.stringify(providerForm) });
      setProviderForm({ name: "", specialty: "", email: "", phone: "" });
      setDialog(null);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add provider."); }
    finally { setSaving(false); }
  };
  const toggleClinic = async () => {
    try {
      const updated = await api<ClinicSettings>("clinic", { method: "PATCH", body: JSON.stringify({ ...clinic, isOpen: !clinic.isOpen }) });
      setClinic(updated);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update clinic status."); }
  };
  const openClinicSettings = () => {
    setClinicForm({ openingTime: clinic.openingTime, closingTime: clinic.closingTime });
    setClinicDialogOpen(true);
    setAccountOpen(false);
  };
  const submitClinicSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await api<ClinicSettings>("clinic", { method: "PATCH", body: JSON.stringify({ ...clinicForm, isOpen: clinic.isOpen }) });
      setClinic(updated);
      setClinicDialogOpen(false);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save clinic hours."); }
    finally { setSaving(false); }
  };
  const showNotifications = () => {
    setNotificationsSeen(true);
    setNotificationsOpen((open) => !open);
  };
  const pendingConfirmations = appointments.filter((appointment) => appointment.status === "scheduled" && appointment.date >= today);
  const pageTitle = view === "overview" ? "Overview" : view === "schedule" ? role === "doctor" ? "My schedule" : role === "patient" ? "My appointments" : "Appointments" : view === "providers" ? "Care team" : view === "patient" ? "Book a visit" : view === "departments" ? "Departments" : view === "availability" ? "Time slots" : "Reports";

  if (!isAuthenticated) return <LoginPage onLogin={login} />;

  return (
    <div className="clinic-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <a className="brand" href="#overview" onClick={() => setView("overview")}>
          <span className="brand-mark"><HeartPulse size={20} strokeWidth={2.2} /></span>
          <span>wellnest<span className="brand-period">.</span><small>CARE OPERATIONS</small></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {role !== "patient" && <button className={view === "overview" ? "nav-item active" : "nav-item"} onClick={() => { setView("overview"); setMobileNav(false); }}><LayoutDashboard size={18} />Overview</button>}
          {role === "patient" && <button className={view === "patient" ? "nav-item active" : "nav-item"} onClick={() => { setView("patient"); setMobileNav(false); }}><Plus size={18} />Book a visit</button>}
          <button className={view === "schedule" ? "nav-item active" : "nav-item"} onClick={() => { setView("schedule"); setMobileNav(false); }}><CalendarDays size={18} />{role === "doctor" ? "My schedule" : role === "patient" ? "My appointments" : "Appointments"}<span className="nav-count">{role === "patient" ? patientAppointments.length : upcoming.length}</span></button>
          {(role === "admin" || role === "receptionist") && <button className={view === "providers" ? "nav-item active" : "nav-item"} onClick={() => { setView("providers"); setMobileNav(false); }}><UsersRound size={18} />Care team</button>}
          {(role === "admin" || role === "doctor") && <button className={view === "availability" ? "nav-item active" : "nav-item"} onClick={() => { setView("availability"); setMobileNav(false); }}><Clock3 size={18} />Time slots</button>}
          {role === "admin" && <>
            <button className={view === "departments" ? "nav-item active" : "nav-item"} onClick={() => { setView("departments"); setMobileNav(false); }}><Building2 size={18} />Departments</button>
            <button className={view === "reports" ? "nav-item active" : "nav-item"} onClick={() => { setView("reports"); setMobileNav(false); }}><FileDown size={18} />Reports</button>
          </>}
        </nav>
        <div className="sidebar-bottom">
          {role === "admin" && <button className="support-card" onClick={openClinicSettings}><span className="support-icon"><Activity size={17} /></span><span><strong>Clinic {clinic.isOpen ? "open" : "closed"}</strong><span>{clinic.openingTime}–{clinic.closingTime} · Manage hours</span></span><i className={clinic.isOpen ? "online-dot" : "closed-dot"} /></button>}
          <div className="account-wrap"><button className="account-button" aria-expanded={accountOpen} onClick={() => setAccountOpen((open) => !open)}><span className="account-avatar">{role === "patient" ? "PT" : role === "doctor" ? "DR" : role === "receptionist" ? "RC" : "AM"}</span><span className="account-copy"><strong>{role === "patient" ? patientName || "Patient" : role === "doctor" ? providerById.get(doctorProviderId)?.name || "Care provider" : role === "receptionist" ? "Front desk" : "Alex Morgan"}</strong><small>{role === "admin" ? "Practice admin" : `${role[0].toUpperCase()}${role.slice(1)} demo`}</small></span><MoreHorizontal size={19} /></button>{accountOpen && <div className="account-menu"><strong>Demo workspace</strong><span>Switch the active workflow above.</span>{role === "admin" && <button onClick={openClinicSettings}><Settings2 size={15} />Clinic hours & status</button>}<button onClick={logout}><LogOut size={15} />Sign out</button></div>}</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNav(!mobileNav)}><Menu size={19} /></button>
          <div className="breadcrumb">Care operations <span>/</span> <strong>{pageTitle}</strong></div>
          <div className="top-actions"><label className="role-picker"><span>Demo role</span><select aria-label="Switch demo role" value={role} onChange={(event) => switchRole(event.target.value as Role)}>{roles.map((item) => <option key={item} value={item}>{item[0].toUpperCase()}{item.slice(1)}</option>)}</select></label>{role === "admin" && <button className={`today-label clinic-toggle ${clinic.isOpen ? "clinic-open" : "clinic-closed"}`} aria-label={`${clinic.isOpen ? "Close" : "Open"} clinic`} onClick={() => void toggleClinic()}><span className={clinic.isOpen ? "online-dot" : "closed-dot"} />Clinic {clinic.isOpen ? "open" : "closed"}<span className="clinic-hours-summary">{clinic.openingTime}–{clinic.closingTime}</span></button>}<div className="notifications-wrap"><button className="icon-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={showNotifications}><Bell size={18} />{pendingConfirmations.length > 0 && !notificationsSeen && <i className="notification-dot" />}</button>{notificationsOpen && <section className="notification-panel" aria-label="Notifications"><div className="notification-heading"><div><strong>Notifications</strong><span>{pendingConfirmations.length} awaiting confirmation</span></div><button className="icon-button" aria-label="Close notifications" onClick={() => setNotificationsOpen(false)}><X size={16} /></button></div>{pendingConfirmations.length ? <div className="notification-message"><span className="notification-icon"><CalendarDays size={16} /></span><p><strong>{pendingConfirmations.length} appointment{pendingConfirmations.length === 1 ? "" : "s"}</strong><span>Need confirmation from the care team.</span></p></div> : <div className="notification-empty">You’re all caught up.</div>}<button className="notification-link" onClick={() => { setView("schedule"); setNotificationsOpen(false); }}>View appointments<ArrowRight size={14} /></button></section>}</div><span className="top-avatar" title={`Active demo role: ${role}`}>{role === "patient" ? "PT" : role === "doctor" ? "DR" : role === "receptionist" ? "RC" : "AM"}</span></div>
        </header>

        <div className="page-content">
          {error && <div className="error-banner" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError("")}><X size={16} /></button></div>}
          {notice && <div className="success-banner" role="status"><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice("")}><X size={16} /></button></div>}
          {view === "patient" ? (
            <section className="patient-page fade-in">
              <div className="page-heading"><div><span className="eyebrow">PATIENT PORTAL · DEMO</span><h1>Find a time that works<span className="heading-period">.</span></h1><p>Choose a provider and request an available appointment.</p></div></div>
              <div className="portal-grid">
                <article className="portal-card">
                  <div className="lower-heading"><div><span className="eyebrow">YOUR DETAILS</span><h2>Patient profile</h2></div><UserRound size={20} /></div>
                  <form className="portal-form" onSubmit={savePatientProfile}>
                    <label className="form-field"><span>Full name</span><input required value={patientName} onChange={(event) => setPatientName(event.target.value)} placeholder="Your name" /></label>
                    <label className="form-field"><span>Email address</span><input required type="email" value={patientEmail} onChange={(event) => setPatientEmail(event.target.value)} placeholder="you@example.com" /></label>
                    <button className="secondary-button" type="submit">Save patient profile</button>
                  </form>
                  <p className="demo-note">This demo stores your profile on this device only. It does not provide password-based sign-in.</p>
                </article>
                <article className="portal-card">
                  <div className="lower-heading"><div><span className="eyebrow">BOOK ONLINE</span><h2>Request an appointment</h2></div><CalendarDays size={20} /></div>
                  <form className="portal-form" onSubmit={submitPatientBooking}>
                    <label className="form-field"><span>Search provider or department</span><input value={providerSearch} onChange={(event) => setProviderSearch(event.target.value)} placeholder="e.g. cardiology or Dr. Nair" /></label>
                    <label className="form-field"><span>Department</span><select value={patientDepartment} onChange={(event) => setPatientDepartment(event.target.value)}><option value="all">All departments</option>{departments.map((department) => <option key={department}>{department}</option>)}</select></label>
                    <label className="form-field"><span>Doctor / department</span><select required value={patientForm.providerId} onChange={(event) => setPatientForm({ ...patientForm, providerId: event.target.value })}><option value="" disabled>Choose a provider</option>{searchableProviders.map((provider) => <option key={provider.id} value={provider.id}>{provider.name} · {provider.specialty}</option>)}</select></label>
                    <div className="form-grid">
                      <label className="form-field"><span>Date</span><input required type="date" min={today} value={patientForm.date} onChange={(event) => setPatientForm({ ...patientForm, date: event.target.value })} /></label>
                      <label className="form-field"><span>Visit length</span><select value={patientForm.duration} onChange={(event) => setPatientForm({ ...patientForm, duration: Number(event.target.value) })}><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>1 hour</option></select></label>
                    </div>
                    <label className="form-field"><span>Available time</span><select required value={availableSlots.includes(patientForm.time) ? patientForm.time : ""} onChange={(event) => setPatientForm({ ...patientForm, time: event.target.value })}><option value="" disabled>{availableSlots.length ? "Choose an open time" : "No available times for this date"}</option>{availableSlots.map((time) => <option key={time} value={time}>{new Date(`2000-01-01T${time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</option>)}</select></label>
                    <label className="form-field"><span>Reason for visit</span><textarea rows={2} value={patientForm.notes} onChange={(event) => setPatientForm({ ...patientForm, notes: event.target.value })} placeholder="Optional notes for the care team" /></label>
                    <button className="primary-button" disabled={saving || !patientName.trim() || !patientEmail.trim() || !availableSlots.length || !clinic.isOpen}><FilePlus2 size={16} />{saving ? "Requesting…" : "Request appointment"}</button>
                    {!clinic.isOpen && <p className="demo-note">Online booking is paused while the clinic is closed.</p>}
                  </form>
                </article>
              </div>
              <section className="portal-card patient-history"><div className="lower-heading"><div><span className="eyebrow">YOUR VISITS</span><h2>Appointment history</h2></div><span className="nav-count">{patientAppointments.length}</span></div>
                {patientAppointments.length ? <div className="simple-list">{patientAppointments.slice().sort((a, b) => b.date.localeCompare(a.date)).map((appointment) => <div className="simple-list-row" key={appointment.id}><div><strong>{displayDate(appointment.date, { month: "short", day: "numeric", year: "numeric" })} · {appointment.time}</strong><span>{providerById.get(appointment.providerId)?.name ?? "Provider"} · {appointment.type}</span></div><span className={`status-pill status-${appointment.status}`}>{appointment.status}</span><div className="inline-actions">{!["completed", "cancelled", "rejected", "no-show"].includes(appointment.status) && <><button className="text-button" onClick={() => openEditAppointment(appointment)}>Reschedule</button><button className="text-button cancel-text" onClick={() => void changeStatus(appointment, "cancelled")}>Cancel</button></>}</div></div>)}</div> : <div className="empty-state"><strong>No visits yet</strong><span>Requests and appointment history will appear here.</span></div>}
              </section>
            </section>
          ) : view === "departments" ? (
            <section className="utility-page fade-in">
              <div className="page-heading"><div><span className="eyebrow">PRACTICE SETUP</span><h1>Departments</h1><p>Organize specialties available to patients.</p></div></div>
              <article className="portal-card"><form className="inline-form" onSubmit={addDepartment}><label className="form-field"><span>New department</span><input required value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} placeholder="e.g. Neurology" /></label><button className="primary-button" disabled={saving}><Plus size={16} />Add department</button></form>
                <div className="department-grid">{departments.map((department) => <div className="department-chip" key={department}><Building2 size={17} /><strong>{department}</strong><span>{providers.filter((provider) => provider.specialty.toLowerCase() === department.toLowerCase()).length} providers</span></div>)}</div>
              </article>
            </section>
          ) : view === "availability" ? (
            <section className="utility-page fade-in">
              <div className="page-heading"><div><span className="eyebrow">SCHEDULE CONTROLS</span><h1>Time slots</h1><p>{role === "doctor" ? "Block time when you are not available." : "Manage clinic hours and block provider availability."}</p></div>{role === "admin" && <button className="secondary-button" onClick={openClinicSettings}><Settings2 size={16} />Clinic hours</button>}</div>
              <article className="portal-card"><div className="lower-heading"><div><span className="eyebrow">UNAVAILABLE TIMES</span><h2>Block a time slot</h2></div><Clock3 size={20} /></div>
                <form className="block-form" onSubmit={createBlockedSlot}>{role === "admin" && <label className="form-field"><span>Provider</span><select required value={blockForm.providerId} onChange={(event) => setBlockForm({ ...blockForm, providerId: event.target.value })}>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>}<label className="form-field"><span>Date</span><input required type="date" min={today} value={blockForm.date} onChange={(event) => setBlockForm({ ...blockForm, date: event.target.value })} /></label><label className="form-field"><span>Start time</span><input required type="time" value={blockForm.time} onChange={(event) => setBlockForm({ ...blockForm, time: event.target.value })} /></label><label className="form-field"><span>Duration</span><select value={blockForm.duration} onChange={(event) => setBlockForm({ ...blockForm, duration: Number(event.target.value) })}><option value={30}>30 minutes</option><option value={60}>1 hour</option><option value={90}>1.5 hours</option><option value={120}>2 hours</option></select></label><label className="form-field"><span>Reason</span><input value={blockForm.reason} onChange={(event) => setBlockForm({ ...blockForm, reason: event.target.value })} /></label><button className="primary-button" disabled={saving}><Plus size={16} />Block time</button></form>
                <div className="simple-list">{blockedSlots.filter((slot) => role !== "doctor" || slot.providerId === doctorProviderId).map((slot) => <div className="simple-list-row" key={slot.id}><div><strong>{displayDate(slot.date, { month: "short", day: "numeric", year: "numeric" })} · {slot.time}</strong><span>{providerById.get(slot.providerId)?.name} · {slot.duration} min · {slot.reason}</span></div><button className="secondary-button" onClick={() => void removeBlockedSlot(slot)}>Release time</button></div>)}{blockedSlots.filter((slot) => role !== "doctor" || slot.providerId === doctorProviderId).length === 0 && <p className="demo-note">No unavailable times have been blocked.</p>}</div>
              </article>
            </section>
          ) : view === "reports" ? (
            <section className="utility-page fade-in">
              <div className="page-heading"><div><span className="eyebrow">PRACTICE INSIGHTS</span><h1>Appointment reports</h1><p>A simple snapshot of activity across the clinic.</p></div><button className="primary-button" onClick={downloadReport}><FileDown size={16} />Download CSV</button></div>
              <section className="stats-grid"><article className="stat-card"><span className="stat-label">TOTAL VISITS</span><div className="stat-value">{appointments.length}<span className="stat-unit">records</span></div></article><article className="stat-card"><span className="stat-label">COMPLETED</span><div className="stat-value">{appointments.filter((item) => item.status === "completed").length}<span className="stat-unit">visits</span></div></article><article className="stat-card"><span className="stat-label">CANCELLED / NO-SHOW</span><div className="stat-value">{appointments.filter((item) => ["cancelled", "no-show", "rejected"].includes(item.status)).length}<span className="stat-unit">visits</span></div></article></section>
              <article className="portal-card"><div className="lower-heading"><div><span className="eyebrow">BY DEPARTMENT</span><h2>Upcoming appointments</h2></div></div><div className="report-list">{departments.map((department) => { const providerIds = providers.filter((provider) => provider.specialty.toLowerCase() === department.toLowerCase()).map((provider) => provider.id); const count = appointments.filter((appointment) => providerIds.includes(appointment.providerId) && appointment.date >= today && !["cancelled", "rejected", "no-show"].includes(appointment.status)).length; return <div key={department}><span>{department}</span><div className="report-meter"><i style={{ width: `${appointments.length ? Math.min(100, count / appointments.length * 100) : 0}%` }} /></div><strong>{count}</strong></div>; })}</div></article>
            </section>
          ) : view === "providers" ? (
            <section className="team-page fade-in">
              <div className="page-heading"><div><span className="eyebrow">PEOPLE & PRACTICE</span><h1>Your care team</h1><p>Manage the providers who make every visit count.</p></div>{role === "admin" && <button className="primary-button" onClick={() => setDialog("provider")}><Plus size={17} />Add provider</button>}</div>
              <div className="provider-grid">{providers.map((provider, index) => <article className="provider-card" key={provider.id} style={{ "--provider-color": provider.color } as React.CSSProperties}><span className="provider-index">0{index + 1}</span><div className="provider-avatar">{initials(provider.name)}</div><h2>{provider.name}</h2><p>{provider.specialty}</p><div className="provider-contact"><span>{provider.email || "No email added"}</span><span>{provider.phone || "No phone added"}</span></div><div className="provider-card-foot"><span><i className="online-dot" />Accepting appointments</span><strong>{appointments.filter((item) => item.providerId === provider.id && item.date >= today && !["cancelled", "completed", "no-show"].includes(item.status)).length} upcoming</strong></div></article>)}</div>
            </section>
          ) : <>
            <section className="page-heading fade-in">
              <div><span className="eyebrow">{view === "overview" ? `${new Date(`${today}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()} · ${role === "doctor" ? "YOUR PATIENT SCHEDULE" : "YOUR CLINIC AT A GLANCE"}` : "YOUR CLINIC · SCHEDULING"}</span><h1>{view === "overview" ? role === "doctor" ? "Good morning, doctor" : role === "receptionist" ? "Front desk overview" : "Good morning, Alex" : role === "doctor" ? "My schedule" : role === "receptionist" ? "Appointments & check-in" : "Appointments"}<span className="heading-period">.</span></h1><p>{view === "overview" ? role === "doctor" ? "Review requests and keep your day on track." : "A clear view of today’s care, all in one place." : role === "receptionist" ? "Book walk-ins, check in arrivals, and send reminders." : "Keep every visit moving smoothly."}</p></div>
              {(role === "admin" || role === "receptionist") && <button className="primary-button" onClick={() => openNewAppointment()}><Plus size={17} />{role === "receptionist" ? "Book walk-in" : "New appointment"}</button>}
            </section>

            {role === "doctor" && <label className="doctor-selector form-field"><span>Schedule for</span><select value={doctorProviderId} onChange={(event) => setDoctorProviderId(event.target.value)}>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name} · {provider.specialty}</option>)}</select></label>}

            {view === "overview" && <section className="stats-grid fade-in" aria-label="Clinic summary">
              <article className="stat-card"><span className="stat-label">TODAY’S VISITS <CalendarDays size={16} /></span><div className="stat-value">{todaysAppointments.length}<span className="stat-unit">appointments</span></div><span className="stat-note">Across {new Set(todaysAppointments.map((item) => item.providerId)).size} providers</span><div className="stat-mark mark-coral"><CalendarDays size={21} /></div></article>
              <article className="stat-card"><span className="stat-label">AWAITING CONFIRMATION <Clock3 size={16} /></span><div className="stat-value">{appointments.filter((item) => item.status === "scheduled" && item.date >= today).length}<span className="stat-unit">to confirm</span></div><span className="stat-note">Ready for a quick follow-up</span><div className="stat-mark mark-gold"><Clock3 size={21} /></div></article>
              <article className="stat-card"><span className="stat-label">UPCOMING VISITS <UsersRound size={16} /></span><div className="stat-value">{upcoming.length}<span className="stat-unit">on the books</span></div><span className="stat-note">{providers.length} care providers</span><div className="stat-mark mark-green"><CheckCheck size={21} /></div></article>
            </section>}

            <section className="schedule-panel fade-in">
              <div className="section-header"><div><span className="eyebrow">{view === "overview" ? "YOUR WEEK" : "SCHEDULE VIEW"}</span><h2>{calendarMode === "list" ? "All appointments" : displayDate(dateKey(weekStart), { month: "long", year: "numeric" })}</h2></div><div className="calendar-controls"><button className="icon-button" aria-label="Previous week" onClick={() => moveWeek(-1)}><ArrowLeft size={17} /></button><button className="today-button" onClick={() => { setSelectedDate(today); const date = new Date(); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); setWeekStart(date); }}>Today</button><button className="icon-button" aria-label="Next week" onClick={() => moveWeek(1)}><ArrowRight size={17} /></button><span className="view-separator" /><div className="view-switch" role="group" aria-label="Schedule display"><button className={calendarMode === "week" ? "view-switch-active" : ""} onClick={() => setCalendarMode("week")}><CalendarDays size={15} />Week</button><button className={calendarMode === "list" ? "view-switch-active" : ""} onClick={() => setCalendarMode("list")}><ListFilter size={15} />List</button></div></div></div>
              {calendarMode === "week" && <div className="week-strip">{weekDays.map((date) => {
                const key = dateKey(date);
                const count = providerAppointments.filter((appointment) => appointment.date === key && !["cancelled", "rejected", "no-show"].includes(appointment.status)).length;
                return <button key={key} className={`day-cell ${selectedDate === key ? "day-selected" : ""} ${key === today ? "day-today" : ""}`} onClick={() => setSelectedDate(key)}><span className="day-name">{date.toLocaleDateString("en-US", { weekday: "short" })}</span><span className="day-number">{date.getDate()}</span><span className="day-dots">{Array.from({ length: Math.min(count, 4) }, (_, index) => <i key={index} />)}{count === 0 && <i className="empty-dot" />}</span></button>;
              })}</div>}
              <div className="appointments-heading"><div><h3>{calendarMode === "list" || view === "schedule" ? "All appointments" : selectedDate === today ? "Today’s appointments" : displayDate(selectedDate, { weekday: "long", month: "long", day: "numeric" })}</h3><span>{visibleAppointments.length} {visibleAppointments.length === 1 ? "visit" : "visits"}</span></div><div className="list-tools"><label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient or provider" /></label><label className="filter-select"><ListFilter size={15} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status"><option value="all">All statuses</option><option value="scheduled">Requested</option><option value="confirmed">Confirmed</option><option value="checked-in">Checked in</option><option value="in-progress">In progress</option><option value="completed">Completed</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option><option value="no-show">No-show</option></select><ChevronDown size={14} /></label></div></div>
              {loading ? <div className="empty-state"><span className="loading-ring" />Loading appointments</div> : visibleAppointments.length === 0 ? <div className="empty-state"><span className="empty-calendar"><CalendarDays size={23} /></span><strong>No appointments here</strong><span>{query ? "Try a different search." : "A little room in the day. Add a visit when you’re ready."}</span>{role === "patient" && <button className="text-button" onClick={() => setView("patient")}><Plus size={15} />Book an appointment</button>}{(role === "admin" || role === "receptionist") && <button className="text-button" onClick={() => openNewAppointment(selectedDate)}><Plus size={15} />Create appointment</button>}</div> : <div className="appointment-list">{visibleAppointments.map((appointment) => {
                const provider = providerById.get(appointment.providerId);
                return <article className="appointment-row" key={appointment.id}><div className="appointment-time"><strong>{new Date(`2000-01-01T${appointment.time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</strong><span>{appointment.duration} min</span></div><div className="timeline-line"><i /></div><div className="patient-avatar" style={{ "--patient-color": provider?.color ?? "#487765" } as React.CSSProperties}>{initials(appointment.patientName)}</div><div className="appointment-details"><div className="patient-name">{appointment.patientName}<span className={`status-pill status-${appointment.status}`}>{appointment.status}</span></div><div className="appointment-meta"><span><Stethoscope size={13} />{provider?.name ?? "Provider unavailable"}</span><i /><span>{appointment.type}</span></div>{(view === "schedule" || calendarMode === "list") && <div className="appointment-date"><CalendarDays size={13} />{displayDate(appointment.date, { weekday: "short", month: "short", day: "numeric" })}</div>}{appointment.reminderSentAt && <div className="appointment-date"><Bell size={12} />Reminder recorded</div>}</div><div className="appointment-actions">
                  {appointment.status === "scheduled" && role !== "patient" && <button className="confirm-button" onClick={() => void changeStatus(appointment, "confirmed")}><Check size={15} />Confirm</button>}
                  {appointment.status === "scheduled" && role === "doctor" && <button className="secondary-button small-action" onClick={() => void changeStatus(appointment, "rejected")}>Reject</button>}
                  {appointment.status === "confirmed" && role === "doctor" && <button className="complete-button" onClick={() => void changeStatus(appointment, "in-progress")}>Start visit</button>}
                  {appointment.status === "in-progress" && role === "doctor" && <button className="complete-button" onClick={() => void changeStatus(appointment, "completed")}><CheckCheck size={15} />Complete</button>}
                  {appointment.status === "confirmed" && (role === "admin" || role === "receptionist") && <button className="confirm-button" onClick={() => void changeStatus(appointment, "checked-in")}><Check size={15} />Check in</button>}
                  {appointment.status === "checked-in" && role === "doctor" && <button className="complete-button" onClick={() => void changeStatus(appointment, "in-progress")}>Start visit</button>}
                  {appointment.status === "confirmed" && role === "admin" && <button className="complete-button" onClick={() => void changeStatus(appointment, "completed")}><CheckCheck size={15} />Complete</button>}
                  {(role === "admin" || role === "receptionist") && !["cancelled", "rejected", "completed", "no-show"].includes(appointment.status) && <button className="icon-button row-icon" aria-label={`Record reminder for ${appointment.patientName}`} title="Record reminder" onClick={() => void sendReminder(appointment)}><BellRing size={15} /></button>}
                  {(role === "admin" || role === "receptionist") && ["confirmed", "checked-in"].includes(appointment.status) && <button className="secondary-button small-action" onClick={() => void changeStatus(appointment, "no-show")}>No-show</button>}
                  {(role === "admin" || role === "receptionist") && <button className="icon-button row-icon" aria-label={`Edit ${appointment.patientName}'s appointment`} onClick={() => openEditAppointment(appointment)}><Pencil size={15} /></button>}
                  {role === "patient" && !["cancelled", "completed", "rejected", "no-show"].includes(appointment.status) && <button className="secondary-button small-action" onClick={() => openEditAppointment(appointment)}>Reschedule</button>}
                  {role === "patient" && !["cancelled", "completed", "rejected", "no-show"].includes(appointment.status) && <button className="icon-button row-icon cancel-action" aria-label={`Cancel ${appointment.patientName}'s appointment`} onClick={() => void changeStatus(appointment, "cancelled")}><X size={16} /></button>}
                  {role === "admin" && <button className="icon-button row-icon delete-action" aria-label={`Delete ${appointment.patientName}'s appointment`} onClick={() => void deleteAppointment(appointment)}><Trash2 size={15} /></button>}
                </div></article>;
              })}</div>}
            </section>

            {view === "overview" && role !== "doctor" && <section className="lower-grid fade-in"><article className="team-summary"><div className="lower-heading"><div><span className="eyebrow">MEET THE TEAM</span><h2>Care providers</h2></div><button className="text-button" onClick={() => setView("providers")}>View team<ArrowRight size={15} /></button></div><div className="team-avatars">{providers.slice(0, 4).map((provider) => <button key={provider.id} className="team-avatar" style={{ "--provider-color": provider.color } as React.CSSProperties} title={`${provider.name} · ${provider.specialty}`} onClick={() => setView("providers")}>{initials(provider.name)}</button>)}<button className="team-total" onClick={() => setView("providers")}>{providers.length} providers<ArrowRight size={14} /></button></div><p className="team-caption">A thoughtful team, ready for every patient.</p></article><article className="next-up-card"><div className="next-up-top"><span className="eyebrow">NEXT UP</span><span className="next-up-time"><i className="online-dot" />{todaysAppointments[0]?.time ?? "All clear"}</span></div>{todaysAppointments[0] ? <><h3>{todaysAppointments[0].patientName}</h3><p>{todaysAppointments[0].type} <span>with {providerById.get(todaysAppointments[0].providerId)?.name}</span></p></> : <><h3>Your schedule is clear</h3><p>There are no visits booked for today.</p></>}<span className="next-up-decoration"><HeartPulse size={38} /></span></article></section>}
          </>}
          <footer className="page-footer"><span>WELLNEST <i>·</i> CARE, IN GOOD ORDER</span><span>Private practice workspace <span className="footer-lock">·</span> v1.0</span></footer>
        </div>
      </main>
      {mobileNav && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}

      {dialog && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="dialog-header"><div><span className="eyebrow">{dialog === "appointment" ? editing ? "UPDATE VISIT DETAILS" : "ADD TO THE SCHEDULE" : "GROW YOUR TEAM"}</span><h2 id="dialog-title">{dialog === "appointment" ? editing ? "Edit appointment" : "New appointment" : "Add a provider"}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={() => setDialog(null)}><X size={19} /></button></div>
        {dialog === "appointment" ? <form onSubmit={submitAppointment} className="dialog-form"><div className="form-grid"><label className="form-field full-field"><span>Patient name <b>*</b></span><input autoFocus required value={form.patientName} onChange={(event) => setForm({ ...form, patientName: event.target.value })} placeholder="e.g. Jamie Rivera" /></label><label className="form-field"><span>Email address</span><input type="email" value={form.patientEmail} onChange={(event) => setForm({ ...form, patientEmail: event.target.value })} placeholder="patient@example.com" /></label><label className="form-field"><span>Phone number</span><input type="tel" value={form.patientPhone} onChange={(event) => setForm({ ...form, patientPhone: event.target.value })} placeholder="(415) 555-0100" /></label><label className="form-field full-field"><span>Care provider <b>*</b></span><select required value={form.providerId} onChange={(event) => setForm({ ...form, providerId: event.target.value })}><option value="" disabled>Select a provider</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name} · {provider.specialty}</option>)}</select></label><label className="form-field"><span>Date <b>*</b></span><input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label><label className="form-field"><span>Start time <b>*</b></span><input required type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} /></label><label className="form-field"><span>Visit type</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>Consultation</option><option>Annual check-up</option><option>Follow-up</option><option>New patient</option><option>Vaccination</option><option>Telehealth</option></select></label><label className="form-field"><span>Duration</span><select value={form.duration} onChange={(event) => setForm({ ...form, duration: Number(event.target.value) })}><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>1 hour</option><option value={90}>1.5 hours</option><option value={120}>2 hours</option></select></label><label className="form-field full-field"><span>Visit notes</span><textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Anything the care team should know?" /></label></div><div className="dialog-footer"><button type="button" className="secondary-button" onClick={() => setDialog(null)}>Keep editing later</button><button className="primary-button" disabled={saving || !providers.length}><FilePlus2 size={16} />{saving ? "Saving…" : editing ? "Save changes" : "Create appointment"}</button></div></form> : <form onSubmit={submitProvider} className="dialog-form"><div className="form-grid"><label className="form-field full-field"><span>Provider name <b>*</b></span><input autoFocus required value={providerForm.name} onChange={(event) => setProviderForm({ ...providerForm, name: event.target.value })} placeholder="e.g. Dr. Taylor Reed" /></label><label className="form-field full-field"><span>Specialty <b>*</b></span><input required value={providerForm.specialty} onChange={(event) => setProviderForm({ ...providerForm, specialty: event.target.value })} placeholder="e.g. Family medicine" /></label><label className="form-field"><span>Email</span><input type="email" value={providerForm.email} onChange={(event) => setProviderForm({ ...providerForm, email: event.target.value })} placeholder="provider@example.com" /></label><label className="form-field"><span>Phone</span><input type="tel" value={providerForm.phone} onChange={(event) => setProviderForm({ ...providerForm, phone: event.target.value })} placeholder="(415) 555-0100" /></label></div><div className="dialog-footer"><button type="button" className="secondary-button" onClick={() => setDialog(null)}>Cancel</button><button className="primary-button" disabled={saving}><Plus size={16} />{saving ? "Adding…" : "Add provider"}</button></div></form>}
      </section></div>}
      {clinicDialogOpen && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setClinicDialogOpen(false); }}><section className="dialog clinic-dialog" role="dialog" aria-modal="true" aria-labelledby="clinic-dialog-title"><div className="dialog-header"><div><span className="eyebrow">PRACTICE SETTINGS</span><h2 id="clinic-dialog-title">Clinic hours</h2></div><button className="icon-button" aria-label="Close clinic hours" onClick={() => setClinicDialogOpen(false)}><X size={19} /></button></div><div className="clinic-status-row"><span className={clinic.isOpen ? "online-dot" : "closed-dot"} /><div><strong>Clinic is {clinic.isOpen ? "open" : "closed"}</strong><span>New appointments should fit within these hours.</span></div><button type="button" className={clinic.isOpen ? "secondary-button" : "primary-button"} onClick={() => void toggleClinic()}>{clinic.isOpen ? "Close clinic" : "Open clinic"}</button></div><form className="dialog-form" onSubmit={submitClinicSettings}><div className="form-grid"><label className="form-field"><span>Opening time</span><input type="time" required value={clinicForm.openingTime} onChange={(event) => setClinicForm({ ...clinicForm, openingTime: event.target.value })} /></label><label className="form-field"><span>Closing time</span><input type="time" required value={clinicForm.closingTime} onChange={(event) => setClinicForm({ ...clinicForm, closingTime: event.target.value })} /></label></div><div className="dialog-footer"><button type="button" className="secondary-button" onClick={() => setClinicDialogOpen(false)}>Cancel</button><button className="primary-button" disabled={saving}><Check size={16} />{saving ? "Saving…" : "Save clinic hours"}</button></div></form></section></div>}
    </div>
  );
}

export default App;