import { useEffect, useMemo, useState } from "react";
import { FaWallet, FaClock, FaExclamationCircle, FaReceipt } from "react-icons/fa";
import toast from "react-hot-toast";
import { StatCard } from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import InvoiceModal from "../../components/modals/InvoiceModal";
import { getInvoices } from "../../services/billingService";
import { getPatients } from "../../services/patientService";

const statusVariant = {
  PAID: "success",
  Paid: "success",
  PARTIALLY_PAID: "warning",
  Partially_Paid: "warning",
  UNPAID: "warning",
  Unpaid: "warning",
  PENDING: "warning",
  Pending: "warning",
  OVERDUE: "danger",
  Overdue: "danger",
  CANCELLED: "danger",
  Cancelled: "danger",
};

export default function Billing() {
  const [invoices, setInvoices] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [patientsById, setPatientsById] = useState({});

  const todayIso = new Date().toISOString().split("T")[0];

  const load = async () => {
    try {
      setLoading(true);
      const [inv, pts] = await Promise.all([getInvoices(), getPatients().catch(() => [])]);
      const byId = {};
      (Array.isArray(pts) ? pts : []).forEach((p) => {
        byId[String(p.id)] = p;
      });
      setPatientsById(byId);
      setInvoices(Array.isArray(inv) ? inv : []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Could not load invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const handleRefresh = () => load();
    window.addEventListener("invoicesUpdated", handleRefresh);
    return () => window.removeEventListener("invoicesUpdated", handleRefresh);
  }, []);

  const withNames = (i) => {
    const p = patientsById[String(i.patientId)];
    return {
      patientName: p?.name || `Patient #${i.patientId || "—"}`,
      ownerName: p?.ownerName || `Owner #${i.ownerId || "—"}`,
      ownerPhone: p?.ownerPhone || "",
      ownerEmail: p?.ownerEmail || "",
    };
  };

  const getInvoiceDisplayStatus = (i) => {
    if (String(i.status).toUpperCase() === "CANCELLED") return "CANCELLED";
    const due = Number(i.dueAmount || 0);
    const paid = Number(i.paidAmount || 0);
    if (due <= 0 || String(i.paymentStatus).toUpperCase() === "PAID") return "PAID";
    if (i.dueDate && i.dueDate < todayIso && due > 0) return "OVERDUE";
    if (paid > 0 && due > 0) return "PARTIALLY_PAID";
    return i.paymentStatus || "UNPAID";
  };

  const stats = useMemo(() => {
    const totalBilled = invoices.reduce((s, i) => s + Number(i.totalAmount || 0), 0);
    const collected = invoices.reduce((s, i) => s + Number(i.paidAmount || 0), 0);
    const pending = invoices.reduce((s, i) => s + Math.max(Number(i.dueAmount || 0), 0), 0);
    const overdue = invoices
      .filter((i) => {
        const due = Number(i.dueAmount || 0);
        if (due <= 0) return false;
        return String(i.status).toUpperCase() === "OVERDUE" || (i.dueDate && i.dueDate < todayIso);
      })
      .reduce((s, i) => s + Number(i.dueAmount || 0), 0);
    const avg = invoices.length ? Math.round(totalBilled / invoices.length) : 0;
    return { totalBilled, collected, pending, overdue, avg };
  }, [invoices, todayIso]);

  const exportCsv = () => {
    const rows = [
      ["Invoice", "Date", "Due Date", "Patient", "Owner", "Total", "Paid", "Due", "Status"],
      ...invoices.map((i) => {
        const n = withNames(i);
        const displayStatus = getInvoiceDisplayStatus(i);
        return [
          i.invoiceNumber || `INV-${i.id}`,
          i.invoiceDate || "",
          i.dueDate || "",
          n.patientName,
          n.ownerName,
          i.totalAmount,
          i.paidAmount,
          i.dueAmount,
          displayStatus,
        ];
      }),
    ];
    const blob = new Blob(
      [rows.map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n")],
      { type: "text/csv" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "zenve-invoices.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading)
    return (
      <div className="table-card">
        <div className="table-empty">Loading invoices...</div>
      </div>
    );

  return (
    <div className="stack-6">
      <div className="stat-grid">
        <StatCard
          icon={FaReceipt}
          label="Total value"
          value={`₹${stats.totalBilled.toLocaleString("en-IN")}`}
          iconBg="info"
        />
        <StatCard
          icon={FaWallet}
          label="Collected"
          value={`₹${stats.collected.toLocaleString("en-IN")}`}
          iconBg="success"
        />
        <StatCard
          icon={FaClock}
          label="Pending"
          value={`₹${stats.pending.toLocaleString("en-IN")}`}
          iconBg="warning"
        />
        <StatCard
          icon={FaExclamationCircle}
          label="Overdue"
          value={`₹${stats.overdue.toLocaleString("en-IN")}`}
          iconBg="danger"
        />
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Patient</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Due</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => {
              const names = withNames(i);
              const displayStatus = getInvoiceDisplayStatus(i);
              const due = Number(i.dueAmount || 0);

              return (
                <tr
                  key={i.id}
                  onClick={() => setActive({ ...i, ...names })}
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    <p className="cell-title">{i.invoiceNumber || `INV-${i.id}`}</p>
                    <p className="cell-sub">{i.invoiceDate || "—"}</p>
                  </td>
                  <td>
                    <p className="cell-title">{names.patientName}</p>
                    <p className="cell-sub">{names.ownerName}</p>
                  </td>
                  <td className="cell-title">₹{Number(i.totalAmount || 0).toLocaleString("en-IN")}</td>
                  <td className="text-muted" style={{ color: Number(i.paidAmount) > 0 ? "var(--color-success, #10B981)" : undefined }}>
                    ₹{Number(i.paidAmount || 0).toLocaleString("en-IN")}
                  </td>
                  <td
                    className="text-muted"
                    style={{
                      fontWeight: due > 0 ? 600 : 400,
                      color: due > 0 ? (displayStatus === "OVERDUE" ? "var(--color-danger, #EF4444)" : "var(--color-warning, #F59E0B)") : undefined,
                    }}
                  >
                    ₹{due.toLocaleString("en-IN")}
                  </td>
                  <td>
                    <Badge variant={statusVariant[displayStatus] || "slate"}>
                      {displayStatus}
                    </Badge>
                  </td>
                  <td style={{ textAlign: "right" }}>›</td>
                </tr>
              );
            })}
            {!invoices.length && (
              <tr>
                <td colSpan={7} className="table-empty">
                  No invoices found.
                </td>
              </tr>
            )}
            {!!invoices.length && (
              <tr>
                <td className="cell-title">Total</td>
                <td />
                <td className="cell-title">₹{stats.totalBilled.toLocaleString("en-IN")}</td>
                <td className="text-muted" style={{ color: "var(--color-success, #10B981)", fontWeight: 600 }}>
                  ₹{stats.collected.toLocaleString("en-IN")}
                </td>
                <td className="text-muted" style={{ color: stats.pending > 0 ? "var(--color-warning, #F59E0B)" : undefined, fontWeight: 600 }}>
                  ₹{stats.pending.toLocaleString("en-IN")}
                </td>
                <td />
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="link-btn" onClick={exportCsv}>
          Export GST report
        </button>
      </div>

      <InvoiceModal
        open={!!active}
        invoice={active}
        onClose={() => setActive(null)}
        onUpdated={load}
      />
    </div>
  );
}

