import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiArrowLeft,
  FiPlus,
  FiCalendar,
  FiClock,
  FiActivity,
  FiPhone,
  FiMail,
  FiMapPin,
  FiExternalLink,
} from "react-icons/fi";
import { FaPrescriptionBottleAlt, FaSyringe } from "react-icons/fa";
import toast from "react-hot-toast";

import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import NewVisitModal from "../../components/modals/NewVisitModal";
import Modal from "../../components/ui/Modal";
import Input, { Field, Select, Textarea } from "../../components/ui/Input";

import { getPatientById } from "../../services/patientService";
import { getMedicalRecordsByPatient } from "../../services/medicalRecordService";
import {
  getVaccinationsByPatient,
  createVaccination,
  updateVaccination,
} from "../../services/vaccinationService";
import { getPrescriptionsByPatient } from "../../services/prescriptionService";
import {
  getFollowupsByPatient,
  createFollowup,
  updateFollowup,
} from "../../services/followupService";
import { getAppointmentsByPatient } from "../../services/appointmentService";
import { getBatches } from "../../services/inventoryService";
import { formatPrescriptionId } from "../Prescription/Prescription";
import "./PatientProfile.css";

const TABS = [
  { key: "records", label: "Medical History", icon: FiActivity },
  { key: "prescriptions", label: "Prescriptions", icon: FaPrescriptionBottleAlt },
  { key: "vaccinations", label: "Vaccinations", icon: FaSyringe },
  { key: "followups", label: "Follow-ups", icon: FiClock },
  { key: "appointments", label: "Visits", icon: FiCalendar },
];

export default function PatientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("records");
  const [patient, setPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [vaccinations, setVaccinations] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [batches, setBatches] = useState([]);

  const generateOrFetchBatch = (
    vaccineName,
    batchesList = batches,
    vaxList = vaccinations
  ) => {
    const vName = (vaccineName || "").trim().toLowerCase();

    // 1. First priority: Check this patient's completed vaccinations
    if (vaxList && vaxList.length > 0) {
      if (vName) {
        const matchComp = vaxList.find(
          (v) =>
            String(v.status || "").toUpperCase() === "COMPLETED" &&
            (v.batchNumber || "").trim() !== "" &&
            ((v.vaccineName || "").toLowerCase().includes(vName) ||
              vName.includes((v.vaccineName || "").toLowerCase()))
        );
        if (matchComp?.batchNumber) return matchComp.batchNumber;

        const anyMatch = vaxList.find(
          (v) =>
            (v.batchNumber || "").trim() !== "" &&
            ((v.vaccineName || "").toLowerCase().includes(vName) ||
              vName.includes((v.vaccineName || "").toLowerCase()))
        );
        if (anyMatch?.batchNumber) return anyMatch.batchNumber;
      }

      const latestCompleted = vaxList.find(
        (v) =>
          String(v.status || "").toUpperCase() === "COMPLETED" &&
          (v.batchNumber || "").trim() !== ""
      );
      if (!vName && latestCompleted?.batchNumber) {
        return latestCompleted.batchNumber;
      }
    }

    // 2. Second priority: Inventory batches
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

    // 3. Fallback: Auto-generate
    const prefix = vName
      ? vName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase() || "VAC"
      : "VAC";
    const now = new Date();
    const yr = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, "0");
    const rand = Math.floor(100 + Math.random() * 900);
    return `BAT-${prefix}-${yr}${mo}-${rand}`;
  };

  const openAddVaccineModal = () => {
    const autoBatch = generateOrFetchBatch("", batches, vaccinations);
    setVacForm({
      vaccineName: "",
      vaccineType: "Routine",
      dosage: "1 ml",
      batchNumber: autoBatch,
      vaccinationDate: new Date().toISOString().slice(0, 10),
      nextDueDate: "",
      status: "Scheduled",
    });
    setVacModalOpen(true);
  };

  // Modals state
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [vacModalOpen, setVacModalOpen] = useState(false);
  const [vacForm, setVacForm] = useState({
    vaccineName: "",
    vaccineType: "Routine",
    dosage: "1 ml",
    batchNumber: "",
    vaccinationDate: new Date().toISOString().slice(0, 10),
    nextDueDate: "",
    status: "Scheduled",
  });
  const [fuModalOpen, setFuModalOpen] = useState(false);
  const [fuForm, setFuForm] = useState({
    followUpDate: new Date().toISOString().slice(0, 10),
    nextFollowUpDate: "",
    reason: "",
    notes: "",
    status: "Scheduled",
  });
  const [savingAction, setSavingAction] = useState(false);

  // =====================================================
  // LOAD PATIENT PROFILE & ALL CONNECTED DATA
  // =====================================================

  const loadAll = async () => {
    try {
      setLoading(true);
      setError("");

      const [patientData, medicalData, prescriptionData, vaccinationData, followupData, apptData, batchData] =
        await Promise.all([
          getPatientById(id),
          getMedicalRecordsByPatient(id).catch(() => []),
          getPrescriptionsByPatient(id).catch(() => []),
          getVaccinationsByPatient(id).catch(() => []),
          getFollowupsByPatient(id).catch(() => []),
          getAppointmentsByPatient(id).catch(() => []),
          getBatches().catch(() => []),
        ]);

      setPatient(patientData);
      setRecords(Array.isArray(medicalData) ? medicalData : []);
      setPrescriptions(Array.isArray(prescriptionData) ? prescriptionData : []);
      setVaccinations(Array.isArray(vaccinationData) ? vaccinationData : []);
      setFollowups(Array.isArray(followupData) ? followupData : []);
      setAppointments(Array.isArray(apptData) ? apptData : []);
      setBatches(Array.isArray(batchData) ? batchData : []);
    } catch (e) {
      console.error("Unable to load patient profile:", e);
      setError(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          "Unable to load patient profile."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadAll();
    }
  }, [id]);

  // Handle Quick Add Vaccination
  const handleCreateVaccination = async () => {
    if (!vacForm.vaccineName.trim()) {
      return toast.error("Vaccine name is required");
    }
    try {
      setSavingAction(true);
      const finalBatch =
        vacForm.batchNumber?.trim() ||
        generateOrFetchBatch(vacForm.vaccineName, batches);

      await createVaccination({
        patientId: Number(id),
        vaccineName: vacForm.vaccineName.trim(),
        vaccineType: vacForm.vaccineType,
        dosage: vacForm.dosage,
        batchNumber: finalBatch,
        vaccinationDate: vacForm.vaccinationDate,
        nextDueDate: vacForm.nextDueDate || null,
        status: vacForm.status || "Scheduled",
      });
      toast.success("Vaccination recorded");
      setVacModalOpen(false);
      setVacForm({
        vaccineName: "",
        vaccineType: "Routine",
        dosage: "1 ml",
        batchNumber: "",
        vaccinationDate: new Date().toISOString().slice(0, 10),
        nextDueDate: "",
        status: "Scheduled",
      });
      loadAll();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Could not record vaccination");
    } finally {
      setSavingAction(false);
    }
  };

  // Handle Quick Schedule Follow-up
  const handleCreateFollowup = async () => {
    if (!fuForm.followUpDate) {
      return toast.error("Follow-up date is required");
    }
    try {
      setSavingAction(true);
      await createFollowup({
        patientId: Number(id),
        followUpDate: fuForm.followUpDate,
        nextFollowUpDate: fuForm.nextFollowUpDate || fuForm.followUpDate,
        reason: fuForm.reason || "Routine follow-up",
        notes: fuForm.notes,
        status: fuForm.status || "Scheduled",
      });
      toast.success("Follow-up scheduled");
      setFuModalOpen(false);
      setFuForm({
        followUpDate: new Date().toISOString().slice(0, 10),
        nextFollowUpDate: "",
        reason: "",
        notes: "",
        status: "Scheduled",
      });
      loadAll();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Could not schedule follow-up");
    } finally {
      setSavingAction(false);
    }
  };

  // Toggle Vaccination Status
  const handleToggleVaccine = async (v) => {
    const isCompleted = String(v.status || "").toUpperCase() === "COMPLETED";
    const nextStatus = isCompleted ? "SCHEDULED" : "COMPLETED";
    try {
      await updateVaccination(v.id, { status: nextStatus });
      toast.success(`Vaccination marked ${nextStatus.toLowerCase()}`);
      loadAll();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Could not update status");
    }
  };

  // Toggle Follow-up Status
  const handleToggleFollowup = async (f) => {
    const isCompleted = String(f.status || "").toUpperCase() === "COMPLETED";
    const nextStatus = isCompleted ? "SCHEDULED" : "COMPLETED";
    try {
      await updateFollowup(f.id, { ...f, status: nextStatus });
      toast.success(`Follow-up marked ${nextStatus.toLowerCase()}`);
      loadAll();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Could not update follow-up");
    }
  };

  if (loading) {
    return (
      <div className="table-card">
        <div className="table-empty">Loading patient profile...</div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="stack-6">
        <div className="appt-toolbar">
          <Button
            variant="secondary"
            icon={FiArrowLeft}
            onClick={() => navigate("/patients")}
          >
            Back to patients
          </Button>
        </div>
        <div className="table-card">
          <div className="table-empty">{error || "Patient not found."}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="stack-6">
      {/* HEADER BAR */}
      <div className="appt-toolbar">
        <Button
          variant="secondary"
          icon={FiArrowLeft}
          onClick={() => navigate("/patients")}
        >
          Back to patients
        </Button>
      </div>

      {error && (
        <div className="table-card" style={{ padding: 14, color: "#be123c" }}>
          {error}
        </div>
      )}

      {/* PATIENT & PARENT INFO PANEL */}
      <div className="panel">
        <div className="cell-primary" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div className="flex-row" style={{ gap: 16, alignItems: "center" }}>
            <div
              className="row-avatar"
              style={{ width: 56, height: 56, fontSize: 28 }}
            >
              {patient.icon || "🐾"}
            </div>

            <div>
              <div className="flex-row" style={{ gap: 8, alignItems: "center" }}>
                <h2 className="panel-title" style={{ fontSize: 22, margin: 0 }}>
                  {patient.name || "Unnamed patient"}
                </h2>
                {patient.petId && (
                  <Badge variant="navy">{patient.petId}</Badge>
                )}
                <Badge variant={patient.status === "ACTIVE" || !patient.status ? "success" : "slate"}>
                  {patient.status || "ACTIVE"}
                </Badge>
              </div>

              <p className="panel-subtitle" style={{ marginTop: 4 }}>
                {[patient.species, patient.breed, patient.gender, patient.weight ? `${patient.weight} kg` : null]
                  .filter(Boolean)
                  .join(" · ") || "Pet Patient"}
              </p>
            </div>
          </div>

          {/* PARENT / OWNER SUMMARY */}
          <div className="patient-profile-owner-box">
            <p className="eyebrow" style={{ marginBottom: 4 }}>
              Parent (Owner) Details
            </p>
            <p className="cell-title" style={{ fontSize: 14 }}>
              {patient.ownerName || "—"}
            </p>
            <div className="cell-sub" style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
              {patient.ownerPhone && (
                <span className="flex-row" style={{ gap: 6, alignItems: "center" }}>
                  <FiPhone size={12} /> {patient.ownerPhone}
                </span>
              )}
              {patient.ownerEmail && (
                <span className="flex-row" style={{ gap: 6, alignItems: "center" }}>
                  <FiMail size={12} /> {patient.ownerEmail}
                </span>
              )}
              {(patient.ownerCity || patient.ownerAddress) && (
                <span className="flex-row" style={{ gap: 6, alignItems: "center" }}>
                  <FiMapPin size={12} /> {[patient.ownerAddress, patient.ownerCity].filter(Boolean).join(", ")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* DETAILS GRID */}
        <div
          className="rx-preview-grid"
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
          }}
        >
          <div>
            <p className="eyebrow">Date of Birth</p>
            <p className="cell-title">{patient.dateOfBirth || "—"}</p>
          </div>
          <div>
            <p className="eyebrow">Weight</p>
            <p className="cell-title">{patient.weight != null ? `${patient.weight} kg` : "—"}</p>
          </div>
          <div>
            <p className="eyebrow">Gender</p>
            <p className="cell-title">{patient.gender || "—"}</p>
          </div>
          <div>
            <p className="eyebrow">Medical Alerts</p>
            <p className="cell-title" style={{ color: patient.medicalAlerts ? "#e11d48" : "inherit" }}>
              {patient.medicalAlerts || "None"}
            </p>
          </div>
        </div>
      </div>

      {/* TIMELINE TABS */}
      <div className="filter-row">
        {TABS.map((t) => {
          const Icon = t.icon;
          const count =
            t.key === "records"
              ? records.length
              : t.key === "prescriptions"
              ? prescriptions.length
              : t.key === "vaccinations"
              ? vaccinations.length
              : t.key === "followups"
              ? followups.length
              : appointments.length;

          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`filter-chip ${activeTab === t.key ? "active" : ""}`}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Icon size={14} /> {t.label} ({count})
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: MEDICAL RECORDS */}
      {activeTab === "records" && (
        <div className="panel">
          <div className="panel-header" style={{ marginBottom: 16 }}>
            <h3 className="panel-title">Consultations & Medical Records</h3>
            <Button
              size="sm"
              icon={FaPrescriptionBottleAlt}
              onClick={() => navigate(`/prescriptions?patientId=${patient.id}`)}
            >
              New Consultation
            </Button>
          </div>

          <div className="row-list">
            {records.map((r) => (
              <div key={r.id} className="row-item" style={{ alignItems: "flex-start" }}>
                <div className="row-body">
                  <div className="flex-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <p className="row-title" style={{ fontSize: 15 }}>
                      {r.visitDate || "—"} · {r.diagnosis || "Consultation"}
                    </p>
                    <span className="cell-sub">{r.doctorName ? `Dr. ${r.doctorName.replace(/^Dr\.?\s*/i, "")}` : ""}</span>
                  </div>
                  {r.chiefComplaint && (
                    <p className="row-desc" style={{ marginTop: 4 }}>
                      <strong>Complaint:</strong> {r.chiefComplaint}
                    </p>
                  )}
                  {r.symptoms && (
                    <p className="row-desc">
                      <strong>Symptoms:</strong> {r.symptoms}
                    </p>
                  )}
                  {r.treatment && (
                    <p className="row-desc">
                      <strong>Treatment:</strong> {r.treatment}
                    </p>
                  )}
                  {r.notes && (
                    <p className="row-desc" style={{ fontStyle: "italic" }}>
                      <strong>Notes:</strong> {r.notes}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {!records.length && <p className="table-empty">No medical records on file.</p>}
          </div>
        </div>
      )}

      {/* TAB CONTENT: PRESCRIPTIONS */}
      {activeTab === "prescriptions" && (
        <div className="panel">
          <div className="panel-header" style={{ marginBottom: 16 }}>
            <h3 className="panel-title">Prescriptions History</h3>
            <Button
              size="sm"
              icon={FaPrescriptionBottleAlt}
              onClick={() => navigate(`/prescriptions?patientId=${patient.id}`)}
            >
              New Prescription
            </Button>
          </div>

          <div className="row-list">
            {prescriptions.map((rx) => (
              <div key={rx.id} className="row-item" style={{ alignItems: "flex-start" }}>
                <div className="row-body">
                  <div className="flex-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <p className="row-title" style={{ fontSize: 15 }}>
                      Prescription #{formatPrescriptionId(rx.id, rx.prescriptionDate)} · {rx.prescriptionDate || "—"}
                    </p>
                    <button
                      type="button"
                      className="link-action"
                      onClick={() => navigate(`/prescriptions?id=${rx.id}&patientId=${patient.id}`)}
                      title="Open in Prescriptions"
                    >
                      Open <FiExternalLink size={13} />
                    </button>
                  </div>
                  <p className="row-desc" style={{ fontWeight: 600 }}>
                    Diagnosis: {rx.diagnosis || "General Consultation"}
                  </p>
                  {rx.items && rx.items.length > 0 && (
                    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {rx.items.map((it, idx) => (
                        <Badge key={idx} variant="info">
                          💊 {it.medicineName || "Medicine"} {it.dosage ? `(${it.dosage})` : ""} {it.frequency || ""}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {rx.instructions && (
                    <p className="row-desc" style={{ marginTop: 6 }}>
                      <strong>Instructions:</strong> {rx.instructions}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {!prescriptions.length && <p className="table-empty">No prescriptions issued yet.</p>}
          </div>
        </div>
      )}

      {/* TAB CONTENT: VACCINATIONS */}
      {activeTab === "vaccinations" && (
        <div className="panel">
          <div className="panel-header" style={{ marginBottom: 16 }}>
            <h3 className="panel-title">Vaccination Record</h3>
            <Button size="sm" icon={FaSyringe} onClick={openAddVaccineModal}>
              Add Vaccine
            </Button>
          </div>

          <div className="row-list">
            {vaccinations.map((v) => {
              const isComp = String(v.status || "").toUpperCase() === "COMPLETED";
              return (
                <div key={v.id} className="row-item">
                  <div className="row-body">
                    <p className="row-title">{v.vaccineName || "Vaccine"}</p>
                    <p className="row-desc">
                      Given: {v.vaccinationDate || "—"} · Next Due: {v.nextDueDate || "—"}
                      {v.batchNumber ? ` · Batch: ${v.batchNumber}` : ""}
                    </p>
                  </div>
                  <Badge variant={isComp ? "success" : "warning"}>
                    {isComp ? "Completed" : "Scheduled"}
                  </Badge>
                  {!isComp && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleToggleVaccine(v)}
                    >
                      Mark completed
                    </button>
                  )}
                </div>
              );
            })}
            {!vaccinations.length && <p className="table-empty">No vaccinations recorded.</p>}
          </div>
        </div>
      )}

      {/* TAB CONTENT: FOLLOW-UPS */}
      {activeTab === "followups" && (
        <div className="panel">
          <div className="panel-header" style={{ marginBottom: 16 }}>
            <h3 className="panel-title">Follow-up Schedule</h3>
            <Button size="sm" icon={FiClock} onClick={() => setFuModalOpen(true)}>
              Schedule Follow-up
            </Button>
          </div>

          <div className="row-list">
            {followups.map((f) => {
              const isComp = String(f.status || "").toUpperCase() === "COMPLETED";
              return (
                <div key={f.id} className="row-item">
                  <div className="row-body">
                    <p className="row-title">{f.reason || "Routine Follow-up"}</p>
                    <p className="row-desc">
                      Date: {f.nextFollowUpDate || f.followUpDate || "—"}
                      {f.notes ? ` · ${f.notes}` : ""}
                    </p>
                  </div>
                  <Badge variant={isComp ? "success" : "warning"}>
                    {isComp ? "Completed" : "Scheduled"}
                  </Badge>
                  {!isComp && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleToggleFollowup(f)}
                    >
                      Mark completed
                    </button>
                  )}
                </div>
              );
            })}
            {!followups.length && <p className="table-empty">No follow-ups scheduled.</p>}
          </div>
        </div>
      )}

      {/* TAB CONTENT: APPOINTMENTS */}
      {activeTab === "appointments" && (
        <div className="panel">
          <div className="panel-header" style={{ marginBottom: 16 }}>
            <h3 className="panel-title">Appointments & Visits</h3>
            <Button size="sm" icon={FiCalendar} onClick={() => setVisitModalOpen(true)}>
              Book Visit
            </Button>
          </div>

          <div className="row-list">
            {appointments.map((a) => (
              <div key={a.id} className="row-item">
                <div className="row-body">
                  <p className="row-title">
                    {a.appointmentDate || "—"} at {a.appointmentTime || "—"} · {a.appointmentType || "Visit"}
                  </p>
                  <p className="row-desc">
                    {a.reason ? `Reason: ${a.reason}` : "General Visit"}
                    {a.doctorName ? ` · Dr. ${a.doctorName.replace(/^Dr\.?\s*/i, "")}` : ""}
                  </p>
                </div>
                <Badge variant={a.status === "Completed" ? "success" : "navy"}>
                  {(a.status || "Scheduled").toUpperCase()}
                </Badge>
              </div>
            ))}
            {!appointments.length && <p className="table-empty">No visits recorded.</p>}
          </div>
        </div>
      )}

      {/* MODALS */}
      <NewVisitModal
        open={visitModalOpen}
        onClose={() => setVisitModalOpen(false)}
        onCreated={loadAll}
        appointment={{ patientId: patient.id }}
      />

      {/* VACCINATION MODAL */}
      <Modal
        open={vacModalOpen}
        onClose={() => setVacModalOpen(false)}
        title="Record Vaccination"
        subtitle={`Add vaccination record for ${patient.name}`}
      >
        <div className="form-grid-2">
          <Field label="Vaccine Name" className="col-span-2">
            <Input
              value={vacForm.vaccineName}
              onChange={(e) => {
                const name = e.target.value;
                const autoBatch = generateOrFetchBatch(name, batches);
                setVacForm({
                  ...vacForm,
                  vaccineName: name,
                  batchNumber: autoBatch,
                });
              }}
              placeholder="e.g. Rabies, DHPP, Anti-rabies"
              autoFocus
            />
          </Field>
          <Field label="Batch Number">
            <Input
              value={vacForm.batchNumber}
              onChange={(e) => setVacForm({ ...vacForm, batchNumber: e.target.value })}
              placeholder="Auto-fetched batch no."
            />
          </Field>
          <Field label="Vaccine Type">
            <Select
              value={vacForm.vaccineType}
              onChange={(e) => setVacForm({ ...vacForm, vaccineType: e.target.value })}
            >
              <option value="Routine">Routine</option>
              <option value="Core">Core</option>
              <option value="Non-Core">Non-Core</option>
              <option value="Booster">Booster</option>
            </Select>
          </Field>
          <Field label="Dosage">
            <Input
              value={vacForm.dosage}
              onChange={(e) => setVacForm({ ...vacForm, dosage: e.target.value })}
            />
          </Field>
          <Field label="Vaccination Date">
            <Input
              type="date"
              value={vacForm.vaccinationDate}
              onChange={(e) => setVacForm({ ...vacForm, vaccinationDate: e.target.value })}
            />
          </Field>
          <Field label="Next Due Date">
            <Input
              type="date"
              value={vacForm.nextDueDate}
              onChange={(e) => setVacForm({ ...vacForm, nextDueDate: e.target.value })}
            />
          </Field>
        </div>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setVacModalOpen(false)} disabled={savingAction}>
            Cancel
          </Button>
          <Button onClick={handleCreateVaccination} disabled={savingAction}>
            {savingAction ? "Saving..." : "Save Vaccine"}
          </Button>
        </div>
      </Modal>

      {/* FOLLOW-UP MODAL */}
      <Modal
        open={fuModalOpen}
        onClose={() => setFuModalOpen(false)}
        title="Schedule Follow-up"
        subtitle={`Schedule follow-up check for ${patient.name}`}
      >
        <div className="form-grid-2">
          <Field label="Follow-up Date">
            <Input
              type="date"
              value={fuForm.followUpDate}
              onChange={(e) => setFuForm({ ...fuForm, followUpDate: e.target.value })}
              autoFocus
            />
          </Field>
          <Field label="Next Follow-up Due">
            <Input
              type="date"
              value={fuForm.nextFollowUpDate}
              onChange={(e) => setFuForm({ ...fuForm, nextFollowUpDate: e.target.value })}
            />
          </Field>
          <Field label="Reason" className="col-span-2">
            <Input
              value={fuForm.reason}
              onChange={(e) => setFuForm({ ...fuForm, reason: e.target.value })}
              placeholder="e.g. Post-treatment recovery check"
            />
          </Field>
          <Field label="Clinical Notes" className="col-span-2">
            <Textarea
              rows={2}
              value={fuForm.notes}
              onChange={(e) => setFuForm({ ...fuForm, notes: e.target.value })}
              placeholder="Enter any instructions or reminders"
            />
          </Field>
        </div>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setFuModalOpen(false)} disabled={savingAction}>
            Cancel
          </Button>
          <Button onClick={handleCreateFollowup} disabled={savingAction}>
            {savingAction ? "Scheduling..." : "Schedule Follow-up"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}