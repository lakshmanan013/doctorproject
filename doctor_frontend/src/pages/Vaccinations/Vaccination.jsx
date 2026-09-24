import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { FiClock, FiCheckCircle, FiCalendar, FiPlus, FiExternalLink, FiAlertCircle } from "react-icons/fi";
import { FaSyringe } from "react-icons/fa";

import { StatCard } from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Input, { Field, Select } from "../../components/ui/Input";
import SearchBar from "../../components/ui/SearchBar";

import {
  getVaccinations,
  createVaccination,
  updateVaccination,
} from "../../services/vaccinationService";
import { getPatients } from "../../services/patientService";
import { getMedicines } from "../../services/medicineService";
import { getBatches } from "../../services/inventoryService";
import "./Vaccination.css";

const TABS = [
  { key: "dueNow", label: "Due now" },
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

const isCompleted = (vaccination) =>
  String(vaccination.status || "").toUpperCase() === "COMPLETED";

export default function Vaccination() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = TABS.some((t) => t.key === searchParams.get("tab"))
    ? searchParams.get("tab")
    : "dueNow";

  const [tab, setTab] = useState(initialTab);
  const [vaccinations, setVaccinations] = useState([]);
  const [patients, setPatients] = useState([]);
  const [inventoryMeds, setInventoryMeds] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const [batches, setBatches] = useState([]);

  const generateOrFetchBatch = (
    vaccineName,
    patientId = form.patientId,
    batchesList = batches,
    vaxList = vaccinations
  ) => {
    const vName = (vaccineName || "").trim().toLowerCase();
    const pid = patientId ? Number(patientId) : null;

    // 1. First priority: Check if this patient already has a completed vaccination record with a batch number
    if (pid && vaxList && vaxList.length > 0) {
      const patientVaxes = vaxList.filter(
        (v) => Number(v.patientId) === pid && (v.batchNumber || "").trim() !== ""
      );

      if (vName) {
        // 1a. Match by vaccine name on completed status
        const matchComp = patientVaxes.find(
          (v) =>
            String(v.status || "").toUpperCase() === "COMPLETED" &&
            ((v.vaccineName || "").toLowerCase().includes(vName) ||
              vName.includes((v.vaccineName || "").toLowerCase()))
        );
        if (matchComp?.batchNumber) return matchComp.batchNumber;

        // 1b. Any match for this patient with this vaccine name
        const anyMatch = patientVaxes.find(
          (v) =>
            (v.vaccineName || "").toLowerCase().includes(vName) ||
            vName.includes((v.vaccineName || "").toLowerCase())
        );
        if (anyMatch?.batchNumber) return anyMatch.batchNumber;
      }

      // 1c. If no vaccine name typed yet, get this patient's most recent completed vaccine batch
      const latestComp = patientVaxes.find(
        (v) => String(v.status || "").toUpperCase() === "COMPLETED"
      );
      if (!vName && latestComp?.batchNumber) return latestComp.batchNumber;
    }

    // 2. Second priority: Check if any patient in the clinic had a completed vaccination with this vaccine name
    if (vName && vaxList && vaxList.length > 0) {
      const clinicComp = vaxList.find(
        (v) =>
          String(v.status || "").toUpperCase() === "COMPLETED" &&
          (v.batchNumber || "").trim() !== "" &&
          ((v.vaccineName || "").toLowerCase().includes(vName) ||
            vName.includes((v.vaccineName || "").toLowerCase()))
      );
      if (clinicComp?.batchNumber) return clinicComp.batchNumber;
    }

    // 3. Third priority: Inventory batches
    if (vName && batchesList && batchesList.length > 0) {
      const match = batchesList.find(
        (b) =>
          b.medicineName &&
          (b.medicineName.toLowerCase().includes(vName) ||
            vName.includes(b.medicineName.toLowerCase()))
      );
      if (match && match.batchNumber) {
        return match.batchNumber;
      }
    }

    // 4. Default: Auto-generate standard batch
    const prefix = vName
      ? vName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase() || "VAC"
      : "VAC";
    const now = new Date();
    const yr = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, "0");
    const rand = Math.floor(100 + Math.random() * 900);
    return `BAT-${prefix}-${yr}${mo}-${rand}`;
  };

  const openRecordModal = (presetPatientId = "") => {
    const pid =
      presetPatientId ||
      searchParams.get("patientId") ||
      (patients[0]?.id ? String(patients[0].id) : "");
    const autoBatch = generateOrFetchBatch("", pid, batches, vaccinations);
    setForm({
      patientId: pid,
      vaccineName: "",
      vaccineType: "Routine",
      dosage: "1 ml",
      batchNumber: autoBatch,
      vaccinationDate: today,
      nextDueDate: plusDays(365),
      status: "Scheduled",
    });
    setModalOpen(true);
  };

  // New Vaccination Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    patientId: searchParams.get("patientId") || "",
    vaccineName: "",
    vaccineType: "Routine",
    dosage: "1 ml",
    batchNumber: "",
    vaccinationDate: today,
    nextDueDate: plusDays(365),
    status: "Scheduled",
  });

  const load = async () => {
    try {
      setLoading(true);
      const [vList, pList, mList, bList] = await Promise.all([
        getVaccinations(),
        getPatients().catch(() => []),
        getMedicines().catch(() => []),
        getBatches().catch(() => []),
      ]);
      setVaccinations(Array.isArray(vList) ? vList : []);
      setPatients(Array.isArray(pList) ? pList : []);
      setInventoryMeds(Array.isArray(mList) ? mList : []);
      setBatches(Array.isArray(bList) ? bList : []);
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Could not load vaccinations"
      );
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
      openRecordModal(paramPid);
    }
  }, [searchParams]);

  const changeTab = (key) => {
    setTab(key);
    setSearchParams(key === "dueNow" ? {} : { tab: key });
  };

  const handleSaveVaccination = async () => {
    if (!form.patientId) return toast.error("Select a patient");
    if (!form.vaccineName.trim()) return toast.error("Enter vaccine name");

    try {
      setSaving(true);
      const finalBatch =
        form.batchNumber?.trim() ||
        generateOrFetchBatch(form.vaccineName, batches);

      await createVaccination({
        patientId: Number(form.patientId),
        vaccineName: form.vaccineName.trim(),
        vaccineType: form.vaccineType,
        dosage: form.dosage,
        batchNumber: finalBatch,
        vaccinationDate: form.vaccinationDate,
        nextDueDate: form.nextDueDate || null,
        status: form.status,
      });
      toast.success("Vaccination recorded successfully");
      setModalOpen(false);
      setForm({
        patientId: "",
        vaccineName: "",
        vaccineType: "Routine",
        dosage: "1 ml",
        batchNumber: "",
        vaccinationDate: today,
        nextDueDate: plusDays(365),
        status: "Scheduled",
      });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Could not record vaccination");
    } finally {
      setSaving(false);
    }
  };

  const buckets = useMemo(() => {
    const overdue = [];
    const dueNow = [];
    const week = [];
    const completed = [];
    const weekLimit = plusDays(7);

    vaccinations.forEach((vaccination) => {
      if (isCompleted(vaccination)) {
        completed.push(vaccination);
        return;
      }

      const status = String(vaccination.status || "").toUpperCase();

      // If marked OVERDUE or due date is in the past, it goes to Overdue
      if (
        status === "OVERDUE" ||
        (vaccination.nextDueDate && vaccination.nextDueDate < today)
      ) {
        overdue.push(vaccination);
        return;
      }

      if (!vaccination.nextDueDate) {
        dueNow.push(vaccination);
        return;
      }

      if (vaccination.nextDueDate === today) {
        dueNow.push(vaccination);
      } else if (vaccination.nextDueDate <= weekLimit) {
        week.push(vaccination);
      } else {
        dueNow.push(vaccination);
      }
    });

    const byDate = (a, b) =>
      String(a.nextDueDate || "").localeCompare(String(b.nextDueDate || ""));

    overdue.sort(byDate);
    dueNow.sort(byDate);
    week.sort(byDate);
    completed.sort(byDate);

    return { overdue, dueNow, week, completed };
  }, [vaccinations]);

  const counts = {
    dueNow: buckets.dueNow.length,
    overdue: buckets.overdue.length,
    week: buckets.week.length,
    completed: buckets.completed.length,
  };

  const visible = useMemo(() => {
    const raw = buckets[tab] || [];
    if (!query.trim()) return raw;
    const q = query.toLowerCase();
    return raw.filter(
      (v) =>
        (v.patientName || "").toLowerCase().includes(q) ||
        (v.vaccineName || "").toLowerCase().includes(q) ||
        (v.batchNumber || "").toLowerCase().includes(q)
    );
  }, [buckets, tab, query]);

  const handleToggleStatus = async (vaccination) => {
    const completed = isCompleted(vaccination);
    const nextStatus = completed ? "PENDING" : "COMPLETED";

    setUpdatingId(vaccination.id);

    const previous = vaccinations;
    setVaccinations((current) =>
      current.map((v) =>
        v.id === vaccination.id ? { ...v, status: nextStatus } : v
      )
    );

    try {
      await updateVaccination(vaccination.id, { status: nextStatus });
      toast.success(
        nextStatus === "COMPLETED"
          ? "Vaccination marked completed"
          : "Vaccination marked pending"
      );
      if (nextStatus === "COMPLETED") {
        changeTab("completed");
      } else {
        const isPast = vaccination.nextDueDate && vaccination.nextDueDate < today;
        const isThisWeek = vaccination.nextDueDate && vaccination.nextDueDate <= plusDays(7);
        changeTab(isPast ? "overdue" : isThisWeek ? "week" : "dueNow");
      }
    } catch (error) {
      setVaccinations(previous);
      toast.error(
        error?.response?.data?.message || "Could not update vaccination"
      );
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="table-card">
        <div className="table-empty">Loading vaccinations...</div>
      </div>
    );
  }

  return (
    <div className="stack-6">
      <div className="stat-grid">
        <StatCard
          icon={FiClock}
          label="Due now"
          value={counts.dueNow}
          iconBg="info"
          hoverColor="#2563EB"
          onClick={() => changeTab("dueNow")}
        />
        <StatCard
          icon={FiAlertCircle}
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
          iconBg="primary"
          hoverColor="#0F4C5C"
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
            placeholder="Search by pet name, vaccine or batch..."
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

          <Button icon={FiPlus} onClick={() => openRecordModal()}>
            Record Vaccine
          </Button>
        </div>
      </div>

      <div className="table-card">
        <div className="row-list">
          {visible.map((vaccination) => {
            const completed = isCompleted(vaccination);
            const status = String(vaccination.status || "").toUpperCase();
            const isOverdue =
              !completed &&
              (tab === "overdue" ||
                status === "OVERDUE" ||
                Boolean(vaccination.nextDueDate && vaccination.nextDueDate < today));
            const dueThisWeek =
              !completed &&
              !isOverdue &&
              (tab === "week" || Boolean(vaccination.nextDueDate && vaccination.nextDueDate <= plusDays(7)));
            const isUpdating = updatingId === vaccination.id;

            return (
              <div key={vaccination.id} className="row-item">
                <div
                  className="row-avatar"
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    navigate(`/patients/${vaccination.patientId}`)
                  }
                  title="Open Patient Profile"
                >
                  🐾
                </div>

                <div
                  className="row-body"
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    navigate(`/patients/${vaccination.patientId}`)
                  }
                >
                  <p className="row-title">
                    {vaccination.patientName || "Patient"}
                    {vaccination.vaccineName
                      ? ` · ${vaccination.vaccineName}`
                      : ""}
                  </p>
                  <p className="row-desc">
                    {completed
                      ? `Vaccinated: ${vaccination.vaccinationDate || "—"}`
                      : `Next Due: ${vaccination.nextDueDate || "—"}`}
                    {vaccination.batchNumber ? ` · Batch #${vaccination.batchNumber}` : ""}
                  </p>
                </div>

                <div className="vaccination-row-actions">
                  <Badge
                    variant={
                      completed
                        ? "success"
                        : isOverdue
                        ? "danger"
                        : dueThisWeek
                        ? "info"
                        : "warning"
                    }
                  >
                    {completed
                      ? "Completed"
                      : isOverdue
                      ? "Overdue"
                      : dueThisWeek
                      ? "This week"
                      : "Due now"}
                  </Badge>


                  {!completed && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={isUpdating}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStatus(vaccination);
                      }}
                    >
                      Mark completed
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {!visible.length && (
            <p className="table-empty">
              {tab === "overdue"
                ? "No overdue vaccinations."
                : tab === "week"
                ? "No vaccinations due this week."
                : tab === "completed"
                ? "No completed vaccinations."
                : "No vaccinations due."}
            </p>
          )}
        </div>
      </div>

      {/* RECORD VACCINATION MODAL */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record Vaccination"
        subtitle="Schedule or record a vaccination for a patient"
      >
        <div className="form-grid-2">
          <Field label="Patient" className="col-span-2">
            <Select
              value={form.patientId}
              onChange={(e) => {
                const pid = e.target.value;
                const autoBatch = generateOrFetchBatch(
                  form.vaccineName,
                  pid,
                  batches,
                  vaccinations
                );
                setForm({
                  ...form,
                  patientId: pid,
                  batchNumber: autoBatch,
                });
              }}
            >
              <option value="">Select a patient</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.breed || p.species} · {p.ownerName || ""}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Vaccine Name" className="col-span-2">
            <Input
              value={form.vaccineName}
              onChange={(e) => {
                const name = e.target.value;
                const autoBatch = generateOrFetchBatch(
                  name,
                  form.patientId,
                  batches,
                  vaccinations
                );
                setForm({
                  ...form,
                  vaccineName: name,
                  batchNumber: autoBatch,
                });
              }}
              placeholder="e.g. Anti-Rabies, DHPP, FVRCP"
              autoFocus
            />
          </Field>

          <Field label="Vaccine Type">
            <Select
              value={form.vaccineType}
              onChange={(e) => setForm({ ...form, vaccineType: e.target.value })}
            >
              <option value="Routine">Routine</option>
              <option value="Core">Core</option>
              <option value="Non-Core">Non-Core</option>
              <option value="Booster">Booster</option>
            </Select>
          </Field>

          <Field label="Dosage">
            <Input
              value={form.dosage}
              onChange={(e) => setForm({ ...form, dosage: e.target.value })}
            />
          </Field>

          <Field label="Batch Number">
            <Input
              value={form.batchNumber}
              onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
              placeholder="e.g. BATCH-2026-X"
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

          <Field label="Date Administered">
            <Input
              type="date"
              value={form.vaccinationDate}
              onChange={(e) => setForm({ ...form, vaccinationDate: e.target.value })}
            />
          </Field>

          <Field label="Next Due Date">
            <Input
              type="date"
              value={form.nextDueDate}
              onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })}
            />
          </Field>
        </div>

        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSaveVaccination} disabled={saving}>
            {saving ? "Saving..." : "Record Vaccine"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
