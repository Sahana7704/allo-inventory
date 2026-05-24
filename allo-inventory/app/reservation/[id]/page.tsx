"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";

interface Reservation {
  id: string;
  productId: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  expiresAt: string;
  createdAt: string;
}

function Countdown({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    function tick() {
      const ms = new Date(expiresAt).getTime() - Date.now();
      if (ms <= 0) {
        setRemaining(0);
        onExpire();
        return;
      }
      setRemaining(ms);
    }
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [expiresAt, onExpire]);

  const total = 10 * 60 * 1000;
  const fraction = Math.max(0, remaining / total);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const isUrgent = remaining < 60000;
  const color = isUrgent ? "var(--danger)" : remaining < 3 * 60000 ? "var(--warning)" : "var(--accent)";

  // SVG ring
  const r = 44;
  const circ = 2 * Math.PI * r;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ position: "relative", width: 120, height: 120 }}>
        <svg width="120" height="120" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - fraction)}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.5s linear, stroke 1s" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontFamily: "DM Mono, monospace",
              fontSize: 22,
              fontWeight: 600,
              color,
              lineHeight: 1,
              animation: isUrgent ? "pulse 1s ease-in-out infinite" : undefined,
            }}
          >
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
          <span style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>remaining</span>
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }`}</style>
    </div>
  );
}

function StatusBanner({ status }: { status: Reservation["status"] }) {
  const config = {
    PENDING: { bg: "rgba(108,99,255,0.1)", border: "rgba(108,99,255,0.3)", color: "var(--accent)", icon: "⏳", label: "Reserved — awaiting payment" },
    CONFIRMED: { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.3)", color: "var(--success)", icon: "✓", label: "Confirmed — payment recorded" },
    RELEASED: { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", color: "var(--danger)", icon: "✗", label: "Released — units returned to stock" },
  }[status];

  return (
    <div
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
        borderRadius: 10,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        color: config.color,
        fontWeight: 500,
        fontSize: 14,
      }}
    >
      <span style={{ fontSize: 18 }}>{config.icon}</span>
      {config.label}
    </div>
  );
}

export default function ReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<"confirm" | "release" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchReservation = useCallback(async () => {
    try {
      const res = await fetch(`/api/reservations/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReservation(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reservation");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReservation();
  }, [fetchReservation]);

  async function handleConfirm() {
    setActionLoading("confirm");
    setActionError(null);
    try {
      const res = await fetch(`/api/reservations/${id}/confirm`, {
        method: "POST",
        headers: { "Idempotency-Key": `confirm-${id}` },
      });
      const data = await res.json();
      if (res.status === 410) {
        setActionError("⚠ This reservation has expired and can no longer be confirmed.");
        await fetchReservation();
      } else if (!res.ok) {
        setActionError(data.error ?? `Error ${res.status}`);
      } else {
        await fetchReservation();
      }
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRelease() {
    setActionLoading("release");
    setActionError(null);
    try {
      const res = await fetch(`/api/reservations/${id}/release`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? `Error ${res.status}`);
      } else {
        await fetchReservation();
      }
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 560, margin: "80px auto", padding: "0 24px", textAlign: "center", color: "var(--text-muted)" }}>
        Loading reservation…
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div style={{ maxWidth: 560, margin: "80px auto", padding: "0 24px" }}>
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: 24, color: "var(--danger)", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✗</div>
          <div style={{ fontWeight: 600 }}>{error ?? "Reservation not found"}</div>
        </div>
        <button
          onClick={() => router.push("/")}
          style={{ marginTop: 16, width: "100%", padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 14 }}
        >
          ← Back to products
        </button>
      </div>
    );
  }

  const isPending = reservation.status === "PENDING";
  const isExpired = isPending && new Date(reservation.expiresAt) < new Date();

  return (
    <div style={{ maxWidth: 560, margin: "48px auto", padding: "0 24px 60px" }}>
      <button
        onClick={() => router.push("/")}
        style={{ marginBottom: 24, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, padding: 0, display: "flex", alignItems: "center", gap: 4 }}
      >
        ← Back to products
      </button>

      <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 700 }}>Checkout</h1>
      <p style={{ margin: "0 0 28px", color: "var(--text-muted)", fontSize: 14, fontFamily: "DM Mono, monospace" }}>
        #{reservation.id.slice(-8).toUpperCase()}
      </p>

      <StatusBanner status={reservation.status} />

      {/* Countdown — only shown for active reservations */}
      {isPending && !isExpired && (
        <div
          className="fade-in"
          style={{
            marginTop: 28,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "28px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Countdown
            expiresAt={reservation.expiresAt}
            onExpire={fetchReservation}
          />
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
            Complete payment before the timer runs out or your hold will be released
          </p>
        </div>
      )}

      {/* Reservation details card */}
      <div
        className="fade-in"
        style={{
          marginTop: 20,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "DM Mono, monospace", marginBottom: 4 }}>
            Product
          </div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{reservation.productName}</div>
        </div>

        {[
          ["Warehouse", reservation.warehouseName],
          ["Quantity", reservation.quantity],
          ["Status", reservation.status],
          ["Expires", new Date(reservation.expiresAt).toLocaleTimeString()],
          ["Reserved at", new Date(reservation.createdAt).toLocaleString()],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              padding: "14px 24px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 500, fontFamily: label === "Expires" || label === "Reserved at" ? "DM Mono, monospace" : undefined }}>
              {String(value)}
            </span>
          </div>
        ))}
      </div>

      {/* Action error */}
      {actionError && (
        <div
          className="fade-in"
          style={{ marginTop: 16, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "12px 16px", color: "var(--danger)", fontSize: 13 }}
        >
          {actionError}
        </div>
      )}

      {/* Actions */}
      {isPending && !isExpired && (
        <div className="fade-in" style={{ marginTop: 24, display: "flex", gap: 12 }}>
          <button
            onClick={handleRelease}
            disabled={!!actionLoading}
            style={{
              flex: 1,
              padding: 13,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "transparent",
              color: actionLoading ? "var(--text-dim)" : "var(--text-muted)",
              fontSize: 14,
              cursor: actionLoading ? "not-allowed" : "pointer",
            }}
          >
            {actionLoading === "release" ? "Cancelling…" : "✗ Cancel reservation"}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!!actionLoading}
            style={{
              flex: 2,
              padding: 13,
              borderRadius: 10,
              border: "none",
              background: actionLoading ? "var(--text-dim)" : "var(--success)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: actionLoading ? "not-allowed" : "pointer",
            }}
          >
            {actionLoading === "confirm" ? "Confirming…" : "✓ Confirm purchase"}
          </button>
        </div>
      )}

      {(reservation.status === "CONFIRMED" || reservation.status === "RELEASED") && (
        <div className="fade-in" style={{ marginTop: 24 }}>
          <button
            onClick={() => router.push("/")}
            style={{
              width: "100%",
              padding: 13,
              borderRadius: 10,
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ← Browse more products
          </button>
        </div>
      )}
    </div>
  );
}
