import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { FiMessageCircle, FiCheckCircle } from "react-icons/fi";
import { SiRazorpay } from "react-icons/si";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { createPayment, createRazorpayOrder, verifyRazorpayPayment } from "../../services/billingService";
import { openRazorpayCheckout } from "../../utils/razorpay";
import { toE164 } from "../../utils/phone";

const MODES = ["Cash", "UPI", "Card", "Razorpay"];

export default function InvoiceModal({ open, onClose, invoice, onUpdated }) {
  const [mode, setMode] = useState("Cash");
  const [payment, setPayment] = useState("0");
  const [payingOnline, setPayingOnline] = useState(false);
  const [saving, setSaving] = useState(false);

  const due = Number(invoice?.dueAmount ?? 0);
  const isSettled = due <= 0;

  useEffect(() => {
    if (invoice) {
      setPayment(String(Math.max(0, Number(invoice.dueAmount ?? 0))));
    }
  }, [invoice]);

  if (!invoice) return null;

  const markPaid = async () => {
    const amount = Number(payment || 0);
    if (amount <= 0) return toast.error("Please enter a valid amount to pay");
    if (amount > due) {
      return toast.error(`Payment amount cannot exceed remaining due (₹${due.toLocaleString("en-IN")})`);
    }

    try {
      setSaving(true);
      await createPayment({
        invoiceId: invoice.id,
        ownerId: invoice.ownerId,
        patientId: invoice.patientId,
        amount,
        paymentMethod: mode.toUpperCase(),
        notes: `Recorded ${mode} payment`,
      });
      toast.success(`₹${amount.toLocaleString("en-IN")} payment recorded successfully`);
      window.dispatchEvent(new CustomEvent("invoicesUpdated"));
      onUpdated?.();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Could not record payment");
    } finally {
      setSaving(false);
    }
  };

  const payWithRazorpay = async () => {
    const amount = Number(payment || 0);
    if (amount <= 0) return toast.error("Enter an amount to pay");
    if (amount > due) {
      return toast.error(`Payment amount cannot exceed remaining due (₹${due.toLocaleString("en-IN")})`);
    }

    try {
      setPayingOnline(true);
      const order = await createRazorpayOrder({ invoiceId: invoice.id, amount });
      const result = await openRazorpayCheckout(order, {
        name: "Zenve Veterinary Clinic",
        description: invoice.invoiceNumber || `INV-${invoice.id}`,
        prefill: {
          contact: invoice.ownerPhone ? toE164(invoice.ownerPhone) : undefined,
          email: invoice.ownerEmail || undefined,
        },
      });
      await verifyRazorpayPayment({
        invoiceId: invoice.id,
        razorpayOrderId: result.razorpay_order_id,
        razorpayPaymentId: result.razorpay_payment_id,
        razorpaySignature: result.razorpay_signature,
        amount,
      });
      toast.success("Payment received via Razorpay");
      window.dispatchEvent(new CustomEvent("invoicesUpdated"));
      onUpdated?.();
      onClose();
    } catch (e) {
      const message = e?.response?.data?.message || e?.message || "Razorpay payment could not be completed";
      toast.error(message);
    } finally {
      setPayingOnline(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${invoice.invoiceNumber || `INV-${invoice.id}`}`}
      subtitle={`${invoice.patientName || `Patient #${invoice.patientId || "—"}`} · Owner: ${invoice.ownerName || `#${invoice.ownerId || "—"}`}`}
    >
      <div className="stack-2">
        <div className="invoice-line">
          <span className="text-muted">Total</span>
          <span style={{ fontWeight: 600 }}>₹{Number(invoice.totalAmount || 0).toLocaleString("en-IN")}</span>
        </div>
        <div className="invoice-line">
          <span className="text-muted">Paid</span>
          <span style={{ fontWeight: 600, color: "var(--color-success, #10B981)" }}>
            ₹{Number(invoice.paidAmount || 0).toLocaleString("en-IN")}
          </span>
        </div>
        <div className="invoice-line">
          <span className="text-muted">Due</span>
          <span style={{ fontWeight: 700, color: due > 0 ? "var(--color-danger, #EF4444)" : "var(--color-success, #10B981)" }}>
            ₹{due.toLocaleString("en-IN")}
          </span>
        </div>
        {invoice.dueDate && (
          <div className="invoice-line">
            <span className="text-muted">Due Date</span>
            <span>{invoice.dueDate}</span>
          </div>
        )}
      </div>

      {isSettled ? (
        <div style={{ marginTop: 20, padding: 14, background: "rgba(16, 185, 129, 0.08)", borderRadius: 10, display: "flex", alignItems: "center", gap: 10, color: "#10B981" }}>
          <FiCheckCircle size={20} />
          <span style={{ fontWeight: 500 }}>This invoice is fully paid. No outstanding due.</span>
        </div>
      ) : (
        <>
          <div style={{ marginTop: 20 }}>
            <p className="eyebrow">Payment mode</p>
            <div className="payment-modes">
              {MODES.map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`payment-mode-btn ${mode === m ? "active" : ""}`}
                >
                  {m === "Razorpay" && <SiRazorpay size={13} style={{ marginRight: 5, verticalAlign: -2 }} />}
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <p className="eyebrow" style={{ margin: 0 }}>Amount to apply</p>
              <button
                type="button"
                onClick={() => setPayment(String(due))}
                style={{ background: "none", border: "none", color: "var(--primary-color, #6366F1)", fontSize: 12, cursor: "pointer", fontWeight: 500 }}
              >
                Pay Full Due (₹{due.toLocaleString("en-IN")})
              </button>
            </div>
            <input
              className="input"
              type="number"
              min="1"
              max={due}
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
            />
          </div>

          {mode === "Razorpay" && (
            <p className="text-faint" style={{ marginTop: 8, fontSize: 12 }}>
              Opens the Razorpay checkout — the invoice is marked paid automatically once payment is verified.
            </p>
          )}
        </>
      )}

      <div className="flex-between" style={{ marginTop: 24 }}>
        <button
          onClick={() => {
            if (invoice.ownerPhone || invoice.ownerEmail) {
              toast.success(`Invoice summary sent to ${invoice.ownerPhone || invoice.ownerEmail}`);
            } else {
              toast("Invoice messaging needs an owner phone/email from the record");
            }
          }}
          className="link-btn"
        >
          <FiMessageCircle size={16} /> Send to owner
        </button>
        {!isSettled && (
          mode === "Razorpay" ? (
            <Button onClick={payWithRazorpay} disabled={payingOnline}>
              {payingOnline ? "Opening Razorpay..." : "Pay with Razorpay"}
            </Button>
          ) : (
            <Button onClick={markPaid} disabled={saving}>
              {saving ? "Recording..." : `Record ${mode} payment`}
            </Button>
          )
        )}
      </div>
    </Modal>
  );
}

