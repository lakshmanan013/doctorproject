import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { FiMic, FiMicOff, FiTrash2, FiDownload, FiSend, FiMail, FiMessageSquare, FiPlusCircle } from "react-icons/fi";
import { FaWhatsapp, FaPaw } from "react-icons/fa";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import Input, { Field, Select, Textarea } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { getPatients } from "../../services/patientService";
import { getMedicines } from "../../services/medicineService";
import { getPrescriptions, getPrescriptionById, getPrescriptionsByPatient, createPrescription, updatePrescription } from "../../services/prescriptionService";
import { createMedicalRecord } from "../../services/medicalRecordService";
import { createVaccination } from "../../services/vaccinationService";
import { sendSms, sendWhatsApp, sendEmail } from "../../services/communicationService";
import { openWhatsApp } from "../../utils/whatsapp";
import { toE164 } from "../../utils/phone";
import useDoctorProfile from "../../hooks/useDoctorProfile";
import "./Prescription.css";

const emptyMed = () => ({ id: Date.now() + Math.random(), medicineId: "", dosage: "", frequency: "Once daily", duration: "", route: "", quantity: "", instructions: "" });

export const formatPrescriptionId = (id, dateStr) => {
  const year = dateStr ? (new Date(dateStr).getFullYear() || 2026) : 2026;
  const num = Number(id) || 1;
  return `${year}/Z${String(num).padStart(3, "0")}`;
};

export default function Prescription() {
  const [searchParams] = useSearchParams();
  const [patients, setPatients] = useState([]);
  const [allMeds, setAllMeds] = useState([]);
  const [patientId, setPatientId] = useState(searchParams.get("patientId") || "");
  const appointmentId = searchParams.get("appointmentId");
  const [diagnosis, setDiagnosis] = useState("");
  const [instructions, setInstructions] = useState("");
  const [notes, setNotes] = useState("");
  const [petFood, setPetFood] = useState("");
  const [medicines, setMedicines] = useState([emptyMed()]);
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));
  const [visitType, setVisitType] = useState(searchParams.get("visitType") || searchParams.get("type") || "OPD Consultation");
  const [complaint, setComplaint] = useState("");
  const [vitals, setVitals] = useState({ temp: "", pulse: "", resp: "" });
  const [followUpDays, setFollowUpDays] = useState("7");
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [vaccineName, setVaccineName] = useState("");
  const [vaccineDueDate, setVaccineDueDate] = useState("");
  const [consultationFee, setConsultationFee] = useState("");
  const [followupFee, setFollowupFee] = useState("");
  const [showFeesOnRx, setShowFeesOnRx] = useState(false);
  const [savedRx, setSavedRx] = useState(null);
  const [nextRxId, setNextRxId] = useState(null);
  const savedVaccineRef = useRef(null);
  const previewRef = useRef(null);

  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);
  const speechBaseNotesRef = useRef("");
  const latestNotesRef = useRef(notes);
  const { doctor } = useDoctorProfile();

  const patient = patients.find(p => String(p.id) === String(patientId));
  const notesWithPetFood = useCallback((customNotes = null) => {
    const baseNotes = customNotes !== null ? customNotes : notes;
    return petFood.trim() ? `${baseNotes}${baseNotes.trim() ? "\n\n" : ""}Pet food / diet: ${petFood.trim()}` : baseNotes;
  }, [notes, petFood]);

  // Save or update prescription in Database
  const savePrescriptionToDb = useCallback(async (customNotes = null, silent = false) => {
    if (!patientId) {
      if (!silent) toast.error("Select a patient");
      return null;
    }
    const currentNotes = notesWithPetFood(customNotes);
    const items = medicines.filter(m => m.medicineId).map(m => ({
      medicineId: Number(m.medicineId),
      dosage: m.dosage,
      frequency: m.frequency,
      duration: m.duration,
      route: m.route,
      quantity: m.quantity,
      instructions: m.instructions
    }));

    const payload = {
      patientId: Number(patientId),
      appointmentId: appointmentId ? Number(appointmentId) : undefined,
      prescriptionDate: visitDate,
      diagnosis,
      instructions,
      notes: currentNotes,
      doctorName: doctor?.fullName || "Veterinary Doctor",
      consultationFee: consultationFee !== "" ? Number(consultationFee) : null,
      followUpFee: followupFee !== "" ? Number(followupFee) : null,
      items
    };

    try {
      setSaving(true);
      let rx;
      if (savedRx?.id) {
        rx = await updatePrescription(savedRx.id, payload);
        if (!silent) toast.success(`Prescription #${rx.id} updated`);
      } else {
        rx = await createPrescription(payload);
        if (!silent) toast.success(`Prescription #${rx.id} saved`);
      }

      createMedicalRecord({
        patientId: Number(patientId),
        visitDate,
        chiefComplaint: complaint,
        diagnosis,
        treatment: instructions,
        weight: patient?.weight ?? null,
        temperature: vitals.temp ? Number(vitals.temp) : null,
        notes: currentNotes,
        doctorName: doctor?.fullName || "Veterinary Doctor"
      }).catch(() => { });

      if (vaccineName.trim() && savedVaccineRef.current !== `${patientId}-${vaccineName.trim()}-${vaccineDueDate}`) {
        createVaccination({
          patientId: Number(patientId),
          vaccineName: vaccineName.trim(),
          vaccinationDate: visitDate,
          nextDueDate: vaccineDueDate || null,
          administeredBy: doctor?.fullName || "Veterinary Doctor",
          status: "Scheduled"
        }).then(() => {
          savedVaccineRef.current = `${patientId}-${vaccineName.trim()}-${vaccineDueDate}`;
        }).catch(() => { });
      }

      setSavedRx(rx);
      if (rx?.id) {
        setNextRxId(Number(rx.id) + 1);
      }
      return rx;
    } catch (e) {
      if (!silent) toast.error(e?.response?.data?.message || "Could not save prescription");
      return null;
    } finally {
      setSaving(false);
    }
  }, [patientId, notesWithPetFood, medicines, visitDate, diagnosis, instructions, doctor, consultationFee, followupFee, savedRx, complaint, patient, vitals, vaccineName, vaccineDueDate, appointmentId]);

  useEffect(() => {
    latestNotesRef.current = notes;
  }, [notes]);

  // Voice capture toggle
  const toggleVoiceCapture = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech Recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }

    if (listening) {
      shouldListenRef.current = false;
      setListening(false);
      try {
        recognitionRef.current?.stop();
      } catch { }
      toast("Voice dictation stopped", { icon: "⏹️" });
      return;
    }

    speechBaseNotesRef.current = latestNotesRef.current || "";

    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    shouldListenRef.current = true;

    recognition.onstart = () => {
      console.log("[SpeechRecognition] Started listening");
      setListening(true);
      toast.success("Listening... Speak now", { icon: "🎙️" });
    };

    recognition.onaudiostart = () => {
      console.log("[SpeechRecognition] Audio capture active");
    };

    recognition.onspeechstart = () => {
      console.log("[SpeechRecognition] Speech sound detected");
    };

    recognition.onerror = (e) => {
      console.warn("[SpeechRecognition] Error:", e.error);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast.error("Microphone access blocked. Click the lock/settings icon in the browser address bar to allow Microphone.");
        setListening(false);
        shouldListenRef.current = false;
      } else if (e.error === "audio-capture") {
        toast.error("No microphone detected. Please check your mic connection.");
        setListening(false);
        shouldListenRef.current = false;
      } else if (e.error === "network") {
        toast.error("Speech recognition network error. Please check your internet connection.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        toast.error(`Speech recognition: ${e.error}`);
      }
    };

    recognition.onend = () => {
      console.log("[SpeechRecognition] Ended. shouldListen:", shouldListenRef.current);
      if (shouldListenRef.current) {
        try {
          speechBaseNotesRef.current = latestNotesRef.current || "";
          recognition.start();
          return;
        } catch (err) {
          console.warn("[SpeechRecognition] Auto-restart failed:", err);
        }
      }
      setListening(false);
      recognitionRef.current = null;
    };

    recognition.onresult = (event) => {
      let interimText = "";
      let finalText = "";
      for (let i = 0; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript + " ";
        } else {
          interimText += event.results[i][0].transcript;
        }
      }

      const spokenText = (finalText + interimText).trim();
      const base = speechBaseNotesRef.current ? speechBaseNotesRef.current.trim() : "";
      const combined = base ? (spokenText ? `${base} ${spokenText}` : base) : spokenText;

      setNotes(combined);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      console.error("[SpeechRecognition] Start error:", err);
    }
  };

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [p, m, rxList] = await Promise.all([
          getPatients().catch(() => []),
          getMedicines().catch(() => []),
          getPrescriptions().catch(() => [])
        ]);
        setPatients(Array.isArray(p) ? p : []);
        setAllMeds(Array.isArray(m) ? m : []);

        if (Array.isArray(rxList) && rxList.length > 0) {
          const maxId = Math.max(...rxList.map((x) => Number(x.id) || 0));
          setNextRxId(maxId + 1);
        } else {
          setNextRxId(1);
        }

        const paramRxId = searchParams.get("id") || searchParams.get("prescriptionId");
        if (paramRxId) {
          const loaded = await getPrescriptionById(paramRxId).catch(() => null);
          if (loaded) {
            setSavedRx(loaded);
            if (loaded.patientId) setPatientId(String(loaded.patientId));
            if (loaded.diagnosis) setDiagnosis(loaded.diagnosis);
            if (loaded.instructions) setInstructions(loaded.instructions);
            if (loaded.notes) setNotes(loaded.notes);
            if (loaded.prescriptionDate) setVisitDate(loaded.prescriptionDate);
            if (loaded.items && Array.isArray(loaded.items) && loaded.items.length > 0) {
              setMedicines(loaded.items.map((it) => ({
                id: it.id || Date.now() + Math.random(),
                medicineId: it.medicineId ? String(it.medicineId) : "",
                dosage: it.dosage || "",
                frequency: it.frequency || "Once daily",
                duration: it.duration || "",
                route: it.route || "",
                quantity: it.quantity != null ? String(it.quantity) : "",
                instructions: it.instructions || ""
              })));
            }
          }
        }
      } catch (err) {
        console.error("Failed to load initial prescription data:", err);
      }
    };

    fetchInitialData();
  }, [searchParams]);

  useEffect(() => {
    if (!doctor) return;
    setConsultationFee(prev => prev !== "" ? prev : (doctor.consultationFee ?? ""));
    setFollowupFee(prev => prev !== "" ? prev : (doctor.followUpFee ?? ""));
  }, [doctor]);

  useEffect(() => {
    if (!patientId) {
      setSavedRx(null);
      return;
    }
  }, [patientId]);

  const updateMed = (id, key, value) => setMedicines(ms => ms.map(m => m.id === id ? { ...m, [key]: value } : m));

  const parseQty = (q) => { const digits = String(q || "").match(/\d+/); return digits ? Number(digits[0]) : 1; };
  const medicineTotal = medicines.reduce((sum, m) => { const med = allMeds.find(x => String(x.id) === String(m.medicineId)); if (!med || med.price == null) return sum; return sum + Number(med.price) * parseQty(m.quantity); }, 0);
  const feeTotal = Number(consultationFee || 0) + Number(followupFee || 0);
  const grandTotal = medicineTotal + feeTotal;

  const submit = async () => {
    return await savePrescriptionToDb(null, false);
  };

  const content = () => {
    const clinicHeader = doctor?.clinicHospital || doctor?.clinicName || "Zenve Veterinary Clinic";
    const doctorLine = doctor?.fullName ? (doctor.fullName.toLowerCase().startsWith("dr") ? doctor.fullName : `Dr. ${doctor.fullName}`) : "";
    const prescriptionCode = formatPrescriptionId(savedRx?.id || nextRxId || 1, visitDate);
    return [
      `*${clinicHeader.toUpperCase()}*`,
      `Prescription ID: ${prescriptionCode}`,
      doctorLine ? `Doctor: ${doctorLine}` : null,
      `Date: ${visitDate}`,
      `Visit Type: ${visitType || "OPD Consultation"}`,
      `-----------------------------`,
      `Patient: ${patient?.name || ""}`,
      complaint ? `Complaint: ${complaint}` : null,
      diagnosis ? `Diagnosis: ${diagnosis}` : null,
      `Medicines:\n${medicines.map(m => { const med = allMeds.find(x => String(x.id) === String(m.medicineId)); return `• ${med?.name || ""} ${m.dosage} ${m.frequency} ${m.duration}`.trim(); }).join("\n")}`,
      instructions ? `Instructions: ${instructions}` : null,
      petFood ? `Pet food / diet: ${petFood}` : null,
      vaccineName.trim() ? `Vaccination given: ${vaccineName.trim()}${vaccineDueDate ? ` (next due ${vaccineDueDate})` : ""}` : null,
      showFeesOnRx ? `Medicine charges: ₹${medicineTotal}\nDoctor fee: ₹${feeTotal}\nTotal: ₹${grandTotal}` : null,
      notes ? `Notes: ${notes}` : null,
    ].filter(Boolean).join("\n");
  };

  const downloadPdf = async () => {
    const node = previewRef.current;
    if (!node) return;
    try {
      setGeneratingPdf(true);

      // Clone node and render with full A4 dimensions (794px width x ~1123px height)
      const clone = node.cloneNode(true);
      clone.classList.add("rx-a4-full-export");
      clone.style.position = "fixed";
      clone.style.top = "0";
      clone.style.left = "0";
      clone.style.width = "794px";
      clone.style.minHeight = "1123px";
      clone.style.zIndex = "-999";
      clone.style.boxShadow = "none";
      clone.style.borderRadius = "0";
      clone.style.border = "none";
      clone.style.background = "#ffffff";
      document.body.appendChild(clone);

      // Wait brief moment for fonts and layout reflow
      await new Promise((resolve) => setTimeout(resolve, 80));

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: 794,
        windowWidth: 794,
      });

      document.body.removeChild(clone);

      const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth(); // 595.28 pt
      const pageHeight = pdf.internal.pageSize.getHeight(); // 841.89 pt

      // Fit strictly on 1 full A4 page spanning full width and height
      const scaleRatio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
      const drawWidth = canvas.width * scaleRatio;
      const drawHeight = canvas.height * scaleRatio;
      const xOffset = (pageWidth - drawWidth) / 2;
      const yOffset = (pageHeight - drawHeight) / 2;

      const imgData = canvas.toDataURL("image/png", 1.0);
      pdf.addImage(imgData, "PNG", xOffset, yOffset, drawWidth, drawHeight, undefined, "FAST");

      const fileName = `prescription-${patient?.name ? patient.name.replace(/\s+/g, "-").toLowerCase() : "zenve"}-${visitDate}.pdf`;
      pdf.save(fileName);
      toast.success("A4 Full-Size PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not generate PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const patientEmail = (patient?.ownerEmail || patient?.email || "").trim();

  const getEmailContent = () => {
    const medRows = medicines
      .filter((m) => m.medicineId || m.dosage)
      .map((m, idx) => {
        const med = allMeds.find((x) => String(x.id) === String(m.medicineId));
        let line = `${idx + 1}. ${med?.name || "Medicine"}`;
        if (m.dosage) line += ` - Dosage: ${m.dosage}`;
        if (m.frequency) line += ` | Frequency: ${m.frequency}`;
        if (m.duration) line += ` | Duration: ${m.duration}`;
        if (m.quantity) line += ` | Qty: ${m.quantity}`;
        if (m.instructions) line += `\n   Instructions: ${m.instructions}`;
        return line;
      });

    const clinicTitle = doctor?.clinicHospital || doctor?.clinicName || "Zenve Veterinary Clinic";
    const prescriptionCode = formatPrescriptionId(savedRx?.id || nextRxId || 1, visitDate);

    return [
      `${clinicTitle.toUpperCase()} - PRESCRIPTION`,
      `Prescription ID: ${prescriptionCode}`,
      `==================================================`,
      `Doctor: ${doctor?.fullName || "Veterinary Doctor"}`,
      doctor?.qualification ? `Qualification: ${doctor.qualification}` : null,
      (doctor?.clinicHospital || doctor?.clinicName) ? `Clinic / Hospital: ${doctor?.clinicHospital || doctor?.clinicName}` : null,
      (doctor?.city || doctor?.pincode) ? `Location: ${[doctor?.city, doctor?.pincode].filter(Boolean).join(" - ")}` : null,
      doctor?.phone ? `Doctor Contact: ${doctor.phone}` : null,
      `Date: ${visitDate}`,
      `Visit Type: ${visitType || "OPD Consultation"}`,
      `--------------------------------------------------`,
      `PATIENT DETAILS`,
      `Patient Name: ${patient?.name || "—"}`,
      patient?.petId ? `Pet ID: ${patient.petId}` : null,
      `Species & Breed: ${patient?.species || "—"}${patient?.breed ? ` (${patient.breed})` : ""}`,
      patient?.gender ? `Gender: ${patient.gender}` : null,
      patient?.weight != null ? `Weight: ${patient.weight} kg` : null,
      `Owner: ${patient?.ownerName || "—"}`,
      patientEmail ? `Registered Email: ${patientEmail}` : null,
      patient?.ownerPhone ? `Phone: ${patient.ownerPhone}` : null,
      `--------------------------------------------------`,
      complaint ? `Presenting Complaint:\n${complaint}\n` : null,
      diagnosis ? `Diagnosis:\n${diagnosis}\n` : null,
      `PRESCRIBED MEDICINES:`,
      medRows.length > 0 ? medRows.join("\n\n") : "No medicines prescribed.",
      `--------------------------------------------------`,
      instructions ? `Instructions & Advice:\n${instructions}\n` : null,
      petFood ? `Diet / Pet Food Recommendation:\n${petFood}\n` : null,
      vaccineName.trim() ? `Vaccination Administered: ${vaccineName.trim()}${vaccineDueDate ? ` (Next Due: ${vaccineDueDate})` : ""}\n` : null,
      showFeesOnRx ? `Consultation Fee: ₹${Number(consultationFee || 0).toFixed(2)}\nMedicine Charges: ₹${medicineTotal.toFixed(2)}\nTotal Amount: ₹${grandTotal.toFixed(2)}\n` : null,
      notes ? `Doctor's Notes:\n${notes}\n` : null,
      `==================================================`,
      `This is a computer-generated prescription from ${clinicTitle}.`,
    ].filter(Boolean).join("\n");
  };

  const send = async (type) => {
    try {
      const rx = await submit();
      if (!rx) return;
      const message = content();
      if (type === "whatsapp") {
        if (!patient?.ownerPhone) return toast.error("This patient has no owner phone number on file");
        const opened = openWhatsApp(patient.ownerPhone, message);
        if (!opened) return toast.error("This patient has no owner phone number on file");
        sendWhatsApp({ phoneNumber: patient.ownerPhone, message, type: "PRESCRIPTION", provider: "MANUAL" }).catch(() => { });
        toast.success("WhatsApp opened successfully");
        return;
      }
      let result;
      if (type === "sms") {
        if (!patient?.ownerPhone) return toast.error("This patient has no owner phone number on file");
        result = await sendSms({ phoneNumber: toE164(patient.ownerPhone), message, type: "PRESCRIPTION", provider: "MANUAL" });
      }
      if (type === "email") {
        if (!patientEmail) {
          return toast.error("This patient has no registered email address on file. Please add an email address in the Patient profile.");
        }
        const clinicTitle = doctor?.clinicHospital || doctor?.clinicName || "Zenve Veterinary Clinic";
        const subject = `Veterinary Prescription: ${patient?.name || "Patient"}${patient?.petId ? ` (${patient.petId})` : ""} - ${clinicTitle}`;
        const emailBody = getEmailContent();
        result = await sendEmail({
          recipient: patientEmail,
          subject,
          message: emailBody,
          type: "PRESCRIPTION",
          provider: "MANUAL",
        });
      }
      const status = (result?.status || "").toLowerCase();
      const label = type === "sms" ? "SMS" : "Prescription email";
      if (status === "sent") {
        toast.success(type === "email" ? `Prescription sent to registered email (${patientEmail})` : `${label} sent successfully`);
      } else if (status === "failed") {
        toast.error(result?.errorMessage || `Could not send ${type}`);
      } else {
        toast(result?.errorMessage || `${type} was logged but not sent yet — the ${type} provider isn't configured on the server.`, { icon: "⚠️" });
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || `Could not send ${type}`);
    }
  };

  return (
    <div className="rx-layout">
      <div className="panel stack-4">
        <div className="rx-grid-3">
          <Field label="Patient" className="col-span-2">
            <Select value={patientId} onChange={e => setPatientId(e.target.value)}>
              <option value="">Select patient</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.name} · {p.species} · {p.ownerName || ""}</option>
              ))}
            </Select>
          </Field>
          <Field label="Weight">
            <Input value={patient?.weight != null ? `${patient.weight} kg` : ""} readOnly />
          </Field>
        </div>

        {patient && (
          <div className="rx-patient-meta-banner">
            <span className="rx-meta-tag">Owner: <strong>{patient.ownerName || "—"}</strong></span>
            <span className="rx-meta-tag">
              Registered Email: {patientEmail ? <strong className="text-email-ok">📧 {patientEmail}</strong> : <span className="text-email-missing">⚠️ No email registered</span>}
            </span>
            {patient.ownerPhone && <span className="rx-meta-tag">Phone: <strong>{patient.ownerPhone}</strong></span>}
          </div>
        )}

        <div className="rx-mic-box">
          <button
            type="button"
            onClick={toggleVoiceCapture}
            className={`rx-mic-btn${listening ? " rx-mic-btn-active" : ""}`}
            title={listening ? "Click to stop listening" : "Click to dictate notes"}
          >
            {listening ? <FiMicOff size={16} /> : <FiMic size={16} />}
          </button>
          <div>
            <p className="rx-mic-title">Voice Dictation → Notes</p>
            <p className="rx-mic-desc">
              {listening
                ? "Listening... tap the mic again to stop. Speech is transcribed directly into Notes."
                : "Tap the mic and dictate — speech is transcribed directly into the Notes field below."}
            </p>
          </div>
        </div>

        <div className="rx-grid-2">
          <Field label="Visit Date">
            <Input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} />
          </Field>
          <Field label="Visit Type">
            <Select value={visitType} onChange={e => setVisitType(e.target.value)}>
              <option value="OPD Consultation">OPD Consultation (In-Clinic)</option>
              <option value="Video Consultation">Video Consultation</option>
              <option value="Home Visit">Home Visit</option>
              <option value="Emergency Consultation">Emergency Consultation</option>
              <option value="Vaccination Visit">Vaccination Visit</option>
              <option value="Follow-up Consultation">Follow-up Consultation</option>
              <option value="General Health Checkup">General Health Checkup</option>
            </Select>
          </Field>
        </div>
        <Field label="Presenting complaint"><Input value={complaint} onChange={e => setComplaint(e.target.value)} /></Field>
        <Field label="Diagnosis"><Input value={diagnosis} onChange={e => setDiagnosis(e.target.value)} /></Field>

        <div>
          <span className="eyebrow">Medicines (Inventory Connected)</span>
          <div className="stack-3" style={{ marginTop: 12 }}>
            {medicines.map(m => (
              <div key={m.id} className="rx-med-row">
                <Select value={m.medicineId} onChange={e => updateMed(m.id, "medicineId", e.target.value)}>
                  <option value="">Select medicine from inventory</option>
                  {allMeds.map(x => {
                    const stock = x.stockQuantity ?? 0;
                    const stockTag = stock <= 0 ? " [Out of Stock]" : stock <= (x.reorderLevel ?? 5) ? ` [Low: ${stock}]` : ` [Stock: ${stock}]`;
                    return (
                      <option key={x.id} value={x.id}>
                        {x.name} {x.strength || ""}{x.dosageForm ? ` (${x.dosageForm})` : ""}{stockTag}
                      </option>
                    );
                  })}
                </Select>
                <Input placeholder="Dose" value={m.dosage} onChange={e => updateMed(m.id, "dosage", e.target.value)} />
                <Input placeholder="Frequency" value={m.frequency} onChange={e => updateMed(m.id, "frequency", e.target.value)} />
                <Input placeholder="Duration" value={m.duration} onChange={e => updateMed(m.id, "duration", e.target.value)} />
                <Input type="number" min="1" placeholder="Qty" value={m.quantity} onChange={e => updateMed(m.id, "quantity", e.target.value)} />
                <button onClick={() => setMedicines(ms => ms.filter(x => x.id !== m.id))} className="rx-med-remove"><FiTrash2 size={16} /></button>
              </div>
            ))}
            <button onClick={() => setMedicines(ms => [...ms, emptyMed()])} className="rx-chip">
              <FiPlusCircle size={14} /> Add medicine
            </button>
          </div>
        </div>

        <div className="rx-grid-4">
          <Field label="Temp (°C)"><Input value={vitals.temp} onChange={e => setVitals({ ...vitals, temp: e.target.value })} placeholder="38.5" /></Field>
          <Field label="Pulse"><Input value={vitals.pulse} onChange={e => setVitals({ ...vitals, pulse: e.target.value })} placeholder="80 bpm" /></Field>
          <Field label="Resp"><Input value={vitals.resp} onChange={e => setVitals({ ...vitals, resp: e.target.value })} placeholder="24 /min" /></Field>
          <Field label="Follow-up days"><Input type="number" min="0" value={followUpDays} onChange={e => setFollowUpDays(e.target.value)} placeholder="7" /></Field>
        </div>

        <Field label="Instructions"><Input value={instructions} onChange={e => setInstructions(e.target.value)} /></Field>
        <Field label="Pet food / Diet recommendation"><Input placeholder="e.g. Prescription renal diet, twice daily" value={petFood} onChange={e => setPetFood(e.target.value)} /></Field>

        <div className="rx-grid-3">
          <Field label="Vaccination given"><Input placeholder="e.g. Rabies" value={vaccineName} onChange={e => setVaccineName(e.target.value)} /></Field>
          <Field label="Vaccination due date"><Input type="date" value={vaccineDueDate} onChange={e => setVaccineDueDate(e.target.value)} /></Field>
        </div>

        <div className="rx-grid-3">
          <Field label="Consultation fee (₹)"><Input type="number" min="0" value={consultationFee} onChange={e => setConsultationFee(e.target.value)} /></Field>
          <Field label="Follow-up fee (₹)"><Input type="number" min="0" value={followupFee} onChange={e => setFollowupFee(e.target.value)} /></Field>
          <Field label="Slot length (min)"><Input value={doctor?.slotLength ?? ""} readOnly /></Field>
        </div>

        <div className="rx-fee-summary">
          <div className="rx-fee-summary-row"><span>Medicine charges</span><span>₹{medicineTotal.toFixed(2)}</span></div>
          <div className="rx-fee-summary-row"><span>Doctor fee</span><span>₹{feeTotal.toFixed(2)}</span></div>
          <div className="rx-fee-summary-row rx-fee-summary-total"><span>Total</span><span>₹{grandTotal.toFixed(2)}</span></div>
          <button type="button" className="rx-chip" onClick={() => setShowFeesOnRx(v => !v)}>
            {showFeesOnRx ? "Hide fees on prescription" : "Show fees on prescription"}
          </button>
        </div>

        <Field
          label={
            <div className="rx-notes-label-bar">
              <span className="rx-notes-label-text">Notes</span>
              <button
                type="button"
                onClick={toggleVoiceCapture}
                className={`rx-voice-chip ${listening ? "listening" : ""}`}
                title={listening ? "Click to stop listening" : "Click to dictate notes"}
              >
                {listening ? <FiMicOff /> : <FiMic />}
                <span>{listening ? "Listening... (Click to stop)" : "Voice dictation"}</span>
              </button>
            </div>
          }
        >
          <Textarea
            rows={3}
            placeholder="Type notes or click 'Voice dictation' above to speak..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </Field>

        <div className="rx-footer">
          <div className="flex-row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Button size="sm" variant="secondary" icon={FiDownload} onClick={downloadPdf} disabled={generatingPdf}>
              {generatingPdf ? "Preparing..." : "PDF"}
            </Button>
            <Button size="sm" variant="secondary" icon={FaWhatsapp} onClick={() => send("whatsapp")}>WhatsApp</Button>
            <Button size="sm" variant="secondary" icon={FiMail} onClick={() => send("email")}>Email</Button>
            <Button size="sm" variant="secondary" icon={FiMessageSquare} onClick={() => send("sms")}>SMS</Button>
            <Button size="sm" icon={FiSend} onClick={submit} disabled={saving}>
              {saving ? "Saving..." : (savedRx?.id ? `Update #${savedRx.id}` : "Save Prescription")}
            </Button>
          </div>
        </div>
      </div>

      <div className="rx-preview-wrap">
        <div className="panel rx-preview" ref={previewRef}>
          <div className="rx-preview-header">
            <div className="rx-preview-brand">
              <div className="rx-preview-mark">
                <img src="/zenve.png" alt="Zenve logo" className="rx-preview-logo" />
              </div>
              <div>
                <p className="rx-preview-clinic">{doctor?.clinicHospital || doctor?.clinicName || "Zenve Veterinary Clinic"}</p>
                <p className="rx-preview-tagline">
                  {[
                    doctor?.fullName ? (doctor.fullName.toLowerCase().startsWith("dr") ? doctor.fullName : `Dr. ${doctor.fullName}`) : "Veterinary Doctor",
                    doctor?.qualification,
                    doctor?.speciality,
                    doctor?.registrationNumber ? `Reg No: ${doctor.registrationNumber}` : null,
                    [doctor?.city, doctor?.pincode].filter(Boolean).join(" - "),
                    doctor?.phoneNumber ? `Ph: ${doctor.phoneNumber}` : null,
                  ].filter(Boolean).join(" · ") || "Veterinary Doctor · Comprehensive Animal Care & Surgery"}
                </p>
              </div>
            </div>
            <div className="rx-preview-doctitle">
              <div className="rx-doc-rx-badge">
                <span className="rx-preview-doc-label">Prescription</span>
              </div>
              <p className="rx-preview-doc-id">
                {formatPrescriptionId(savedRx?.id || nextRxId || 1, visitDate)}
              </p>
              <p className="rx-preview-doc-date">Date: {visitDate}</p>
            </div>
          </div>

          <div className="rx-preview-grid">
            <div>
              <p className="rx-eyebrow">Patient Details</p>
              <p className="rx-preview-value">{patient?.name || "—"}</p>
              <p className="rx-preview-subval">{[patient?.species, patient?.breed].filter(Boolean).join(" · ") || "Pet Patient"}</p>
            </div>
            <div>
              <p className="rx-eyebrow">Pet Parent (Owner)</p>
              <p className="rx-preview-value">{patient?.ownerName || "—"}</p>
              <p className="rx-preview-subval">{patient?.ownerPhone || patient?.phone || patientEmail || "—"}</p>
            </div>
            <div>
              <p className="rx-eyebrow">Vitals & Weight</p>
              <p className="rx-preview-value">{patient?.weight != null ? `${patient.weight} kg` : "—"}</p>
              <p className="rx-preview-subval">{vitals?.temp ? `Temp: ${vitals.temp}°F` : "Vitals Normal"}</p>
            </div>
            <div>
              <p className="rx-eyebrow">Visit Details</p>
              <p className="rx-preview-value">{visitDate}</p>
              <p className="rx-preview-subval">{visitType || "OPD Consultation"}</p>
            </div>
          </div>

          <div className="rx-preview-body">
            <div className="rx-preview-2col">
              <div className="rx-preview-block">
                <p className="rx-eyebrow"><span className="rx-eyebrow-dot" />Major Issue</p>
                <div className="rx-preview-box">{complaint || "—"}</div>
              </div>
              <div className="rx-preview-block">
                <p className="rx-eyebrow"><span className="rx-eyebrow-dot" />Clinical Diagnosis</p>
                <div className="rx-preview-box">{diagnosis || "—"}</div>
              </div>
            </div>

            <div className="rx-preview-block">
              <div className="rx-block-title-row">
                <p className="rx-eyebrow"><span className="rx-eyebrow-dot" />Medications Prescribed</p>
              </div>
              {medicines.filter(m => m.medicineId || m.dosage).length === 0 ? (
                <p className="rx-preview-empty">No medicines added yet</p>
              ) : (
                <table className="rx-med-table">
                  <thead>
                    <tr>
                      <th style={{ width: "38px" }}>#</th>
                      <th>Medicine Name & Dosage</th>
                      <th>Duration</th>
                      <th>Frequency</th>
                      <th>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medicines.filter(m => m.medicineId || m.dosage).map((m, i) => {
                      const med = allMeds.find(x => String(x.id) === String(m.medicineId));
                      return (
                        <tr key={m.id}>
                          <td>
                            <span className="rx-med-index">{i + 1}</span>
                          </td>
                          <td>
                            <div className="rx-med-name-wrap">
                              <span className="rx-med-name">{med?.name || "—"}</span>
                              {m.dosage && <span className="rx-med-dosage">{m.dosage}</span>}
                            </div>
                            {m.instructions && (
                              <div className="rx-med-sub-instruction">↳ {m.instructions}</div>
                            )}
                          </td>
                          <td>{m.duration || "—"}</td>
                          <td>{m.frequency || "—"}</td>
                          <td>{m.quantity || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="rx-preview-2col">
              <div className="rx-preview-block">
                <p className="rx-eyebrow"><span className="rx-eyebrow-dot" />Instructions & Advice</p>
                <div className="rx-preview-box">{instructions || "—"}</div>
              </div>
              <div className="rx-preview-block">
                <p className="rx-eyebrow"><span className="rx-eyebrow-dot" />Pet Food / Diet</p>
                <div className="rx-preview-box">{petFood || "—"}</div>
              </div>
            </div>

            {vaccineName.trim() && (
              <div className="rx-preview-block">
                <p className="rx-eyebrow"><span className="rx-eyebrow-dot" />Vaccination Given</p>
                <span className="rx-vaccine-pill">
                  <FaPaw /> {vaccineName}{vaccineDueDate ? ` · Next due ${vaccineDueDate}` : ""}
                </span>
              </div>
            )}

            {showFeesOnRx && (
              <div className="rx-preview-block">
                <p className="rx-eyebrow"><span className="rx-eyebrow-dot" />Fees Breakdown</p>
                <div className="rx-fee-card">
                  <div className="rx-fee-card-row"><span>Medicine charges</span><span>₹{medicineTotal.toFixed(2)}</span></div>
                  <div className="rx-fee-card-row"><span>Doctor fee</span><span>₹{feeTotal.toFixed(2)}</span></div>
                  <div className="rx-fee-card-row rx-fee-card-total"><span>Total</span><span>₹{grandTotal.toFixed(2)}</span></div>
                </div>
              </div>
            )}

            <div className="rx-preview-block">
              <p className="rx-eyebrow"><span className="rx-eyebrow-dot" />Clinical Notes</p>
              <div className="rx-preview-box">{notes || "—"}</div>
            </div>

            <div className="rx-preview-footer">
              <div className="rx-preview-footer-left">
                <p className="rx-preview-helpline">
                  Emergency Contact: <strong>{doctor?.phoneNumber || "+91 98765 43210"}</strong>
                </p>
                <p className="rx-preview-footer-note">
                  This is Zenve-generated prescription is a valid legal medical document.
                </p>
              </div>
              <div className="rx-preview-sign-line">
                {doctor?.digitalSignatureImage ? (
                  <img
                    src={doctor.digitalSignatureImage}
                    alt="Doctor Signature"
                    className="rx-digital-signature-img"
                  />
                ) : (
                  <div className="rx-signature-placeholder-space" />
                )}
                <div className="rx-sign-line-bar" />
                <span className="rx-sign-name">{doctor?.fullName ? (doctor.fullName.toLowerCase().startsWith("dr") ? doctor.fullName : `Dr. ${doctor.fullName}`) : "Doctor's Signature"}</span>
                <span className="rx-sign-title">Authorized Signatory · Registered Vet</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
