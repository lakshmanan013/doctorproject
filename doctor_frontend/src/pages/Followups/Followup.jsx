import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { FiCalendar, FiCheckCircle, FiMail, FiRotateCcw, FiPlus } from "react-icons/fi";
import { FaWhatsapp, FaPrescriptionBottleAlt } from "react-icons/fa";
import { MdNotificationsActive, MdErrorOutline, MdSms } from "react-icons/md";

import { StatCard } from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Input, { Field, Select, Textarea } from "../../components/ui/Input";
import SearchBar from "../../components/ui/SearchBar";

import {
  getFollowups,
  createFollowup,
  updateFollowup,
  markReminderSent,
} from "../../services/followupService";
import { getPatients } from "../../services/patientService";
import { sendSms, sendWhatsApp, sendEmail } from "../../services/communicationService";
import { openWhatsApp } from "../../utils/whatsapp";
import { toE164 } from "../../utils/phone";
import { getPatientById } from "../../services/patientService";
import { getOwnerById } from "../../services/ownerService";
import "./Followup.css";

const TABS = [
  { key: "dueToday", label: "Due today" },
  { key: "overdue", label: "Overdue" },
  { key: "week", label: "This week" },
  { key: "completed", label: "Completed" },
];

const today = new Date().toISOString().slice(0, 10);

const plusDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const isCompleted = (followup) =>
  String(followup.status || "").toUpperCase() === "COMPLETED";

export default function Followup() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = TABS.some((t) => t.key === searchParams.get("tab"))
    ? searchParams.get("tab")
    : "dueToday";

  const [tab, setTab] = useState(initialTab);
  const [items, setItems] = useState([]);
  const [patients, setPatients] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // New Follow-up Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    patientId: searchParams.get("patientId") || "",
    followUpDate: today,
    nextFollowUpDate: plusDays(7),
    reason: "",
    notes: "",
    status: "Scheduled",
  });

  const load = async () => {
    try {
      setLoading(true);
      const [fList, pList] = await Promise.all([
        getFollowups(),
        getPatients().catch(() => []),
      ]);
      setItems(Array.isArray(fList) ? fList : []);
      setPatients(Array.isArray(pList) ? pList : []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Could not load follow-ups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const paramPid = searchParams.get("patientId");
    if (paramPid) {
      setForm((prev) => ({ ...prev, patientId: paramPid }));
      setModalOpen(true);
    }
  }, [searchParams]);

  const changeTab = (key) => {
    setTab(key);
    setSearchParams(key === "dueToday" ? {} : { tab: key });
  };

  const handleSaveFollowup = async () => {
    if (!form.patientId) return toast.error("Select a patient");
    if (!form.followUpDate) return toast.error("Select a follow-up date");

    try {
      setSaving(true);
      await createFollowup({
        patientId: Number(form.patientId),
        followUpDate: form.followUpDate,
        nextFollowUpDate: form.nextFollowUpDate || form.followUpDate,
        reason: form.reason || "Routine follow-up",
        notes: form.notes,
        status: form.status,
      });
      toast.success("Follow-up scheduled successfully");
      setModalOpen(false);
      setForm({
        patientId: "",
        followUpDate: today,
        nextFollowUpDate: plusDays(7),
        reason: "",
        notes: "",
        status: "Scheduled",
      });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Could not schedule follow-up");
    } finally {
      setSaving(false);
    }
  };

  const buckets = useMemo(() => {
    const dueToday = [];
    const overdue = [];
    const week = [];
    const completed = [];
    const weekLimit = plusDays(7);

    items.forEach((followup) => {
      if (isCompleted(followup)) {
        completed.push(followup);
        return;
      }

      const status = String(followup.status || "").toUpperCase();
      const date = followup.nextFollowUpDate || followup.followUpDate;

      // If marked PENDING or OVERDUE, or due date is in the past, it goes to Overdue
      if (
        status === "PENDING" ||
        status === "OVERDUE" ||
        (date && date < today)
      ) {
        overdue.push(followup);
        return;
      }

      if (!date || date === today) {
        dueToday.push(followup);
        return;
      }

      if (date <= weekLimit) {
        week.push(followup);
      } else {
        dueToday.push(followup);
      }
    });

    const byDate = (a, b) =>
      String(a.nextFollowUpDate || a.followUpDate || "").localeCompare(
        String(b.nextFollowUpDate || b.followUpDate || "")
      );

    dueToday.sort(byDate);
    overdue.sort(byDate);
    week.sort(byDate);
    completed.sort(byDate);

    return { dueToday, overdue, week, completed };
  }, [items]);

  const counts = {
    dueToday: buckets.dueToday.length,
    overdue: buckets.overdue.length,
    week: buckets.week.length,
    completed: buckets.completed.length,
  };

  const visible = useMemo(() => {
    const raw = buckets[tab] || [];
    if (!query.trim()) return raw;
    const q = query.toLowerCase();
    return raw.filter(
      (f) =>
        (f.patientName || "").toLowerCase().includes(q) ||
        (f.reason || "").toLowerCase().includes(q) ||
        (f.notes || "").toLowerCase().includes(q) ||
        (f.ownerName || "").toLowerCase().includes(q)
    );
  }, [buckets, tab, query]);

  const done = async (f) => {
    try {
      await updateFollowup(f.id, {
        patientId: f.patientId,
        appointmentId: f.appointmentId,
        followUpDate: f.followUpDate,
        nextFollowUpDate: f.nextFollowUpDate,
        reason: f.reason,
        status: "COMPLETED",
        symptoms: f.symptoms,
        findings: f.findings,
        treatment: f.treatment,
        recommendations: f.recommendations,
        notes: f.notes,
        doctorName: f.doctorName,
        reminderSent: f.reminderSent,
      });
      toast.success("Follow-up completed");
      await load();
      changeTab("completed");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Could not update follow-up");
    }
  };

  const markPending = async (f) => {
    try {
      await updateFollowup(f.id, {
        patientId: f.patientId,
        appointmentId: f.appointmentId,
        followUpDate: f.followUpDate,
        nextFollowUpDate: f.nextFollowUpDate,
        reason: f.reason,
        status: "PENDING",
        symptoms: f.symptoms,
        findings: f.findings,
        treatment: f.treatment,
        recommendations: f.recommendations,
        notes: f.notes,
        doctorName: f.doctorName,
        reminderSent: f.reminderSent,
      });
      toast.success("Follow-up marked pending");
      await load();
      changeTab("overdue");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Could not update follow-up");
    }
  };

  const reminder = async (f, type) => {
    let phone = f.ownerPhone || "";
    let email = f.ownerEmail || "";
    const message = `Follow-up for ${f.patientName || "your pet"} on ${
      f.nextFollowUpDate || f.followUpDate || ""
    }.`;

    try {
      if (!phone || !email) {
        const p = await getPatientById(f.patientId).catch(() => null);
        if (p?.ownerPhone) phone = p.ownerPhone;
        if (p?.ownerId) {
          const o = await getOwnerById(p.ownerId).catch(() => null);
          if (o?.email) email = o.email;
        }
      }

      if (!phone && type !== "email") throw new Error("Owner phone is not available");
      if (!email && type === "email") throw new Error("Owner email is not available");

      if (type === "whatsapp") {
        const opened = openWhatsApp(phone, message);
        if (!opened) throw new Error("Owner phone is not available");
        sendWhatsApp({
          phoneNumber: phone,
          message,
          type: "FOLLOWUP",
          provider: "MANUAL",
        }).catch(() => {});
        await markReminderSent(f.id);
        toast.success("WhatsApp send successfully");
        load();
        return;
      }

      if (type === "sms") {
        await sendSms({
          phoneNumber: toE164(phone),
          message,
          type: "FOLLOWUP",
          provider: "MANUAL",
        });
      }

      if (type === "email") {
        await sendEmail({
          recipient: email,
          subject: "Veterinary follow-up reminder",
          message,
          type: "FOLLOWUP",
          provider: "MANUAL",
        });
      }

      await markReminderSent(f.id);
      toast.success(`${type === "sms" ? "SMS" : "Mail"} send successfully`);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || `Could not send ${type} reminder`);
    }
  };

  if (loading) {
    return (
      <div className="table-card">
        <div className="table-empty">Loading follow-ups...</div>
      </div>
    );
  }

  return (
    <div className="stack-6">
      <div className="stat-grid">
        <StatCard
          icon={MdNotificationsActive}
          label="Due today"
          value={counts.dueToday}
          iconBg="warning"
          hoverColor="#EAB308"
          onClick={() => changeTab("dueToday")}
        />
        <StatCard
          icon={MdErrorOutline}
          label="Overdue"
          value={counts.overdue}
          iconBg="danger"
          hoverColor="#DC2626"
          onClick={() => changeTab("overdue")}
        />
        <StatCard
          icon={FiCalendar}
          label="This week"
          value={counts.week}
          iconBg="info"
          hoverColor="#2563EB"
          onClick={() => changeTab("week")}
        />
        <StatCard
          icon={FiCheckCircle}
          label="Completed"
          value={counts.completed}
          iconBg="success"
          hoverColor="#16A34A"
          onClick={() => changeTab("completed")}
        />
      </div>

      <div className="table-toolbar">
        <div className="table-search">
          <SearchBar
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by pet name, reason or parent..."
          />
        </div>

        <div className="filter-row">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => changeTab(t.key)}
              className={`filter-chip ${tab === t.key ? "active" : ""}`}
            >
              {t.label} ({counts[t.key]})
            </button>
          ))}

          <Button icon={FiPlus} onClick={() => setModalOpen(true)}>
            Schedule Follow-up
          </Button>
        </div>
      </div>

      <div className="table-card">
        {visible.map((f) => (
          <div
            key={f.id}
            className="fu-row"
            style={{ cursor: "pointer" }}
            onClick={() => navigate(`/patients/${f.patientId}`)}
          >
            <div
              className="row-avatar"
              style={{ width: 40, height: 40 }}
              title="Open Patient Profile"
            >
              🐾
            </div>

            <div className="row-body">
              <p className="cell-title">{f.patientName || "Patient"}</p>
              <p className="cell-sub">
                {f.reason || f.notes || "Follow-up"} · {f.status || "Scheduled"}
              </p>
            </div>

            <div style={{ textAlign: "right" }}>
              <p className="fu-date">{f.nextFollowUpDate || f.followUpDate || "—"}</p>
              <p className="cell-sub">{f.ownerName || ""}</p>
            </div>

            <Badge
              variant={
                isCompleted(f)
                  ? "success"
                  : tab === "overdue" ||
                    String(f.status || "").toUpperCase() === "PENDING" ||
                    String(f.status || "").toUpperCase() === "OVERDUE" ||
                    (f.nextFollowUpDate && f.nextFollowUpDate < today) ||
                    (f.followUpDate && f.followUpDate < today)
                  ? "danger"
                  : "slate"
              }
            >
              {isCompleted(f)
                ? "Completed"
                : tab === "overdue" ||
                  String(f.status || "").toUpperCase() === "PENDING" ||
                  String(f.status || "").toUpperCase() === "OVERDUE" ||
                  (f.nextFollowUpDate && f.nextFollowUpDate < today) ||
                  (f.followUpDate && f.followUpDate < today)
                ? "Overdue"
                : f.reminderSent
                ? "Reminder sent"
                : "Scheduled"}
            </Badge>

            {/* Consult Shortcut Button */}
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/prescriptions?patientId=${f.patientId}`);
              }}
              title="Start Consultation"
            >
              <FaPrescriptionBottleAlt size={12} /> Consult
            </button>

            {tab === "completed" ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  markPending(f);
                }}
                className="fu-action"
              >
                <FiRotateCcw size={15} /> Mark pending
              </button>
            ) : (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    reminder(f, "whatsapp");
                  }}
                  className="fu-action fu-whatsapp"
                >
                  <FaWhatsapp size={14} /> WhatsApp
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    reminder(f, "sms");
                  }}
                  className="fu-icon-btn"
                  title="SMS"
                >
                  <MdSms size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    reminder(f, "email");
                  }}
                  className="fu-icon-btn"
                  title="Email"
                >
                  <FiMail size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    done(f);
                  }}
                  className="fu-action"
                >
                  <FiCheckCircle size={15} /> Done
                </button>
              </>
            )}
          </div>
        ))}

        {!visible.length && (
          <p className="table-empty">
            {tab === "dueToday"
              ? "No follow-ups due today."
              : tab === "overdue"
              ? "No overdue follow-ups."
              : tab === "week"
              ? "No follow-ups due this week."
              : "No completed follow-ups."}
          </p>
        )}
      </div>

      {/* SCHEDULE FOLLOW-UP MODAL */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Schedule Follow-up"
        subtitle="Schedule a follow-up visit for a patient"
      >
        <div className="form-grid-2">
          <Field label="Patient" className="col-span-2">
            <Select
              value={form.patientId}
              onChange={(e) => setForm({ ...form, patientId: e.target.value })}
            >
              <option value="">Select a patient</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.breed || p.species} · {p.ownerName || ""}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Follow-up Date">
            <Input
              type="date"
              value={form.followUpDate}
              onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
            />
          </Field>

          <Field label="Next Follow-up Due">
            <Input
              type="date"
              value={form.nextFollowUpDate}
              onChange={(e) => setForm({ ...form, nextFollowUpDate: e.target.value })}
            />
          </Field>

          <Field label="Reason" className="col-span-2">
            <Input
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="e.g. Post-surgery checkup, dressing change"
              autoFocus
            />
          </Field>

          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="Scheduled">Scheduled</option>
              <option value="Completed">Completed</option>
            </Select>
          </Field>

          <Field label="Clinical Notes" className="col-span-2">
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Clinical observation or advice for the parent"
            />
          </Field>
        </div>

        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSaveFollowup} disabled={saving}>
            {saving ? "Saving..." : "Schedule Follow-up"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
