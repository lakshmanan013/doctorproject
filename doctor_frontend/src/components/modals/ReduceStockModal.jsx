import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Input, { Field, Select, Textarea } from "../ui/Input";
import { createStockMovement } from "../../services/inventoryService";

const REASONS = [
  { value: "SALE", label: "Sold over the counter" },
  { value: "PRESCRIPTION", label: "Dispensed for a prescription" },
  { value: "EXPIRED", label: "Expired stock" },
  { value: "DAMAGED", label: "Damaged / wastage" },
];

export default function ReduceStockModal({ open, onClose, medicine, batches = [], onSaved }) {
  const [movementType, setMovementType] = useState("PRESCRIPTION");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const availableStock = medicine?.availableQty ?? medicine?.stockQuantity ?? 0;

  useEffect(() => {
    if (open) {
      setMovementType("PRESCRIPTION");
      setSelectedBatchId("");
      setQuantity("1");
      setNotes("");
    }
  }, [open, medicine?.id]);

  if (!medicine) return null;

  const qty = Number(quantity || 0);

  const submit = async () => {
    if (!qty || qty <= 0) return toast.error("Enter a quantity greater than zero");
    if (qty > availableStock && availableStock > 0) {
      return toast.error(`Cannot dispense ${qty}. Only ${availableStock} ${medicine.unit || "units"} available in inventory.`);
    }

    try {
      setSaving(true);
      await createStockMovement({
        medicineId: medicine.id,
        batchId: selectedBatchId ? Number(selectedBatchId) : undefined,
        movementType,
        quantity: qty,
        reason: notes || REASONS.find((r) => r.value === movementType)?.label,
      });
      toast.success(`Dispensed ${qty} ${medicine.unit || "units"} from inventory`);
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Could not dispense medicine");
    } finally {
      setSaving(false);
    }
  };

  const activeBatches = batches.filter((b) => (b.remainingQuantity == null ? b.quantity : b.remainingQuantity) > 0);

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title={`Dispense from Inventory — ${medicine.name || ""}`}
      subtitle={`Available in stock: ${availableStock} ${medicine.unit || "units"} · ${medicine.manufacturer || "General"}`}
    >
      <div className="form-grid-2">
        <Field label="Reason">
          <Select value={movementType} onChange={(e) => setMovementType(e.target.value)}>
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Quantity">
          <Input
            type="number"
            min="1"
            max={availableStock > 0 ? availableStock : undefined}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </Field>

        {activeBatches.length > 0 && (
          <Field label="Deduct from Batch" className="col-span-2">
            <Select value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)}>
              <option value="">Select Batch (Optional)</option>
              {activeBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  Batch #{b.batchNumber} (Available: {b.remainingQuantity != null ? b.remainingQuantity : b.quantity} {medicine.unit || "units"} · Exp: {b.expiryDate || "N/A"})
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Notes / Reference (optional)" className="col-span-2">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Dispensed for patient prescription / OTC sale" />
        </Field>
      </div>

      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={saving}>
          {saving ? "Saving..." : "Dispense from Inventory"}
        </Button>
      </div>
    </Modal>
  );
}
