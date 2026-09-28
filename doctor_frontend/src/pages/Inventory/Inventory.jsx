import { useEffect, useMemo, useState } from "react";
import { FiPlus, FiAlertCircle, FiMinusCircle } from "react-icons/fi";
import { FaFlask, FaBoxOpen, FaCalendarTimes } from "react-icons/fa";
import toast from "react-hot-toast";
import { StatCard } from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import SearchBar from "../../components/ui/SearchBar";
import BatchModal from "../../components/modals/BatchModal";
import ReduceStockModal from "../../components/modals/ReduceStockModal";
import { getMedicines } from "../../services/medicineService";
import { getBatches, getRecentStockMovements } from "../../services/inventoryService";
import "./Inventory.css";

const TABS = ["All", "Available", "Expiring", "Prescription only"];

const statusOf = (m, batch) => {
  if (batch?.expiryDate && new Date(batch.expiryDate) <= new Date(Date.now() + 60 * 86400000)) return "Expiring soon";
  return "Available";
};

const statusVariant = {
  "Available": "success",
  "Expiring soon": "warning"
};

export default function Inventory() {
  const [medicines, setMedicines] = useState([]);
  const [batches, setBatches] = useState([]);
  const [movements, setMovements] = useState([]);
  const [tab, setTab] = useState("All");
  const [query, setQuery] = useState("");
  const [detailMedicine, setDetailMedicine] = useState(null);
  const [batchTarget, setBatchTarget] = useState(null);
  const [reduceTarget, setReduceTarget] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const [m, b, s] = await Promise.all([
        getMedicines(),
        getBatches(),
        getRecentStockMovements().catch(() => [])
      ]);
      setMedicines(Array.isArray(m) ? m : []);
      setBatches(Array.isArray(b) ? b : []);
      setMovements(Array.isArray(s) ? s : []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Could not load inventory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const validMeds = useMemo(() => {
    return medicines.filter((m) => m.name && m.name.trim().toLowerCase() !== "dolo");
  }, [medicines]);

  const enriched = useMemo(() => {
    return validMeds.map((m) => {
      const bs = batches
        .filter((b) => b.medicineId === m.id)
        .sort((a, b) => String(a.expiryDate || "").localeCompare(String(b.expiryDate || "")));
      const nearest = bs[0];
      const batchStock = bs.reduce((sum, b) => sum + (Number(b.remainingQuantity != null ? b.remainingQuantity : b.quantity) || 0), 0);
      const availableQty = bs.length > 0 ? batchStock : (Number(m.stockQuantity) || 0);
      return { ...m, nearest, batchStock, availableQty, status: statusOf(m, nearest) };
    });
  }, [validMeds, batches]);

  const filtered = enriched.filter((m) => {
    const q = query.toLowerCase();
    const qok = `${m.name} ${m.manufacturer} ${m.category}`.toLowerCase().includes(q);
    const tok =
      tab === "All" ||
      (tab === "Available" && m.status === "Available" && m.availableQty > 0) ||
      (tab === "Expiring" && m.status === "Expiring soon") ||
      (tab === "Prescription only" && (m.dosageForm || "").toLowerCase().includes("prescription"));
    return qok && tok;
  });

  const categoriesCount = useMemo(() => new Set(validMeds.map((m) => m.category).filter(Boolean)).size, [validMeds]);
  const expiring = enriched.filter((m) => m.status === "Expiring soon").length;

  if (loading) {
    return (
      <div className="table-card">
        <div className="table-empty">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="stack-6">
      {/* STAT CARDS */}
      <div className="stat-grid">
        <StatCard
          icon={FaFlask}
          label="Catalog Medicines"
          value={validMeds.length}
          iconBg="primary"
        />
        <StatCard
          icon={FiAlertCircle}
          label="Categories"
          value={categoriesCount}
          iconBg="primary"
        />
        <StatCard
          icon={FaCalendarTimes}
          label="Expiring ≤ 60 days"
          value={expiring}
          iconBg="warning"
        />
        <StatCard
          icon={FaBoxOpen}
          label="Active Batches"
          value={batches.length}
          iconBg="success"
        />
      </div>

      {/* TABLE TOOLBAR */}
      <div className="table-toolbar">
        <div className="table-search">
          <SearchBar
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search medicine, manufacturer, category..."
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

      {/* FULL WIDTH MEDICINE TABLE */}
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Category</th>
              <th>Available Stock</th>
              <th>Unit Price (MRP)</th>
              <th>Nearest expiry</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr
                key={m.id}
                onClick={() => setDetailMedicine(m)}
                style={{ cursor: "pointer" }}
              >
                <td>
                  <p className="cell-title">{m.name}</p>
                  <p className="cell-sub">
                    {m.manufacturer || "—"}{m.strength ? ` · ${m.strength}` : ""}{m.dosageForm ? ` · ${m.dosageForm}` : ""}
                  </p>
                </td>
                <td className="text-muted">{m.category || "—"}</td>
                <td>
                  <span
                    className="cell-title"
                    style={{
                      fontWeight: 700,
                      color: m.availableQty === 0 ? "var(--danger, #ef4444)" : m.availableQty <= (m.reorderLevel || 5) ? "var(--warning, #f59e0b)" : "var(--text-main, #1e293b)"
                    }}
                  >
                    {m.availableQty}
                  </span>{" "}
                  <span className="cell-sub" style={{ marginTop: 0 }}>
                    {m.unit || "units"}
                  </span>
                </td>
                <td>
                  <span className="cell-title">₹{Number(m.price || 0).toFixed(2)}</span>{" "}
                  <span className="cell-sub" style={{ marginTop: 0 }}>
                    per {m.unit || "unit"}
                  </span>
                </td>
                <td className={m.status !== "Available" ? "inv-expiry-warn" : "text-muted"}>
                  {m.nearest?.expiryDate || "—"}
                </td>
                <td>
                  <Badge variant={m.availableQty === 0 ? "neutral" : statusVariant[m.status] || "success"}>
                    {m.availableQty === 0 ? "Out of Stock" : m.status}
                  </Badge>
                </td>
                <td style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="link-action inv-batch-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBatchTarget(m);
                      }}
                    >
                      <FiPlus size={14} /> Batch
                    </button>
                    <button
                      type="button"
                      className="link-action inv-batch-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReduceTarget(m);
                      }}
                    >
                      <FiMinusCircle size={14} /> Dispense
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!filtered.length && (
              <tr>
                <td colSpan={6} className="table-empty">
                  No medicines found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MEDICINE DETAIL POPUP MODAL */}
      <Modal
        open={!!detailMedicine}
        onClose={() => setDetailMedicine(null)}
        title={detailMedicine?.name || "Medicine details"}
        subtitle={`${detailMedicine?.manufacturer || "General"} · ${detailMedicine?.dosageForm || "Formulation"}`}
      >
        {detailMedicine && (
          <div>
            <div className="stack-2">
              <div className="invoice-line">
                <span className="text-muted">Available stock</span>
                <span style={{ fontWeight: 700, color: (detailMedicine.availableQty || 0) === 0 ? "var(--danger, #ef4444)" : "var(--primary)" }}>
                  {detailMedicine.availableQty ?? detailMedicine.stockQuantity ?? 0} {detailMedicine.unit || "units"}
                </span>
              </div>
              <div className="invoice-line">
                <span className="text-muted">Category</span>
                <span style={{ fontWeight: 500 }}>{detailMedicine.category || "—"}</span>
              </div>
              <div className="invoice-line">
                <span className="text-muted">Manufacturer</span>
                <span style={{ fontWeight: 500 }}>{detailMedicine.manufacturer || "—"}</span>
              </div>
              <div className="invoice-line">
                <span className="text-muted">Dosage form</span>
                <span style={{ fontWeight: 500 }}>{detailMedicine.dosageForm || "—"}</span>
              </div>
              <div className="invoice-line">
                <span className="text-muted">Strength</span>
                <span style={{ fontWeight: 500 }}>{detailMedicine.strength || "—"}</span>
              </div>
              <div className="invoice-line">
                <span className="text-muted">Unit price (MRP)</span>
                <span style={{ fontWeight: 700, color: "var(--primary)" }}>
                  ₹{Number(detailMedicine.price || 0).toFixed(2)} / {detailMedicine.unit || "unit"}
                </span>
              </div>
              <div className="invoice-line">
                <span className="text-muted">Nearest expiry</span>
                <span>{detailMedicine.nearest?.expiryDate || "—"}</span>
              </div>
              <div className="invoice-line">
                <span className="text-muted">Status</span>
                <Badge variant={(detailMedicine.availableQty || 0) === 0 ? "neutral" : statusVariant[detailMedicine.status] || "success"}>
                  {(detailMedicine.availableQty || 0) === 0 ? "Out of Stock" : (detailMedicine.status || "Available")}
                </Badge>
              </div>
            </div>

            {detailMedicine.description && (
              <div style={{ marginTop: 16 }}>
                <p className="eyebrow">Description</p>
                <p className="cell-sub" style={{ marginTop: 4, lineHeight: 1.5 }}>
                  {detailMedicine.description}
                </p>
              </div>
            )}

            {/* BATCHES LIST */}
            <div style={{ marginTop: 20 }}>
              <p className="eyebrow">
                Registered Batches ({batches.filter((b) => b.medicineId === detailMedicine.id).length})
              </p>
              {batches.filter((b) => b.medicineId === detailMedicine.id).length > 0 ? (
                <div className="stack-2" style={{ marginTop: 8 }}>
                  {batches
                    .filter((b) => b.medicineId === detailMedicine.id)
                    .map((b) => (
                      <div
                        key={b.id}
                        className="invoice-line"
                        style={{
                          padding: "10px 14px",
                          background: "var(--bg-muted, #f8fafc)",
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div>
                          <p style={{ fontWeight: 600, margin: 0 }}>Batch #{b.batchNumber}</p>
                          <p className="cell-sub" style={{ margin: "2px 0 0 0", fontSize: 12 }}>
                            Available: <strong>{b.remainingQuantity != null ? b.remainingQuantity : b.quantity}</strong> / {b.quantity} {detailMedicine.unit || "units"} · Exp: {b.expiryDate || "—"}
                          </p>
                        </div>
                        <Badge variant={(b.remainingQuantity ?? b.quantity) > 0 ? "success" : "neutral"}>
                          {(b.remainingQuantity ?? b.quantity) > 0 ? "In Stock" : "Depleted"}
                        </Badge>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="cell-sub" style={{ marginTop: 6 }}>
                  Ready for clinical prescriptions and dispensing.
                </p>
              )}
            </div>

            {/* MODAL ACTIONS */}
            <div className="modal-actions" style={{ marginTop: 24 }}>
              <Button variant="secondary" onClick={() => setDetailMedicine(null)}>
                Close
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const target = detailMedicine;
                  setDetailMedicine(null);
                  setBatchTarget(target);
                }}
              >
                <FiPlus size={14} /> Add Batch
              </Button>
              <Button
                onClick={() => {
                  const target = detailMedicine;
                  setDetailMedicine(null);
                  setReduceTarget(target);
                }}
              >
                <FiMinusCircle size={14} /> Dispense
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <BatchModal
        open={!!batchTarget}
        medicine={batchTarget}
        onClose={() => setBatchTarget(null)}
        onSaved={load}
      />
      <ReduceStockModal
        open={!!reduceTarget}
        medicine={reduceTarget}
        batches={batches.filter((b) => b.medicineId === reduceTarget?.id)}
        onClose={() => setReduceTarget(null)}
        onSaved={load}
      />
    </div>
  );
}
