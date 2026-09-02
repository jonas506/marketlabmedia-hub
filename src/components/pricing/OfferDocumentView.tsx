import logo from "@/assets/logo-dark.png";
import { OfferDoc, eur, eur2, sumPositions } from "./offerDocument";

/**
 * 1:1 Nachbau der Marketlab-Angebots-PDF (2 Seiten, A4).
 * Wird sowohl in der Vorschau, auf der Kundenseite als auch beim Druck/PDF verwendet.
 */

const C = {
  ink: "#0B0B0F",
  soft: "#5A6377",
  faint: "#8B94A7",
  line: "#E4E9F2",
  blue: "#2F6BFF",
  blueSoft: "#EFF4FF",
  bg: "#FFFFFF",
};

const PAGE_W = 794;
const PAGE_H = 1123;

const font = "'Outfit', 'Poppins', system-ui, sans-serif";

const Page = ({ children }: { children: React.ReactNode }) => (
  <div
    className="offer-page"
    style={{
      width: PAGE_W,
      minHeight: PAGE_H,
      background: C.bg,
      backgroundImage:
        "radial-gradient(120% 45% at 100% 0%, rgba(47,107,255,0.07) 0%, rgba(255,255,255,0) 60%)",
      color: C.ink,
      fontFamily: font,
      padding: "48px 56px 40px",
      display: "flex",
      flexDirection: "column",
      position: "relative",
      boxSizing: "border-box",
    }}
  >
    {children}
  </div>
);

const Head = ({ doc, page }: { doc: OfferDoc; page: number }) => (
  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 34 }}>
    <img src={logo} alt="Marketlab Media" style={{ height: 26, objectFit: "contain" }} />
    <div style={{ textAlign: "right", lineHeight: 1.7 }}>
      {doc.offerNumber && page === 1 && (
        <div style={{ fontSize: 8, letterSpacing: "0.22em", color: C.faint, fontWeight: 600 }}>
          ANGEBOT {doc.offerNumber.toUpperCase()}
        </div>
      )}
      <div style={{ fontSize: 8, letterSpacing: "0.22em", color: C.soft, fontWeight: 600 }}>
        {doc.headerKicker}
      </div>
      <div style={{ fontSize: 8, letterSpacing: "0.22em", color: C.faint, fontWeight: 500 }}>
        {doc.dateLabel}
      </div>
    </div>
  </div>
);

const Foot = ({ doc, page, total }: { doc: OfferDoc; page: number; total: number }) => (
  <div
    style={{
      marginTop: "auto",
      paddingTop: 22,
      display: "flex",
      justifyContent: "space-between",
      fontSize: 7.5,
      letterSpacing: "0.18em",
      color: C.faint,
      fontWeight: 600,
    }}
  >
    <span>{doc.footerCompany.toUpperCase()}</span>
    <span>VERTRAULICH</span>
    <span>SEITE {page} / 2</span>
  </div>
);

const SectionTitle = ({ n, title }: { n: string; title: string }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 30, marginBottom: 14 }}>
    <span style={{ fontSize: 9, fontWeight: 700, color: C.blue, letterSpacing: "0.08em" }}>{n}</span>
    <span style={{ fontSize: 17, fontWeight: 600 }}>{title}</span>
  </div>
);

const MetaCol = ({ title, name, lines }: { title: string; name: string; lines: string[] }) => (
  <div style={{ flex: 1 }}>
    <div style={{ fontSize: 7.5, letterSpacing: "0.2em", color: C.faint, fontWeight: 600, marginBottom: 10 }}>
      {title}
    </div>
    <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 3 }}>{name}</div>
    {lines.map((l, i) => (
      <div key={i} style={{ fontSize: 10, color: C.soft, lineHeight: 1.6 }}>{l}</div>
    ))}
  </div>
);

export default function OfferDocumentView({ doc }: { doc: OfferDoc }) {
  const total = sumPositions(doc.positions);
  const brutto = total * (1 + (doc.vatRate || 0) / 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* ---------------- SEITE 1 ---------------- */}
      <Page>
        <Head doc={doc} page={1} />

        {doc.eyebrow && (
          <div style={{ fontSize: 8.5, letterSpacing: "0.22em", color: C.blue, fontWeight: 700, marginBottom: 18 }}>
            {doc.eyebrow}
          </div>
        )}

        <div style={{ fontSize: 30, fontWeight: 300, color: "#A6AEBF", lineHeight: 1.1 }}>{doc.titleTop}</div>
        <div style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.15, marginBottom: 30 }}>{doc.titleMain}</div>

        <div style={{ display: "flex", gap: 28 }}>
          <MetaCol title={doc.fromTitle} name={doc.fromName} lines={doc.fromLines} />
          <MetaCol title={doc.toTitle} name={doc.toName} lines={doc.toLines} />
          <MetaCol
            title={doc.scopeTitle}
            name={doc.scopeLines[0] ?? ""}
            lines={doc.scopeLines.slice(1)}
          />
        </div>

        <SectionTitle n="01" title={doc.positionsTitle} />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 7.5,
            letterSpacing: "0.2em",
            color: C.faint,
            fontWeight: 600,
            paddingBottom: 10,
            borderBottom: `1px solid ${C.line}`,
          }}
        >
          <span>POSITION</span>
          <span style={{ display: "flex", gap: 60 }}>
            <span>BERECHNUNG</span>
            <span style={{ width: 60, textAlign: "right" }}>BETRAG</span>
          </span>
        </div>

        {doc.positions.map((p) => (
          <div
            key={p.id}
            style={{ display: "flex", gap: 20, padding: "13px 0", borderBottom: `1px solid ${C.line}` }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>{p.title}</div>
              {p.description && (
                <div style={{ fontSize: 9, color: C.soft, lineHeight: 1.65, maxWidth: 430 }}>{p.description}</div>
              )}
            </div>
            <div style={{ width: 110, textAlign: "right", fontSize: 9, color: C.soft, paddingTop: 2 }}>{p.calc}</div>
            <div style={{ width: 78, textAlign: "right", fontSize: 12.5, fontWeight: 700 }}>
              {p.amount > 0 ? eur(p.amount) : "—"}
            </div>
          </div>
        ))}

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 26 }}>
          <div style={{ fontSize: 17, fontWeight: 600 }}>{doc.totalLabel}</div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.01em" }}>{eur(total)}</div>
            <div style={{ fontSize: 9, color: C.soft, marginTop: 2 }}>
              {eur2(brutto)} brutto · inkl. {doc.vatRate} % USt.
            </div>
          </div>
        </div>

        {doc.recurringLabel && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 14,
              paddingTop: 10,
              borderTop: `1px solid ${C.line}`,
              fontSize: 10.5,
              color: C.soft,
            }}
          >
            <span>{doc.recurringLabel}</span>
            <span style={{ fontWeight: 700, color: C.ink }}>{doc.recurringValue}</span>
          </div>
        )}

        {doc.optionalEnabled && (
          <div
            style={{
              marginTop: 20,
              border: `1px solid ${C.blue}44`,
              background: C.blueSoft,
              borderRadius: 10,
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 7.5, letterSpacing: "0.2em", color: C.blue, fontWeight: 700, marginBottom: 6 }}>
                {doc.optionalLabel}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{doc.optionalTitle}</div>
              <div style={{ fontSize: 9, color: C.soft, marginTop: 3 }}>{doc.optionalSubtitle}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>{doc.optionalPrice}</div>
          </div>
        )}

        {doc.footnotes.filter(Boolean).length > 0 && (
          <div style={{ marginTop: 18, fontSize: 8.5, color: C.soft, lineHeight: 1.7 }}>
            {doc.footnotes.filter(Boolean).map((f, i) => (
              <div key={i}>{f}</div>
            ))}
          </div>
        )}

        {doc.splitEnabled && (
          <div style={{ display: "flex", gap: 32, marginTop: 26, paddingTop: 20, borderTop: `1px solid ${C.line}` }}>
            {[
              [doc.splitLeftTitle, doc.splitLeftText],
              [doc.splitRightTitle, doc.splitRightText],
            ].map(([t, x], i) => (
              <div key={i} style={{ flex: 1 }}>
                <div style={{ fontSize: 7.5, letterSpacing: "0.2em", color: C.faint, fontWeight: 600, marginBottom: 10 }}>
                  {t}
                </div>
                <div style={{ fontSize: 9.5, color: C.soft, lineHeight: 1.7 }}>{x}</div>
              </div>
            ))}
          </div>
        )}

        <Foot doc={doc} page={1} total={total} />
      </Page>

      {/* ---------------- SEITE 2 ---------------- */}
      <Page>
        <Head doc={doc} page={2} />

        <SectionTitle n="02" title={doc.includedTitle} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 34, rowGap: 14 }}>
          {doc.included.filter(Boolean).map((it, i) => (
            <div key={i} style={{ display: "flex", gap: 10 }}>
              <span style={{ width: 5, height: 5, borderRadius: 5, background: C.blue, marginTop: 5, flexShrink: 0 }} />
              <span style={{ fontSize: 9.5, color: C.soft, lineHeight: 1.6 }}>{it}</span>
            </div>
          ))}
        </div>

        {doc.timelineEnabled && (
          <>
            <SectionTitle n="03" title={doc.timelineTitle} />
            <div>
              {doc.timeline.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    gap: 20,
                    padding: "10px 12px",
                    borderBottom: `1px solid ${C.line}`,
                    background: s.highlight ? C.blueSoft : "transparent",
                    borderRadius: s.highlight ? 8 : 0,
                  }}
                >
                  <div style={{ width: 92, fontSize: 9.5, fontWeight: 600, color: C.blue, flexShrink: 0 }}>{s.when}</div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{s.title}</div>
                    <div style={{ fontSize: 9, color: C.soft, marginTop: 3, lineHeight: 1.6 }}>{s.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <SectionTitle n={doc.timelineEnabled ? "04" : "03"} title={doc.paymentTitle} />

        <div style={{ display: "flex", gap: 20 }}>
          <div
            style={{
              flex: 1,
              border: `1px solid ${C.blue}33`,
              background: C.blueSoft,
              borderRadius: 12,
              padding: "18px 20px",
            }}
          >
            <div style={{ fontSize: 7.5, letterSpacing: "0.2em", color: C.faint, fontWeight: 600 }}>
              {doc.paymentPlanLabel}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, margin: "10px 0 14px" }}>{doc.paymentPlanTitle}</div>
            {doc.paymentRows.map((r) => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10.5 }}>{r.label}</div>
                  {r.sub && <div style={{ fontSize: 8.5, color: C.faint, marginTop: 2 }}>{r.sub}</div>}
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 700 }}>{r.amount}</div>
              </div>
            ))}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                borderTop: `1px solid ${C.blue}33`,
                paddingTop: 12,
                marginTop: 6,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600 }}>{doc.paymentTotalLabel}</span>
              <span style={{ fontSize: 17, fontWeight: 700 }}>{doc.paymentTotalValue}</span>
            </div>
            {doc.paymentFootnote && (
              <div style={{ fontSize: 8.5, color: C.soft, marginTop: 8 }}>{doc.paymentFootnote}</div>
            )}
          </div>

          <div style={{ flex: 1, border: `1px solid ${C.line}`, borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ fontSize: 7.5, letterSpacing: "0.2em", color: C.faint, fontWeight: 600 }}>
              {doc.conditionsLabel}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, margin: "10px 0 14px" }}>{doc.conditionsTitle}</div>
            {doc.conditions.map((c) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 10.5, color: C.soft }}>{c.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{c.value}</span>
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12, marginTop: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 11.5, fontWeight: 600 }}>{doc.validLabel}</span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{doc.validValue}</span>
              </div>
              {doc.validNote && (
                <div style={{ fontSize: 8.5, color: C.soft, marginTop: 8, lineHeight: 1.6 }}>{doc.validNote}</div>
              )}
            </div>
          </div>
        </div>

        {doc.notes && (
          <div style={{ marginTop: 26, fontSize: 8, color: C.soft, lineHeight: 1.75 }}>
            <span style={{ fontWeight: 700, color: C.ink }}>Hinweise. </span>
            {doc.notes}
          </div>
        )}

        <div
          style={{
            marginTop: "auto",
            paddingTop: 26,
            borderTop: `1px solid ${C.line}`,
            display: "flex",
            gap: 24,
            alignItems: "flex-start",
          }}
        >
          <img src={logo} alt="" style={{ height: 14, objectFit: "contain", opacity: 0.85, marginTop: 8 }} />
          {[
            ["UNTERNEHMEN", doc.footerCompany, doc.footerAddress],
            ["RECHTLICHES", doc.footerLegal1, doc.footerLegal2],
            ["KONTAKT", doc.footerContact1, doc.footerContact2],
          ].map(([t, a, b], i) => (
            <div key={i} style={{ flex: 1 }}>
              <div style={{ fontSize: 7, letterSpacing: "0.2em", color: C.faint, fontWeight: 600, marginBottom: 8 }}>{t}</div>
              <div style={{ fontSize: 9, fontWeight: 600 }}>{a}</div>
              <div style={{ fontSize: 9, color: C.soft, marginTop: 2 }}>{b}</div>
            </div>
          ))}
          <div style={{ fontSize: 7.5, letterSpacing: "0.18em", color: C.faint, fontWeight: 600, paddingTop: 8 }}>
            SEITE 2 / 2
          </div>
        </div>
      </Page>
    </div>
  );
}
