import React from "react";

export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  textLight: string;
  textDark: string;
}

export interface SlideData {
  id: string;
  text: string;
  body?: string;
  isCta?: boolean;
  headingSize?: number;
  bodySize?: number;
  textAlign?: "left" | "center" | "right";
}

export interface ThemeRenderProps {
  slide: SlideData;
  index: number;
  totalSlides: number;
  brandColors: BrandColors;
  fonts: { heading: string; body: string };
  avatarSrc: string | null;
  displayName: string;
  format: "1:1" | "4:5";
  slideW: number;
  slideH: number;
  isVisible: boolean;
}

// --- Helpers ---
const shrinkFont = (base: number, text: string, override?: number) => {
  if (override) return override;
  return text.length > 120 ? base * 0.65 : text.length > 80 ? base * 0.75 : text.length > 40 ? base * 0.85 : base;
};

const ProfileRow: React.FC<{
  avatarSrc: string | null;
  displayName: string;
  color: string;
  headingFont: string;
  accentColor: string;
}> = ({ avatarSrc, displayName, color, headingFont, accentColor }) => {
  if (!avatarSrc && !displayName) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {avatarSrc && (
        <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: `2px solid ${accentColor}33` }}>
          <img src={avatarSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
        </div>
      )}
      {displayName && (
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: headingFont }}>{displayName}</span>
          <svg viewBox="0 0 24 24" width="13" height="13" fill={accentColor}>
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
        </div>
      )}
    </div>
  );
};

const SlideCounter: React.FC<{ index: number; total: number; color: string; font: string }> = ({ index, total, color, font }) => (
  <div style={{
    position: "absolute" as const, bottom: 12, right: 16,
    fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
    color, opacity: 0.3, fontFamily: font,
  }}>
    {index + 1} / {total}
  </div>
);

const SwipeHint: React.FC<{ color: string; font: string }> = ({ color, font }) => (
  <span style={{ fontSize: 10, color, opacity: 0.4, fontFamily: font }}>swipe →</span>
);

// ============================================================
// THEME: NUMBERED (Roman Knox Style)
// ============================================================
export function renderNumbered(p: ThemeRenderProps): React.ReactElement {
  const { slide, index, totalSlides, brandColors, fonts, avatarSrc, displayName, slideW, slideH, isVisible } = p;
  const isCover = index === 0;
  const isCta = !!slide.isCta;

  const wrapper: React.CSSProperties = {
    width: slideW, height: slideH,
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
  };

  if (isCta) {
    return (
      <div key={slide.id} id={`carousel-slide-${index}`} style={{
        ...wrapper,
        background: brandColors.accent,
        justifyContent: "center",
        alignItems: "center",
        padding: 40,
      }}>
        <p style={{
          fontSize: shrinkFont(36, slide.text), fontWeight: 800,
          color: brandColors.textLight, fontFamily: fonts.heading,
          textAlign: "center", lineHeight: 1.3,
        }}>{slide.text}</p>
        <div style={{ marginTop: 20, padding: "10px 24px", borderRadius: 8, background: "rgba(255,255,255,0.15)" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: brandColors.textLight, fontFamily: fonts.heading }}>Jetzt speichern →</span>
        </div>
        <SlideCounter index={index} total={totalSlides} color={brandColors.textLight} font={fonts.body} />
      </div>
    );
  }

  if (isCover) {
    return (
      <div key={slide.id} id={`carousel-slide-${index}`} style={{
        ...wrapper,
        background: brandColors.textLight,
        backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.03) 1px, transparent 1px)",
        backgroundSize: "20px 20px",
        padding: 36,
        justifyContent: "center",
      }}>
        {/* Deko blob */}
        <div style={{
          position: "absolute", top: -30, right: -30,
          width: 120, height: 120,
          borderRadius: "60% 40% 50% 70% / 50% 60% 40% 50%",
          background: brandColors.accent, opacity: 0.12,
        }} />
        <div style={{ marginBottom: 12 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.15em",
            textTransform: "uppercase" as const, color: brandColors.accent,
            fontFamily: fonts.body,
          }}>GUIDE</span>
        </div>
        <ProfileRow avatarSrc={avatarSrc} displayName={displayName} color={brandColors.textDark} headingFont={fonts.heading} accentColor={brandColors.accent} />
        <p style={{
          fontSize: shrinkFont(44, slide.text), fontWeight: 800,
          color: brandColors.textDark, fontFamily: fonts.heading,
          lineHeight: 1.15, marginTop: 16,
        }}>{slide.text}</p>
        <SlideCounter index={index} total={totalSlides} color={brandColors.textDark} font={fonts.body} />
      </div>
    );
  }

  // Content slide
  return (
    <div key={slide.id} id={`carousel-slide-${index}`} style={{
      ...wrapper,
      background: brandColors.textLight,
      backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.03) 1px, transparent 1px)",
      backgroundSize: "20px 20px",
      padding: 36,
    }}>
      {/* Deko blob */}
      <div style={{
        position: "absolute", top: -20, right: -20,
        width: 90, height: 90,
        borderRadius: "60% 40% 50% 70% / 50% 60% 40% 50%",
        background: brandColors.accent, opacity: 0.08,
      }} />
      {/* Big number */}
      <span style={{
        fontSize: 72, fontWeight: 900, lineHeight: 1,
        color: brandColors.primary, opacity: 0.12,
        fontFamily: fonts.heading, position: "absolute", top: 20, right: 28,
      }}>{String(index).padStart(2, "0")}</span>
      {/* Small number circle */}
      <div style={{
        width: 34, height: 34, borderRadius: "50%",
        background: brandColors.accent + "18", display: "flex",
        alignItems: "center", justifyContent: "center", marginBottom: 16,
      }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: brandColors.accent, fontFamily: fonts.heading }}>{index}</span>
      </div>
      {/* Headline / body */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <p style={{
          fontSize: shrinkFont(26, slide.text), fontWeight: 700,
          color: brandColors.textDark, fontFamily: fonts.heading,
          lineHeight: 1.35, whiteSpace: "pre-wrap" as const,
        }}>{slide.text}</p>
        {slide.body && (
          <p style={{
            fontSize: 14, fontWeight: 400,
            color: brandColors.textDark, fontFamily: fonts.body,
            lineHeight: 1.5, whiteSpace: "pre-wrap" as const,
            marginTop: 12, opacity: 0.7,
          }}>{slide.body}</p>
        )}
      </div>
      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
        <ProfileRow avatarSrc={avatarSrc} displayName={displayName} color={brandColors.textDark} headingFont={fonts.heading} accentColor={brandColors.accent} />
        <SwipeHint color={brandColors.textDark} font={fonts.body} />
      </div>
      <SlideCounter index={index} total={totalSlides} color={brandColors.textDark} font={fonts.body} />
    </div>
  );
}

// ============================================================
// THEME: STEPS (Editorial)
// ============================================================
export function renderSteps(p: ThemeRenderProps): React.ReactElement {
  const { slide, index, totalSlides, brandColors, fonts, avatarSrc, displayName, slideW, slideH, isVisible } = p;
  const isCover = index === 0;
  const isCta = !!slide.isCta;
  const isEven = index % 2 === 0;
  const bgColor = isEven ? brandColors.primary : brandColors.textLight;
  const textColor = isEven ? brandColors.textLight : brandColors.textDark;

  const wrapper: React.CSSProperties = {
    width: slideW, height: slideH,
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
  };

  if (isCta) {
    return (
      <div key={slide.id} id={`carousel-slide-${index}`} style={{
        ...wrapper, background: brandColors.primary,
        justifyContent: "center", alignItems: "center", padding: 40,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.18em",
          textTransform: "uppercase" as const, color: brandColors.textLight,
          opacity: 0.6, fontFamily: fonts.body, marginBottom: 16,
        }}>WANT IN?</span>
        <p style={{
          fontSize: shrinkFont(36, slide.text), fontWeight: 800,
          color: brandColors.textLight, fontFamily: fonts.heading,
          textAlign: "center", lineHeight: 1.3, fontStyle: "italic",
        }}>{slide.text}</p>
        <div style={{ marginTop: 24, padding: "10px 28px", borderRadius: 40, background: "rgba(255,255,255,0.12)" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: brandColors.textLight, fontFamily: fonts.body, letterSpacing: "0.05em" }}>JETZT SPEICHERN</span>
        </div>
        {/* Deko circles */}
        <div style={{ position: "absolute", bottom: 30, right: 30, width: 60, height: 60, borderRadius: "50%", border: `2px solid ${brandColors.textLight}22` }} />
        <div style={{ position: "absolute", bottom: 20, right: 20, width: 80, height: 80, borderRadius: "50%", border: `1px solid ${brandColors.textLight}11` }} />
        <SlideCounter index={index} total={totalSlides} color={brandColors.textLight} font={fonts.body} />
      </div>
    );
  }

  if (isCover) {
    return (
      <div key={slide.id} id={`carousel-slide-${index}`} style={{
        ...wrapper, background: brandColors.primary, padding: 36,
        justifyContent: "center",
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.18em",
          textTransform: "uppercase" as const, color: brandColors.textLight,
          opacity: 0.5, fontFamily: fonts.body, marginBottom: 12,
        }}>A QUICK GUIDE</span>
        <ProfileRow avatarSrc={avatarSrc} displayName={displayName} color={brandColors.textLight} headingFont={fonts.heading} accentColor={brandColors.accent} />
        <p style={{
          fontSize: shrinkFont(42, slide.text), fontWeight: 700,
          color: brandColors.textLight, fontFamily: fonts.heading,
          lineHeight: 1.2, fontStyle: "italic", marginTop: 16,
        }}>{slide.text}</p>
        <p style={{
          fontSize: 14, color: brandColors.textLight, opacity: 0.5,
          fontFamily: fonts.body, marginTop: 12,
        }}>Swipe für die Schritte →</p>
        {/* Deko circles */}
        <div style={{ position: "absolute", bottom: 40, right: 30, width: 50, height: 50, borderRadius: "50%", border: `2px solid ${brandColors.textLight}20` }} />
        <div style={{ position: "absolute", bottom: 25, right: 15, width: 80, height: 80, borderRadius: "50%", border: `1px solid ${brandColors.textLight}10` }} />
        <SlideCounter index={index} total={totalSlides} color={brandColors.textLight} font={fonts.body} />
      </div>
    );
  }

  // Content
  return (
    <div key={slide.id} id={`carousel-slide-${index}`} style={{
      ...wrapper, background: bgColor, padding: 36,
    }}>
      {/* Big number watermark */}
      <span style={{
        position: "absolute", top: 16, right: 24,
        fontSize: 100, fontWeight: 900, lineHeight: 1,
        color: textColor, opacity: 0.06, fontFamily: fonts.heading,
      }}>{String(index).padStart(2, "0")}</span>
      {/* Step label */}
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: "0.18em",
        textTransform: "uppercase" as const, color: textColor,
        opacity: 0.5, fontFamily: fonts.body,
      }}>STEP {String(index).padStart(2, "0")}</span>
      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", marginTop: 16 }}>
        <p style={{
          fontSize: shrinkFont(32, slide.text), fontWeight: 700,
          color: textColor, fontFamily: fonts.heading,
          lineHeight: 1.3, fontStyle: "italic",
          whiteSpace: "pre-wrap" as const,
        }}>{slide.text}</p>
        {slide.body && (
          <p style={{
            fontSize: 14, fontWeight: 400,
            color: textColor, fontFamily: fonts.body,
            lineHeight: 1.5, whiteSpace: "pre-wrap" as const,
            marginTop: 12, opacity: 0.6, fontStyle: "normal",
          }}>{slide.body}</p>
        )}
      </div>
      {/* Deko circles */}
      <div style={{ position: "absolute", bottom: 30, right: 30, width: 40, height: 40, borderRadius: "50%", border: `2px solid ${textColor}20` }} />
      <div style={{ position: "absolute", bottom: 20, right: 20, width: 60, height: 60, borderRadius: "50%", border: `1px solid ${textColor}10` }} />
      <SlideCounter index={index} total={totalSlides} color={textColor} font={fonts.body} />
    </div>
  );
}

// ============================================================
// THEME: MINIMAL
// ============================================================
export function renderMinimal(p: ThemeRenderProps): React.ReactElement {
  const { slide, index, totalSlides, brandColors, fonts, slideW, slideH, isVisible } = p;
  const isCta = !!slide.isCta;

  const wrapper: React.CSSProperties = {
    width: slideW, height: slideH,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
    padding: 48,
  };

  if (isCta) {
    return (
      <div key={slide.id} id={`carousel-slide-${index}`} style={{
        ...wrapper, background: brandColors.primary,
      }}>
        <div style={{ width: 40, height: 2, background: brandColors.accent, borderRadius: 1, marginBottom: 24 }} />
        <p style={{
          fontSize: shrinkFont(34, slide.text), fontWeight: 700,
          color: brandColors.textLight, fontFamily: fonts.heading,
          textAlign: "center", lineHeight: 1.35,
        }}>{slide.text}</p>
        <SlideCounter index={index} total={totalSlides} color={brandColors.textLight} font={fonts.body} />
      </div>
    );
  }

  return (
    <div key={slide.id} id={`carousel-slide-${index}`} style={{
      ...wrapper, background: "#ffffff",
    }}>
      <div style={{ width: 50, height: 2, background: brandColors.accent, borderRadius: 1, marginBottom: 28, opacity: 0.6 }} />
      <p style={{
        fontSize: shrinkFont(index === 0 ? 38 : 32, slide.text),
        fontWeight: index === 0 ? 800 : 500,
        color: brandColors.textDark, fontFamily: fonts.heading,
        textAlign: "center", lineHeight: 1.4,
        whiteSpace: "pre-wrap" as const,
      }}>{slide.text}</p>
      {slide.body && (
        <p style={{
          fontSize: 13, fontWeight: 400,
          color: brandColors.textDark, fontFamily: fonts.body,
          textAlign: "center", lineHeight: 1.5,
          whiteSpace: "pre-wrap" as const,
          marginTop: 12, opacity: 0.6,
        }}>{slide.body}</p>
      )}
      <div style={{ width: 50, height: 2, background: brandColors.accent, borderRadius: 1, marginTop: 28, opacity: 0.6 }} />
      <SlideCounter index={index} total={totalSlides} color={brandColors.textDark} font={fonts.body} />
    </div>
  );
}

// ============================================================
// THEME: DARK
// ============================================================
export function renderDark(p: ThemeRenderProps): React.ReactElement {
  const { slide, index, totalSlides, brandColors, fonts, avatarSrc, displayName, slideW, slideH, isVisible } = p;
  const isCover = index === 0;
  const isCta = !!slide.isCta;

  const wrapper: React.CSSProperties = {
    width: slideW, height: slideH,
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
    background: `radial-gradient(ellipse at 30% 20%, ${brandColors.accent}22, transparent 60%), linear-gradient(145deg, ${brandColors.primary}, ${brandColors.secondary})`,
  };

  if (isCta) {
    return (
      <div key={slide.id} id={`carousel-slide-${index}`} style={{
        ...wrapper, justifyContent: "center", alignItems: "center", padding: 40,
      }}>
        {/* Glow */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          width: 200, height: 200, borderRadius: "50%",
          background: brandColors.accent, opacity: 0.08,
          transform: "translate(-50%, -50%)",
        }} />
        <div style={{ width: 40, height: 3, background: brandColors.accent, borderRadius: 2, marginBottom: 20 }} />
        <p style={{
          fontSize: shrinkFont(34, slide.text), fontWeight: 800,
          color: brandColors.textLight, fontFamily: fonts.heading,
          textAlign: "center", lineHeight: 1.3, position: "relative",
        }}>{slide.text}</p>
        <div style={{ marginTop: 24, padding: "10px 28px", borderRadius: 8, background: brandColors.accent + "33" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: brandColors.textLight, fontFamily: fonts.heading }}>Speichern →</span>
        </div>
        <SlideCounter index={index} total={totalSlides} color={brandColors.textLight} font={fonts.body} />
      </div>
    );
  }

  if (isCover) {
    return (
      <div key={slide.id} id={`carousel-slide-${index}`} style={{
        ...wrapper, padding: 36, justifyContent: "center",
      }}>
        {/* Glow circle */}
        <div style={{
          position: "absolute", top: -40, right: -40,
          width: 160, height: 160, borderRadius: "50%",
          background: brandColors.accent, opacity: 0.08,
        }} />
        <ProfileRow avatarSrc={avatarSrc} displayName={displayName} color={brandColors.textLight} headingFont={fonts.heading} accentColor={brandColors.accent} />
        <div style={{ width: 40, height: 3, background: brandColors.accent, borderRadius: 2, margin: "16px 0" }} />
        <p style={{
          fontSize: shrinkFont(44, slide.text), fontWeight: 800,
          color: brandColors.textLight, fontFamily: fonts.heading,
          lineHeight: 1.15,
        }}>{slide.text}</p>
        <SlideCounter index={index} total={totalSlides} color={brandColors.textLight} font={fonts.body} />
      </div>
    );
  }

  // Content
  return (
    <div key={slide.id} id={`carousel-slide-${index}`} style={{
      ...wrapper, padding: 36,
    }}>
      {/* Subtle glow */}
      <div style={{
        position: "absolute", bottom: -30, left: -30,
        width: 120, height: 120, borderRadius: "50%",
        background: brandColors.accent, opacity: 0.06,
      }} />
      <div style={{ width: 30, height: 3, background: brandColors.accent, borderRadius: 2, marginBottom: 16, opacity: 0.7 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <p style={{
          fontSize: shrinkFont(28, slide.text), fontWeight: 600,
          color: brandColors.textLight, fontFamily: fonts.heading,
          lineHeight: 1.4, whiteSpace: "pre-wrap" as const,
        }}>{slide.text}</p>
        {slide.body && (
          <p style={{
            fontSize: 14, fontWeight: 400,
            color: brandColors.textLight, fontFamily: fonts.body,
            lineHeight: 1.5, whiteSpace: "pre-wrap" as const,
            marginTop: 12, opacity: 0.5,
          }}>{slide.body}</p>
        )}
      </div>
      <SlideCounter index={index} total={totalSlides} color={brandColors.textLight} font={fonts.body} />
    </div>
  );
}

// ============================================================
// THEME: GRADIENT
// ============================================================
export function renderGradient(p: ThemeRenderProps): React.ReactElement {
  const { slide, index, totalSlides, brandColors, fonts, avatarSrc, displayName, slideW, slideH, isVisible } = p;
  const isCover = index === 0;
  const isCta = !!slide.isCta;

  const wrapper: React.CSSProperties = {
    width: slideW, height: slideH,
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
    background: `linear-gradient(135deg, ${brandColors.primary}, ${brandColors.secondary}, ${brandColors.accent})`,
  };

  if (isCta) {
    return (
      <div key={slide.id} id={`carousel-slide-${index}`} style={{
        ...wrapper, justifyContent: "center", alignItems: "center", padding: 40,
        background: brandColors.accent,
      }}>
        <p style={{
          fontSize: shrinkFont(36, slide.text), fontWeight: 800,
          color: brandColors.textLight, fontFamily: fonts.heading,
          textAlign: "center", lineHeight: 1.3,
        }}>{slide.text}</p>
        <div style={{ marginTop: 24, padding: "10px 28px", borderRadius: 40, background: "rgba(255,255,255,0.15)" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: brandColors.textLight, fontFamily: fonts.body }}>SPEICHERN</span>
        </div>
        <SlideCounter index={index} total={totalSlides} color={brandColors.textLight} font={fonts.body} />
      </div>
    );
  }

  if (isCover) {
    return (
      <div key={slide.id} id={`carousel-slide-${index}`} style={{
        ...wrapper, padding: 36, justifyContent: "center",
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.15em",
          textTransform: "uppercase" as const, color: brandColors.textLight,
          opacity: 0.6, fontFamily: fonts.body, marginBottom: 12,
        }}>GUIDE</span>
        <ProfileRow avatarSrc={avatarSrc} displayName={displayName} color={brandColors.textLight} headingFont={fonts.heading} accentColor="rgba(255,255,255,0.5)" />
        <p style={{
          fontSize: shrinkFont(42, slide.text), fontWeight: 800,
          color: brandColors.textLight, fontFamily: fonts.heading,
          lineHeight: 1.2, marginTop: 16,
        }}>{slide.text}</p>
        <SlideCounter index={index} total={totalSlides} color={brandColors.textLight} font={fonts.body} />
      </div>
    );
  }

  // Content
  return (
    <div key={slide.id} id={`carousel-slide-${index}`} style={{
      ...wrapper, padding: 40, justifyContent: "center", alignItems: "center",
    }}>
      <p style={{
        fontSize: shrinkFont(30, slide.text), fontWeight: 600,
        color: brandColors.textLight, fontFamily: fonts.heading,
        lineHeight: 1.4, textAlign: "center",
        whiteSpace: "pre-wrap" as const,
      }}>{slide.text}</p>
      {slide.body && (
        <p style={{
          fontSize: 14, fontWeight: 400,
          color: brandColors.textLight, fontFamily: fonts.body,
          textAlign: "center", lineHeight: 1.5,
          whiteSpace: "pre-wrap" as const,
          marginTop: 12, opacity: 0.5,
        }}>{slide.body}</p>
      )}
      <SlideCounter index={index} total={totalSlides} color={brandColors.textLight} font={fonts.body} />
    </div>
  );
}

// ============================================================
// THEME: CARD
// ============================================================
export function renderCard(p: ThemeRenderProps): React.ReactElement {
  const { slide, index, totalSlides, brandColors, fonts, avatarSrc, displayName, slideW, slideH, isVisible } = p;
  const isCover = index === 0;
  const isCta = !!slide.isCta;

  const wrapper: React.CSSProperties = {
    width: slideW, height: slideH,
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
    background: brandColors.primary,
    padding: 24,
  };

  const card: React.CSSProperties = {
    background: "#ffffff",
    borderRadius: 16,
    padding: 32,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    position: "relative",
    boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
  };

  if (isCta) {
    return (
      <div key={slide.id} id={`carousel-slide-${index}`} style={wrapper}>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase" as const, color: brandColors.textLight,
          opacity: 0.5, fontFamily: fonts.body, marginBottom: 12,
        }}>ZUSAMMENFASSUNG</span>
        <div style={{ ...card, border: `2px solid ${brandColors.accent}` }}>
          <p style={{
            fontSize: shrinkFont(28, slide.text), fontWeight: 700,
            color: brandColors.textDark, fontFamily: fonts.heading,
            textAlign: "center", lineHeight: 1.35,
          }}>{slide.text}</p>
          <div style={{ width: 40, height: 3, background: brandColors.accent, borderRadius: 2, margin: "16px auto 0" }} />
        </div>
        <SlideCounter index={index} total={totalSlides} color={brandColors.textLight} font={fonts.body} />
      </div>
    );
  }

  if (isCover) {
    return (
      <div key={slide.id} id={`carousel-slide-${index}`} style={wrapper}>
        <div style={{ marginBottom: 12 }}>
          <ProfileRow avatarSrc={avatarSrc} displayName={displayName} color={brandColors.textLight} headingFont={fonts.heading} accentColor={brandColors.accent} />
        </div>
        <div style={card}>
          <p style={{
            fontSize: shrinkFont(36, slide.text), fontWeight: 800,
            color: brandColors.textDark, fontFamily: fonts.heading,
            lineHeight: 1.2,
          }}>{slide.text}</p>
          <div style={{ width: 40, height: 3, background: brandColors.accent, borderRadius: 2, marginTop: 16 }} />
        </div>
        <SlideCounter index={index} total={totalSlides} color={brandColors.textLight} font={fonts.body} />
      </div>
    );
  }

  // Content
  return (
    <div key={slide.id} id={`carousel-slide-${index}`} style={wrapper}>
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
        textTransform: "uppercase" as const, color: brandColors.textLight,
        opacity: 0.5, fontFamily: fonts.body, marginBottom: 12,
      }}>{String(index).padStart(2, "0")}</span>
      <div style={card}>
        <p style={{
          fontSize: shrinkFont(24, slide.text), fontWeight: 500,
          color: brandColors.textDark, fontFamily: fonts.heading,
          lineHeight: 1.45, whiteSpace: "pre-wrap" as const,
        }}>{slide.text}</p>
        {slide.body && (
          <p style={{
            fontSize: 13, fontWeight: 400,
            color: brandColors.textDark, fontFamily: fonts.body,
            lineHeight: 1.5, whiteSpace: "pre-wrap" as const,
            marginTop: 10, opacity: 0.6,
          }}>{slide.body}</p>
        )}
        <div style={{ width: 30, height: 2, background: brandColors.accent, borderRadius: 1, marginTop: 14, opacity: 0.6 }} />
      </div>
      <SlideCounter index={index} total={totalSlides} color={brandColors.textLight} font={fonts.body} />
    </div>
  );
}

// ============================================================
// DISPATCHER
// ============================================================
export type ThemeId = "numbered" | "steps" | "minimal" | "dark" | "gradient" | "card";

const renderers: Record<ThemeId, (p: ThemeRenderProps) => React.ReactElement> = {
  numbered: renderNumbered,
  steps: renderSteps,
  minimal: renderMinimal,
  dark: renderDark,
  gradient: renderGradient,
  card: renderCard,
};

export function renderThemedSlide(theme: ThemeId, props: Omit<ThemeRenderProps, never>): React.ReactElement {
  return renderers[theme](props);
}
