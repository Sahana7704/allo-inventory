"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface StockEntry {
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  total: number;
  reserved: number;
  available: number;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  stock: StockEntry[];
}

function StockBadge({ available }: { available: number }) {
  const isLow = available > 0 && available <= 5;
  const isOut = available === 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 20,
        fontFamily: "DM Mono, monospace",
        background: isOut
          ? "rgba(239,68,68,0.12)"
          : isLow
          ? "rgba(245,158,11,0.12)"
          : "rgba(34,197,94,0.12)",
        color: isOut
          ? "var(--danger)"
          : isLow
          ? "var(--warning)"
          : "var(--success)",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: isOut ? "var(--danger)" : isLow ? "var(--warning)" : "var(--success)",
          display: "inline-block",
        }}
      />
      {isOut ? "Out of stock" : `${available} available`}
    </span>
  );
}

function ReserveModal({
  product,
  onClose,
  onSuccess,
}: {
  product: Product;
  onClose: () => void;
  onSuccess: (reservationId: string) => void;
}) {
  const [warehouseId, setWarehouseId] = useState(
    product.stock.find((s) => s.available > 0)?.warehouseId ?? ""
  );
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStock = product.stock.find((s) => s.warehouseId === warehouseId);
  const maxQty = selectedStock?.available ?? 0;

  async function handleReserve() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ productId: product.id, warehouseId, quantity }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`);
      } else {
        onSuccess(data.id);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="fade-in"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 32,
          width: "100%",
          maxWidth: 440,
        }}
      >
        <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600 }}>
          Reserve units
        </h2>
        <p style={{ margin: "0 0 24px", color: "var(--text-muted)", fontSize: 14 }}>
          {product.name}
        </p>

        {/* Warehouse selector */}
        <label style={{ display: "block", marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6, display: "block", fontWeight: 500 }}>
            Warehouse
          </span>
          <select
            value={warehouseId}
            onChange={(e) => { setWarehouseId(e.target.value); setQuantity(1); }}
            style={{
              width: "100%",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text)",
              padding: "10px 12px",
              fontSize: 14,
              appearance: "none",
              cursor: "pointer",
            }}
          >
            {product.stock.map((s) => (
              <option key={s.warehouseId} value={s.warehouseId} disabled={s.available === 0}>
                {s.warehouseName} — {s.available} avail. ({s.warehouseLocation})
              </option>
            ))}
          </select>
        </label>

        {/* Quantity */}
        <label style={{ display: "block", marginBottom: 24 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6, display: "block", fontWeight: 500 }}>
            Quantity
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 18, cursor: "pointer" }}
            >
              −
            </button>
            <span style={{ fontWeight: 600, fontSize: 18, minWidth: 32, textAlign: "center", fontFamily: "DM Mono, monospace" }}>
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              disabled={quantity >= maxQty}
              style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: quantity >= maxQty ? "var(--text-dim)" : "var(--text)", fontSize: 18, cursor: quantity >= maxQty ? "not-allowed" : "pointer" }}
            >
              +
            </button>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              of {maxQty} available
            </span>
          </div>
        </label>

        {/* Summary */}
        <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Total</span>
          <span style={{ fontWeight: 700, fontSize: 18 }}>
            ₹{(product.price * quantity).toLocaleString("en-IN")}
          </span>
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "var(--danger)", fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: "11px 0", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={handleReserve}
            disabled={loading || maxQty === 0}
            style={{
              flex: 2,
              padding: "11px 0",
              borderRadius: 9,
              border: "none",
              background: loading || maxQty === 0 ? "var(--text-dim)" : "var(--accent)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: loading || maxQty === 0 ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
          >
            {loading ? "Reserving…" : "Hold for 10 min →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product, onReserve }: { product: Product; onReserve: () => void }) {
  const totalAvailable = product.stock.reduce((s, w) => s + w.available, 0);

  return (
    <div
      className="fade-in"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "border-color 0.2s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
    >
      {/* Image */}
      {product.imageUrl && (
        <div style={{ height: 180, overflow: "hidden", background: "var(--surface-2)" }}>
          <img
            src={product.imageUrl}
            alt={product.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}

      <div style={{ padding: "18px 20px 20px", flex: 1, display: "flex", flexDirection: "column" }}>
        {/* SKU */}
        <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "DM Mono, monospace", marginBottom: 6 }}>
          {product.sku}
        </div>

        <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>
          {product.name}
        </h3>

        {product.description && (
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, flex: 1 }}>
            {product.description}
          </p>
        )}

        {/* Stock per warehouse */}
        <div style={{ marginBottom: 16 }}>
          {product.stock.map((s) => (
            <div
              key={s.warehouseId}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid var(--border)" }}
            >
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                📦 {s.warehouseName}
              </span>
              <StockBadge available={s.available} />
            </div>
          ))}
        </div>

        {/* Price + CTA */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 20 }}>
            ₹{product.price.toLocaleString("en-IN")}
          </span>
          <button
            onClick={onReserve}
            disabled={totalAvailable === 0}
            style={{
              padding: "9px 18px",
              borderRadius: 8,
              border: "none",
              background: totalAvailable === 0 ? "var(--surface-2)" : "var(--accent)",
              color: totalAvailable === 0 ? "var(--text-dim)" : "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: totalAvailable === 0 ? "not-allowed" : "pointer",
              transition: "background 0.15s, transform 0.1s",
            }}
            onMouseDown={(e) => { if (totalAvailable > 0) (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)"; }}
            onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
          >
            {totalAvailable === 0 ? "Unavailable" : "Reserve →"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reservingProduct, setReservingProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => { setProducts(data); setLoading(false); })
      .catch(() => { setError("Failed to load products"); setLoading(false); });
  }, []);

  function handleSuccess(reservationId: string) {
    setReservingProduct(null);
    router.push(`/reservation/${reservationId}`);
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 32, fontWeight: 700, letterSpacing: -0.5 }}>
          Product Catalogue
        </h1>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 15 }}>
          Reserve items across warehouses. Holds expire in 10 minutes.
        </p>
      </div>

      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 80, color: "var(--text-muted)" }}>
          Loading products…
        </div>
      )}

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: 20, color: "var(--danger)" }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 20,
          }}
        >
          {products.map((p, i) => (
            <div key={p.id} style={{ animationDelay: `${i * 60}ms` }}>
              <ProductCard product={p} onReserve={() => setReservingProduct(p)} />
            </div>
          ))}
        </div>
      )}

      {reservingProduct && (
        <ReserveModal
          product={reservingProduct}
          onClose={() => setReservingProduct(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
