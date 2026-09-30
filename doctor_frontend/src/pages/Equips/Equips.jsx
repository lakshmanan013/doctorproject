import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FiCheckCircle,
  FiPhoneCall,
  FiInfo,
  FiShield,
  FiBox,
  FiTag,
  FiFileText,
  FiCpu,
  FiActivity,
  FiClock
} from "react-icons/fi";
import {
  FaFlask,
  FaHeartbeat,
  FaLaptopMedical,
  FaTooth,
  FaSyringe,
  FaWind,
  FaWhatsapp
} from "react-icons/fa";
import toast from "react-hot-toast";
import { StatCard } from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import SearchBar from "../../components/ui/SearchBar";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Input, { Field, Textarea } from "../../components/ui/Input";
import { APP } from "../../constants/app";
import { useAuth } from "../../hooks/useAuth";
import { getDoctorProfile } from "../../services/doctorProfileService";
import { openWhatsApp } from "../../utils/whatsapp";
import "./Equips.css";

const VENDOR_EQUIPMENT_CATALOG = [
  {
    id: "EQP-001",
    name: "Mindray DP-50 Vet Ultrasound Scanner",
    brand: "Mindray Medical",
    category: "Diagnostic",
    price: 285000,
    status: "In stock",
    warranty: "2 Years Warranty",
    model: "DP-50-VET-X2",
    description: "Digital B/W ultrasound with 15-inch LCD, multi-frequency micro-convex & linear probes, and DICOM 3.0 export.",
    leadTime: "2-3 business days",
    suitableFor: "Canine, Feline, Equine abdominal & cardiac ultrasound",
    specs: [
      "15-inch high-definition tiltable LCD monitor",
      "Broadband multi-frequency micro-convex & linear transducers",
      "iBeam spatial compounding & iClear speckle suppression",
      "Built-in rechargeable Li-ion battery (2.5 hours runtime)"
    ]
  }
];

const TABS = ["All", "Diagnostic", "Monitoring", "Surgical", "Sterilization", "Laboratory", "Dental", "Anesthesia"];

const statusVariant = {
  "In stock": "success",
  "Available on order": "warning"
};

export default function Equips() {
  const { doctor: authDoctor } = useAuth();
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState("All");
  const [query, setQuery] = useState("");

  // Modals
  const [selectedModalEquip, setSelectedModalEquip] = useState(null);
  const [inquiryModalOpen, setInquiryModalOpen] = useState(false);
  const [inquiryEquip, setInquiryEquip] = useState(null);
  const [inquiryForm, setInquiryForm] = useState({
    name: "",
    clinic: "",
    phone: "",
    city: "",
    message: ""
  });

  // Fetch doctor profile to auto-populate inquiry details
  useEffect(() => {
    let isMounted = true;
    getDoctorProfile()
      .then((data) => {
        if (isMounted && data) {
          setDoctorProfile(data);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch doctor profile for equips:", err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Listen for searchParam id to auto-popup equipment specifications
  useEffect(() => {
    const paramId = searchParams.get("id");
    if (paramId) {
      const found = VENDOR_EQUIPMENT_CATALOG.find((e) => e.id === paramId);
      if (found) {
        setSelectedModalEquip(found);
      }
    }
  }, [searchParams]);

  // Filtered
  const filtered = useMemo(() => {
    return VENDOR_EQUIPMENT_CATALOG.filter((item) => {
      const q = query.toLowerCase().trim();
      const matchQuery =
        !q ||
        (item.name || "").toLowerCase().includes(q) ||
        (item.brand || "").toLowerCase().includes(q) ||
        (item.model || "").toLowerCase().includes(q) ||
        (item.category || "").toLowerCase().includes(q);

      const matchCategory = tab === "All" || item.category === tab;
      return matchQuery && matchCategory;
    });
  }, [query, tab]);

  // Statistics
  const totalCount = VENDOR_EQUIPMENT_CATALOG.length;
  const inStockCount = VENDOR_EQUIPMENT_CATALOG.filter((e) => e.status === "In stock").length;
  const diagnosticCount = VENDOR_EQUIPMENT_CATALOG.filter((e) => e.category === "Diagnostic" || e.category === "Monitoring").length;
  const totalValue = VENDOR_EQUIPMENT_CATALOG.reduce((sum, e) => sum + Number(e.price || 0), 0);

  const handleOpenDetailModal = (item) => {
    setSelectedModalEquip(item);
  };

  const handleOpenInquiry = (item, e) => {
    if (e) e.stopPropagation();
    setInquiryEquip(item);

    const docName = doctorProfile?.fullName || authDoctor?.fullName || "";
    const docClinic = doctorProfile?.clinicHospital || "";
    const docPhone = doctorProfile?.phone || authDoctor?.phone || "";
    const docCity = doctorProfile?.city || "";

    setInquiryForm({
      name: docName,
      clinic: docClinic,
      phone: docPhone,
      city: docCity,
      message: `I would like to purchase / get a formal quote and demo details for ${item.name} (Model: ${item.model || "Standard"}).`
    });
    setInquiryModalOpen(true);
  };

  const handleInquirySubmit = (e) => {
    e.preventDefault();
    if (!inquiryForm.name.trim() || !inquiryForm.phone.trim()) {
      toast.error("Please provide doctor name and phone number");
      return;
    }

    const equip = inquiryEquip;
    const priceFormatted = Number(equip?.price || 0).toLocaleString("en-IN");
    const docDisplay = inquiryForm.clinic
      ? `${inquiryForm.name} (${inquiryForm.clinic})`
      : inquiryForm.name;

    const messageLines = [
      `🏥 *EQUIPMENT PURCHASE INQUIRY*`,
      ``,
      `Hello Zenve Team, I am interested in purchasing the following equipment:`,
      ``,
      `📦 *Equipment:* ${equip?.name || ""}`,
      `🏷️ *Brand & Model:* ${equip?.brand || "—"} (${equip?.model || "Standard"})`,
      `💰 *Estimated Price:* ₹${priceFormatted}`,
      `🛡️ *Warranty:* ${equip?.warranty || "Standard"}`,
      `⏱️ *Lead Time:* ${equip?.leadTime || "In stock"}`,
      ``,
      `👨‍⚕️ *Doctor / Clinic:* ${docDisplay}`,
      `📱 *Doctor Phone:* ${inquiryForm.phone}`,
      inquiryForm.city ? `📍 *Location:* ${inquiryForm.city}` : null,
      ``,
      `📝 *Purchase Request:*`,
      `${inquiryForm.message || "Please share quotation, product catalog and demonstration availability."}`,
      ``,
      `— Sent via Zenve Doctor Portal`
    ].filter(Boolean);

    const waMsg = messageLines.join("\n");
    const companyPhone = APP.COMPANY_PHONE;

    const success = openWhatsApp(companyPhone, waMsg);

    if (success) {
      toast.success(`Purchase inquiry opened in WhatsApp to company!`);
    } else {
      toast.error("Unable to open WhatsApp. Please check company contact.");
    }

    setInquiryModalOpen(false);
  };

  return (
    <div className="stack-6">
      {/* STAT CARDS */}
      <div className="stat-grid">
        <StatCard
          icon={FaLaptopMedical}
          label="Equipment in catalog"
          value={totalCount}
          iconBg="primary"
        />
        <StatCard
          icon={FiCheckCircle}
          label="In stock"
          value={inStockCount}
          iconBg="success"
        />
        <StatCard
          icon={FaHeartbeat}
          label="Diagnostic & monitors"
          value={diagnosticCount}
          iconBg="warning"
        />
        <StatCard
          icon={FaFlask}
          label="Total catalog value"
          value={`₹${totalValue.toLocaleString("en-IN")}`}
          iconBg="success"
        />
      </div>

      {/* TABLE TOOLBAR */}
      <div className="table-toolbar">
        <div className="table-search">
          <SearchBar
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search equipment, brand, model..."
          />
        </div>

        <div className="filter-row">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`filter-chip ${tab === t ? "active" : ""}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* FULL-WIDTH EQUIPMENT TABLE */}
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Equipment</th>
              <th>Category</th>
              <th>Estimated price</th>
              <th>Warranty</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr
                key={m.id}
                onClick={() => handleOpenDetailModal(m)}
                style={{ cursor: "pointer" }}
                title="Click to view equipment details"
              >
                <td>
                  <p className="cell-title">{m.name}</p>
                  <p className="cell-sub">
                    {m.brand || "—"} · {m.model || ""}
                  </p>
                </td>
                <td className="text-muted">{m.category || "—"}</td>
                <td>
                  <span className="cell-title" style={{ color: "var(--primary)" }}>
                    ₹{Number(m.price || 0).toLocaleString("en-IN")}
                  </span>
                </td>
                <td className="text-muted" style={{ fontSize: "12.5px" }}>
                  {m.warranty || "Standard"}
                </td>
                <td>
                  <Badge variant={statusVariant[m.status] || "default"}>
                    {m.status}
                  </Badge>
                </td>
                <td style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="link-action inv-batch-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDetailModal(m);
                      }}
                    >
                      <FiInfo size={13} /> View Specs
                    </button>
                    <button
                      type="button"
                      className="link-action inv-batch-btn"
                      onClick={(e) => handleOpenInquiry(m, e)}
                    >
                      <FiPhoneCall size={13} /> Inquire
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!filtered.length && (
              <tr>
                <td colSpan={6} className="table-empty">
                  No equipment found matching your filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* EQUIPMENT DETAILS MODAL POPUP */}
      <Modal
        open={!!selectedModalEquip}
        onClose={() => setSelectedModalEquip(null)}
        title={selectedModalEquip?.name || "Equipment Details"}
        subtitle={`${selectedModalEquip?.brand || "Clinic"} · Model: ${selectedModalEquip?.model || "Standard"}`}
        width="modal-lg"
      >
        {selectedModalEquip && (
          <div className="equip-modal-content">
            {/* Top Hero & Price Section */}
            <div className="equip-modal-hero">
              <div>
                <div className="equip-modal-badges">
                  <span className="equip-badge-category">
                    {selectedModalEquip.category}
                  </span>
                  <Badge variant={statusVariant[selectedModalEquip.status] || "default"}>
                    {selectedModalEquip.status}
                  </Badge>
                </div>
                <p className="equip-modal-desc">
                  {selectedModalEquip.description || "High performance veterinary equipment designed for clinical reliability."}
                </p>
              </div>

              <div className="equip-price-card">
                <div className="equip-price-label">Estimated Price</div>
                <div className="equip-price-val">
                  ₹{Number(selectedModalEquip.price || 0).toLocaleString("en-IN")}
                </div>
                <span className="text-faint" style={{ fontSize: "11px" }}>Excl. local taxes</span>
              </div>
            </div>

            {/* 4 Metadata Cards Grid */}
            <div className="equip-meta-grid">
              <div className="equip-meta-card">
                <div className="equip-meta-card-header">
                  <FiTag size={13} /> Manufacturer
                </div>
                <div className="equip-meta-card-value">
                  {selectedModalEquip.brand || "—"}
                </div>
              </div>

              <div className="equip-meta-card">
                <div className="equip-meta-card-header">
                  <FiFileText size={13} /> Model Number
                </div>
                <div className="equip-meta-card-value" style={{ fontFamily: "monospace", fontSize: "12.5px" }}>
                  {selectedModalEquip.model || "—"}
                </div>
              </div>

              <div className="equip-meta-card">
                <div className="equip-meta-card-header">
                  <FiShield size={13} /> Warranty
                </div>
                <div className="equip-meta-card-value">
                  {selectedModalEquip.warranty || "Standard"}
                </div>
              </div>

              <div className="equip-meta-card">
                <div className="equip-meta-card-header">
                  <FiClock size={13} /> Lead Time
                </div>
                <div className="equip-meta-card-value">
                  {selectedModalEquip.leadTime || "In stock"}
                </div>
              </div>
            </div>

            {/* Technical Specifications */}
            {selectedModalEquip.specs && selectedModalEquip.specs.length > 0 && (
              <div>
                <div className="equip-section-title">
                  <FiCpu size={14} style={{ color: "var(--primary)" }} /> Technical Specifications & Key Features
                </div>
                <div className="equip-specs-list">
                  {selectedModalEquip.specs.map((spec, i) => (
                    <div key={i} className="equip-spec-item">
                      <FiCheckCircle size={15} className="equip-spec-icon" />
                      <span>{spec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended Clinical Applications */}
            {selectedModalEquip.suitableFor && (
              <div className="equip-clinical-callout">
                <div className="equip-clinical-icon">
                  <FiActivity size={18} />
                </div>
                <div>
                  <div className="equip-clinical-title">
                    Recommended Clinical Applications
                  </div>
                  <p className="equip-clinical-text">
                    {selectedModalEquip.suitableFor}
                  </p>
                </div>
              </div>
            )}

            {/* Action Footer */}
            <div className="equip-modal-footer">
              <Button variant="secondary" onClick={() => setSelectedModalEquip(null)}>
                Close
              </Button>
              <Button
                icon={FiPhoneCall}
                onClick={() => {
                  const target = selectedModalEquip;
                  setSelectedModalEquip(null);
                  handleOpenInquiry(target);
                }}
              >
                Inquire / Request Quote
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* INQUIRY MODAL */}
      <Modal
        open={inquiryModalOpen}
        onClose={() => setInquiryModalOpen(false)}
        title={`Purchase Inquiry: ${inquiryEquip?.name || "Equipment"}`}
        subtitle="Send your machine purchase request and quote inquiry directly to our company sales desk."
      >
        <form onSubmit={handleInquirySubmit} className="stack-4">
          <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "10px 12px", borderRadius: "8px", fontSize: "12.5px", color: "#065f46", display: "flex", alignItems: "center", gap: "8px" }}>
            <FaWhatsapp size={16} style={{ color: "#10b981", flexShrink: 0 }} />
            <span>This purchase inquiry will be sent directly to the Zenve sales & equipment procurement desk on WhatsApp.</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <Field label="Doctor Name *">
              <Input
                placeholder="e.g. Dr. Sharma"
                value={inquiryForm.name}
                onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                required
              />
            </Field>

            <Field label="Clinic / Hospital">
              <Input
                placeholder="e.g. Zenve Pet Clinic"
                value={inquiryForm.clinic}
                onChange={(e) => setInquiryForm({ ...inquiryForm, clinic: e.target.value })}
              />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <Field label="Doctor Contact Phone *">
              <Input
                placeholder="10-digit mobile number"
                value={inquiryForm.phone}
                onChange={(e) => setInquiryForm({ ...inquiryForm, phone: e.target.value })}
                required
              />
            </Field>

            <Field label="City / Location">
              <Input
                placeholder="e.g. Bangalore, Chennai"
                value={inquiryForm.city}
                onChange={(e) => setInquiryForm({ ...inquiryForm, city: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Purchase Requirements / Notes">
            <Textarea
              rows={3}
              placeholder="e.g. Interested in live demo, discount on clinic purchase and delivery schedule..."
              value={inquiryForm.message}
              onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })}
            />
          </Field>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <Button type="button" variant="secondary" onClick={() => setInquiryModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" icon={FaWhatsapp} style={{ backgroundColor: "#10b981", borderColor: "#10b981", color: "#fff" }}>
              Send Purchase Request via WhatsApp
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
