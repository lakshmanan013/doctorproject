import React, { useState, useEffect, useRef } from "react";
import "./BillingHologramCoin.css";

/**
 * BillingHologramCoin
 * Interactive holographic pedestal illustration with the original 3D Gold Indian Rupee (₹) coin.
 * The money symbol rotates dynamically in 3D whenever the billing amount increases.
 */
export default function BillingHologramCoin({ amount = 0, size = 110 }) {
  const [isRotating, setIsRotating] = useState(false);
  const [increasedDiff, setIncreasedDiff] = useState(0);
  const [showSparkles, setShowSparkles] = useState(false);
  const prevAmountRef = useRef(amount);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevAmountRef.current = amount;
      if (amount > 0) {
        triggerSpin(0);
      }
      return;
    }

    if (amount > prevAmountRef.current) {
      const diff = amount - prevAmountRef.current;
      setIncreasedDiff(diff);
      triggerSpin(diff);
    }
    prevAmountRef.current = amount;
  }, [amount]);

  const triggerSpin = (diff = 0) => {
    setIsRotating(true);
    setShowSparkles(true);

    const timer = setTimeout(() => {
      setIsRotating(false);
    }, 2200);

    const sparkleTimer = setTimeout(() => {
      setShowSparkles(false);
      setIncreasedDiff(0);
    }, 2500);

    return () => {
      clearTimeout(timer);
      clearTimeout(sparkleTimer);
    };
  };

  const handleCoinClick = () => {
    if (!isRotating) {
      triggerSpin(0);
    }
  };

  return (
    <div 
      className={`hologram-billing-stage ${isRotating ? "stage-active" : ""}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      onClick={handleCoinClick}
      title="Click to spin or watch it rotate when billing increases"
    >
      {/* Light Projection Beams from Pedestal */}
      <div className="hologram-beam-container">
        <div className="hologram-light-cone"></div>
        <div className="hologram-particle p1"></div>
        <div className="hologram-particle p2"></div>
        <div className="hologram-particle p3"></div>
        <div className="hologram-particle p4"></div>
      </div>

      {/* Floating 3D Gold Money Symbol (Rupee) Alone */}
      <div className={`money-symbol-orbit ${isRotating ? "spinning-burst" : "idle-float"}`}>
        <div className="rupee-coin-3d">
          {/* Front Face */}
          <div className="coin-face coin-front">
            <div className="coin-inner-rim">
              <span className="rupee-glyph">₹</span>
              <div className="coin-shine-sweep"></div>
            </div>
          </div>
          {/* Back Face */}
          <div className="coin-face coin-back">
            <div className="coin-inner-rim">
              <span className="rupee-glyph">₹</span>
              <div className="coin-shine-sweep"></div>
            </div>
          </div>
        </div>

        {/* Floating Increase Indicator Badge */}
        {showSparkles && increasedDiff > 0 && (
          <div className="increase-indicator-float">
            +₹{increasedDiff.toLocaleString("en-IN")}
          </div>
        )}
      </div>

      {/* Burst Ripple Waves on Amount Increase */}
      {showSparkles && (
        <div className="coin-burst-waves">
          <div className="burst-ring ring-1"></div>
          <div className="burst-ring ring-2"></div>
          <div className="burst-ring ring-3"></div>
        </div>
      )}

      {/* Hologram Pedestal Base (Stationary) */}
      <div className="pedestal-base">
        <svg viewBox="0 0 120 40" className="pedestal-svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id="pedestal-gold-glow" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#D97706" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#78350F" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="ring-gold-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="35%" stopColor="#F59E0B" />
              <stop offset="70%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#FBBF24" />
            </linearGradient>
            <radialGradient id="platform-gold-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.55" />
              <stop offset="50%" stopColor="#D97706" stopOpacity="0.25" />
              <stop offset="85%" stopColor="#38BDF8" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Platform Glow Disk */}
          <ellipse cx="60" cy="22" rx="54" ry="14" fill="url(#platform-gold-glow)" />

          {/* Base bottom rim shadow */}
          <ellipse cx="60" cy="26" rx="44" ry="10" fill="#0F172A" fillOpacity="0.45" />

          {/* Lower pedestal disc */}
          <ellipse cx="60" cy="24" rx="42" ry="9" fill="#1E293B" stroke="#D97706" strokeWidth="1" strokeOpacity="0.6" />

          {/* Upper luminous pedestal disc */}
          <ellipse cx="60" cy="20" rx="36" ry="7.5" fill="#0F172A" stroke="url(#ring-gold-gradient)" strokeWidth="1.8" />

          {/* Inner crystal core */}
          <ellipse cx="60" cy="19.5" rx="26" ry="5.5" fill="#FBBF24" fillOpacity="0.4" />
          <ellipse cx="60" cy="19.5" rx="16" ry="3.5" fill="#FFFBEB" fillOpacity="0.8" />
        </svg>

        {/* Ambient base neon glow ring */}
        <div className="pedestal-neon-light"></div>
      </div>
    </div>
  );
}
