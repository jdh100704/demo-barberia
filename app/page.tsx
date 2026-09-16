"use client";

import { useState, useMemo } from "react";
import { Clock, MapPin, Check, ChevronRight, ChevronLeft, Phone, User, Mail, MessageSquare, Star, Users, Scissors, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Work+Sans:wght@400;500;600&display=swap');`;

const BUSINESS = {
  name: "Tu Barbería",
  address: "Dirección de ejemplo, Madrid",
};

const TELEFONO_BARBERIA = "34600000000"; // sustituye por el número real cuando lo tengas

type Service = { id: string; name: string; desc: string; price: number; duration: number };
type ServiceGroup = { category: string; items: Service[] };
type Day = { key: string; label: string; dayNum: number; month: string };
type Slot = { label: string; taken: boolean };
type FormState = { name: string; phone: string; email: string; notes: string };
type Barber = { id: string; name: string; rating: number | null };

const SERVICE_GROUPS: ServiceGroup[] = [
  {
    category: "Servicios de corte",
    items: [
      { id: "corte-cabello", name: "Corte de cabello", desc: "Corte a máquina o tijera.", price: 15, duration: 30 },
      { id: "corte-barba-vapor", name: "Corte y barba con vapor", desc: "Corte completo + barba con toalla caliente.", price: 25, duration: 60 },
      { id: "corte-arreglo-barba", name: "Corte y arreglo de barba", desc: "Corte + perfilado de barba.", price: 22, duration: 45 },
      { id: "corte-nino", name: "Corte de niño", desc: "Corte para menores.", price: 12, duration: 30 },
    ],
  },
  {
    category: "Servicios de barba",
    items: [
      { id: "barba", name: "Arreglo de barba", desc: "Perfilado clásico.", price: 12, duration: 30 },
      { id: "barba-vapor", name: "Barba con vapor", desc: "Perfilado + vapor facial.", price: 15, duration: 30 },
    ],
  },
  {
    category: "Servicios extra",
    items: [
      { id: "tinte", name: "Tinte de cabello", desc: "", price: 20, duration: 60 },
      { id: "mascarilla", name: "Mascarilla facial", desc: "Limpieza e hidratación.", price: 10, duration: 20 },
      { id: "lavado", name: "Lavado y peinado", desc: "", price: 5, duration: 10 },
    ],
  },
];

const ALL_SERVICES: Service[] = SERVICE_GROUPS.flatMap((g) => g.items);

const BARBERS: Barber[] = [
  { id: "cualquiera", name: "Cualquiera", rating: null },
  { id: "barbero1", name: "Barbero 1", rating: 5.0 },
  { id: "barbero2", name: "Barbero 2", rating: 4.9 },
];

const STEPS = ["Servicios", "Fecha", "Barbero", "Tus datos", "Confirmación"];

const OCCUPIED = new Set(["mar-10:00", "mar-10:30", "mié-12:00", "jue-17:30", "vie-10:00", "vie-10:30", "vie-11:00"]);

function nextDays(n: number): Day[] {
  const names = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const out: Day[] = [];
  const d = new Date();
  while (out.length < n) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) {
      out.push({
        key: names[d.getDay()],
        label: `${names[d.getDay()]} ${d.getDate()}`,
        dayNum: d.getDate(),
        month: d.toLocaleDateString("es-ES", { month: "short" }),
      });
    }
  }
  return out;
}

function timeSlots(dayKey: string): Slot[] {
  const ranges: [number, number][] = [
    [10 * 60, 14 * 60],
    [16.5 * 60, 20.5 * 60],
  ];
  const slots: Slot[] = [];
  for (const [start, end] of ranges) {
    for (let m = start; m < end; m += 30) {
      const h = Math.floor(m / 60);
      const mm = m % 60;
      const label = `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      slots.push({ label, taken: OCCUPIED.has(`${dayKey}-${label}`) });
    }
  }
  return slots;
}

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function BookingApp() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [barber, setBarber] = useState<string>("cualquiera");
  const [day, setDay] = useState<Day | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ name: "", phone: "", email: "", notes: "" });
  const [done, setDone] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);

  const days = useMemo(() => nextDays(10), []);
  const slots = useMemo(() => (day ? timeSlots(day.key) : []), [day]);

  const cart = ALL_SERVICES.filter((s) => selected.includes(s.id));
  const total = cart.reduce((a, s) => a + s.price, 0);
  const totalDuration = cart.reduce((a, s) => a + s.duration, 0);
  const chosenBarber = BARBERS.find((b) => b.id === barber) ?? BARBERS[0];

  const toggle = (id: string) =>
    setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));

  const canNext = [
    selected.length > 0,
    Boolean(day && time),
    Boolean(barber),
    Boolean(form.name.trim() && form.phone.trim()),
    false,
  ][step];

  // Guarda la reserva en Supabase y, si todo va bien, muestra la pantalla de confirmación
  const confirmarReserva = async () => {
    setGuardando(true);
    setErrorGuardado(null);

    const { error } = await supabase.from("reservas").insert([
      {
        nombre_cliente: form.name,
        telefono: form.phone,
        email: form.email || null,
        notas: form.notes || null,
        servicios: cart.map((s) => ({ nombre: s.name, precio: s.price })), // se guarda como jsonb
        barbero: chosenBarber.name,
        fecha: day ? `${day.label} ${day.month}` : "",
        hora: time ?? "",
        total,
        duracion_min: totalDuration,
      },
    ]);

    setGuardando(false);

    if (error) {
      console.error("Error al guardar la reserva:", error);
      setErrorGuardado("No se pudo guardar la reserva. Inténtalo de nuevo.");
      return;
    }

    setDone(true);
    setStep(4);
  };

  const goNext = () => {
    if (step === 3) {
      confirmarReserva();
      return;
    }
    setStep((s) => Math.min(s + 1, 4));
  };

  // Construye el enlace de wa.me con el mensaje de confirmación ya escrito
  const obtenerLinkWhatsApp = () => {
    const servicios = cart.map((s) => s.name).join(", ");
    const texto = `¡Hola! Acabo de reservar una cita.%0A%0A*Nombre:* ${form.name}%0A*Servicios:* ${servicios}%0A*Fecha:* ${day?.label} ${day?.month}%0A*Hora:* ${time}%0A*Total:* ${total.toFixed(2)}€%0A%0A¡Confirmo mi cita!`;
    return `https://wa.me/${TELEFONO_BARBERIA}?text=${texto}`;
  };

  const colors = {
    bg: "#171310",
    card: "#221C17",
    border: "#3A312A",
    brass: "#C99A4A",
    brassSoft: "#8A6B36",
    text: "#F1E9DD",
    textMuted: "#B3A493",
  };

  return (
    <div style={{ background: colors.bg, minHeight: "100%", color: colors.text, fontFamily: "'Work Sans', sans-serif" }}>
      <style>{`
        ${FONT_IMPORT}
        .rf-head { font-family: 'Oswald', sans-serif; letter-spacing: 0.01em; }
        .rf-svc-row:hover { border-color: ${colors.brass}; }
        .rf-btn:active { transform: scale(0.98); }
        .rf-day:hover, .rf-slot:hover, .rf-barber:hover { border-color: ${colors.brass} !important; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
      `}</style>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 60px" }}>
        {/* Aviso de que es una demo genérica */}
        <div
          style={{
            background: "rgba(201,154,74,0.1)",
            border: `1px solid ${colors.brass}`,
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 20,
            fontSize: 12.5,
            color: colors.text,
          }}
        >
          Esto es una demo de ejemplo — servicios, precios y barberos son solo ilustrativos. La versión final se adapta 100% a tu negocio (logo, catálogo real y equipo).
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: colors.brass,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Scissors size={24} color={colors.bg} />
          </div>
          <div>
            <div className="rf-head" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.1 }}>
              {BUSINESS.name}
            </div>
            <div style={{ fontSize: 13, color: colors.textMuted, display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
              <MapPin size={13} /> {BUSINESS.address}
            </div>
          </div>
        </div>

        {/* Step indicator */}
        {!done && (
          <div style={{ display: "flex", gap: 0, marginBottom: 30, borderBottom: `1px solid ${colors.border}` }}>
            {STEPS.slice(0, 4).map((label, i) => (
              <div
                key={label}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "0 0 12px",
                  borderBottom: `2px solid ${i === step ? colors.brass : "transparent"}`,
                  marginBottom: -1,
                  color: i === step ? colors.text : colors.textMuted,
                  fontSize: 13,
                  fontWeight: i === step ? 600 : 400,
                }}
              >
                {label}
              </div>
            ))}
          </div>
        )}

        {/* Step 0: Services */}
        {step === 0 && !done && (
          <div>
            {SERVICE_GROUPS.map((group) => (
              <div key={group.category} style={{ marginBottom: 26 }}>
                <div className="rf-head" style={{ fontSize: 15, color: colors.brass, marginBottom: 10, fontWeight: 600 }}>
                  {group.category}
                </div>
                {group.items.map((s) => {
                  const isSel = selected.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      className="rf-svc-row"
                      onClick={() => toggle(s.id)}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        padding: "14px 16px",
                        marginBottom: 8,
                        borderRadius: 8,
                        border: `1px solid ${isSel ? colors.brass : colors.border}`,
                        background: isSel ? "rgba(201,154,74,0.08)" : colors.card,
                        cursor: "pointer",
                        transition: "border-color 120ms ease",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 500 }}>{s.name}</div>
                        {s.desc && <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 3 }}>{s.desc}</div>}
                        <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 5, display: "flex", alignItems: "center", gap: 4 }}>
                          <Clock size={12} /> {fmtDuration(s.duration)}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 600 }}>{s.price.toFixed(2)}€</div>
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            border: `1.5px solid ${isSel ? colors.brass : colors.textMuted}`,
                            background: isSel ? colors.brass : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {isSel && <Check size={14} color={colors.bg} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Step 1: Date & time */}
        {step === 1 && !done && (
          <div>
            <div className="rf-head" style={{ fontSize: 15, color: colors.brass, marginBottom: 12, fontWeight: 600 }}>
              Elige un día
            </div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 24 }}>
              {days.map((d) => (
                <div
                  key={d.label}
                  className="rf-day"
                  onClick={() => {
                    setDay(d);
                    setTime(null);
                  }}
                  style={{
                    flexShrink: 0,
                    width: 64,
                    padding: "10px 0",
                    textAlign: "center",
                    borderRadius: 8,
                    border: `1px solid ${day?.label === d.label ? colors.brass : colors.border}`,
                    background: day?.label === d.label ? "rgba(201,154,74,0.1)" : colors.card,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 11, color: colors.textMuted, textTransform: "capitalize" }}>{d.key}</div>
                  <div style={{ fontSize: 18, fontWeight: 600, margin: "2px 0" }}>{d.dayNum}</div>
                  <div style={{ fontSize: 10, color: colors.textMuted, textTransform: "capitalize" }}>{d.month}</div>
                </div>
              ))}
            </div>

            {day && (
              <>
                <div className="rf-head" style={{ fontSize: 15, color: colors.brass, marginBottom: 12, fontWeight: 600 }}>
                  Elige una hora
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {slots.map((s) => (
                    <div
                      key={s.label}
                      className={s.taken ? "" : "rf-slot"}
                      onClick={() => !s.taken && setTime(s.label)}
                      style={{
                        textAlign: "center",
                        padding: "9px 0",
                        borderRadius: 6,
                        fontSize: 13,
                        border: `1px solid ${time === s.label ? colors.brass : colors.border}`,
                        background: s.taken ? "transparent" : time === s.label ? "rgba(201,154,74,0.12)" : colors.card,
                        color: s.taken ? "#5A5148" : colors.text,
                        textDecoration: s.taken ? "line-through" : "none",
                        cursor: s.taken ? "not-allowed" : "pointer",
                      }}
                    >
                      {s.label}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 2: Barber */}
        {step === 2 && !done && (
          <div>
            <div className="rf-head" style={{ fontSize: 15, color: colors.brass, marginBottom: 12, fontWeight: 600 }}>
              Elige quién te atiende
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {BARBERS.map((b) => {
                const isSel = barber === b.id;
                return (
                  <div
                    key={b.id}
                    className="rf-barber"
                    onClick={() => setBarber(b.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "12px 16px",
                      borderRadius: 8,
                      border: `1px solid ${isSel ? colors.brass : colors.border}`,
                      background: isSel ? "rgba(201,154,74,0.08)" : colors.card,
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        background: b.id === "cualquiera" ? "transparent" : colors.brassSoft,
                        border: b.id === "cualquiera" ? `1.5px solid ${colors.textMuted}` : "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {b.id === "cualquiera" ? (
                        <Users size={18} color={colors.textMuted} />
                      ) : (
                        <span className="rf-head" style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>
                          {initials(b.name)}
                        </span>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 500 }}>{b.name}</div>
                      {b.rating && (
                        <div style={{ fontSize: 12.5, color: colors.textMuted, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                          <Star size={11} fill={colors.brass} color={colors.brass} /> {b.rating.toFixed(1)}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        border: `1.5px solid ${isSel ? colors.brass : colors.textMuted}`,
                        background: isSel ? colors.brass : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {isSel && <Check size={13} color={colors.bg} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Contact form */}
        {step === 3 && !done && (
          <div>
            <div className="rf-head" style={{ fontSize: 15, color: colors.brass, marginBottom: 16, fontWeight: 600 }}>
              Tus datos de contacto
            </div>
            {(
              [
                { key: "name", label: "Nombre y apellidos", icon: User, type: "text" },
                { key: "phone", label: "Teléfono", icon: Phone, type: "tel" },
                { key: "email", label: "Email (opcional)", icon: Mail, type: "email" },
              ] as { key: keyof FormState; label: string; icon: typeof User; type: string }[]
            ).map(({ key, label, icon: Icon, type }) => (
              <div key={key} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12.5, color: colors.textMuted, display: "block", marginBottom: 6 }}>{label}</label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    padding: "10px 14px",
                    background: colors.card,
                  }}
                >
                  <Icon size={16} color={colors.textMuted} />
                  <input
                    type={type}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    style={{ background: "transparent", border: "none", outline: "none", color: colors.text, fontSize: 14, width: "100%" }}
                    placeholder={label}
                  />
                </div>
              </div>
            ))}
            <div>
              <label style={{ fontSize: 12.5, color: colors.textMuted, display: "block", marginBottom: 6 }}>Notas (opcional)</label>
              <div style={{ display: "flex", gap: 10, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "10px 14px", background: colors.card }}>
                <MessageSquare size={16} color={colors.textMuted} style={{ marginTop: 2, flexShrink: 0 }} />
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  style={{ background: "transparent", border: "none", outline: "none", color: colors.text, fontSize: 14, width: "100%", resize: "none", fontFamily: "inherit" }}
                  placeholder="Notas adicionales..."
                />
              </div>
            </div>
            {errorGuardado && (
              <p style={{ color: "#f87171", fontSize: 12.5, marginTop: 12 }}>{errorGuardado}</p>
            )}
          </div>
        )}

        {/* Step 4: Confirmation */}
        {done && step === 4 && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: colors.brass,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 18px",
              }}
            >
              <Check size={28} color={colors.bg} />
            </div>
            <div className="rf-head" style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>
              Cita confirmada
            </div>
            <div style={{ color: colors.textMuted, fontSize: 14, marginBottom: 26 }}>
              Te esperamos en {BUSINESS.name}
            </div>

            <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 20, textAlign: "left" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${colors.border}` }}>
                <div>
                  <div style={{ fontSize: 13, color: colors.textMuted }}>Fecha y hora</div>
                  <div style={{ fontSize: 15, fontWeight: 600, textTransform: "capitalize" }}>
                    {day?.key} {day?.dayNum} {day?.month} · {time}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, color: colors.textMuted }}>Duración</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{fmtDuration(totalDuration)}</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${colors.border}` }}>
                <div style={{ fontSize: 13, color: colors.textMuted }}>Barbero</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{chosenBarber.name}</div>
              </div>
              {cart.map((s) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 8 }}>
                  <span>{s.name}</span>
                  <span>{s.price.toFixed(2)}€</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${colors.border}`, fontSize: 16, fontWeight: 600 }}>
                <span>Total</span>
                <span>{total.toFixed(2)}€</span>
              </div>
            </div>

            <div style={{ marginTop: 20, fontSize: 13, color: colors.textMuted }}>
              Reservado a nombre de <strong style={{ color: colors.text }}>{form.name}</strong> · {form.phone}
            </div>

            <a
              href={obtenerLinkWhatsApp()}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                marginTop: 20,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#25D366",
                color: "#0b1a0f",
                fontWeight: 600,
                padding: "12px 22px",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              💬 Confirmar por WhatsApp
            </a>
          </div>
        )}

        {/* Bottom bar */}
        {!done && (
          <div
            style={{
              position: "sticky",
              bottom: 0,
              marginTop: 28,
              paddingTop: 16,
              borderTop: `1px solid ${colors.border}`,
              background: colors.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
            }}
          >
            {step > 0 ? (
              <button
                className="rf-btn"
                onClick={() => setStep((s) => s - 1)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  background: "transparent",
                  border: "none",
                  color: colors.textMuted,
                  fontSize: 14,
                  cursor: "pointer",
                  padding: "10px 4px",
                }}
              >
                <ChevronLeft size={16} /> Atrás
              </button>
            ) : (
              <div />
            )}

            <div style={{ textAlign: "right" }}>
              {cart.length > 0 && (
                <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 6 }}>
                  {cart.length} servicio{cart.length > 1 ? "s" : ""} · {total.toFixed(2)}€
                </div>
              )}
              <button
                className="rf-btn"
                disabled={!canNext || guardando}
                onClick={goNext}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: canNext ? colors.brass : colors.border,
                  color: canNext ? colors.bg : colors.textMuted,
                  border: "none",
                  borderRadius: 8,
                  padding: "12px 22px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: canNext && !guardando ? "pointer" : "not-allowed",
                }}
              >
                {guardando ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Guardando...
                  </>
                ) : (
                  <>
                    {step === 3 ? "Confirmar cita" : "Continuar"} <ChevronRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}