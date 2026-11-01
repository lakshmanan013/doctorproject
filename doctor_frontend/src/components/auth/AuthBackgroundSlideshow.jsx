import { useState, useEffect, useRef } from "react";
import "./AuthBackgroundSlideshow.css";

// All 64 high-resolution images from C:\Users\laksh\OneDrive\Desktop\doctorcrm
const TOTAL_SLIDES = 64;
const SLIDE_INTERVAL_MS = 7000; // Changes every 7 seconds

const SLIDES = Array.from(
  { length: TOTAL_SLIDES },
  (_, idx) => `/doctorcrm/doctorcrm (${idx + 1}).png`
);

function AuthBackgroundSlideshow() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timerRef = useRef(null);

  // Preload upcoming images so transitions are seamless and sharp
  useEffect(() => {
    const nextIdx = (currentIndex + 1) % SLIDES.length;
    const afterNextIdx = (currentIndex + 2) % SLIDES.length;
    const img1 = new Image();
    img1.src = SLIDES[nextIdx];
    const img2 = new Image();
    img2.src = SLIDES[afterNextIdx];
  }, [currentIndex]);

  // 7-second slide loop
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setPrevIndex(currentIndex);
      setIsTransitioning(true);
      setCurrentIndex((prev) => (prev + 1) % SLIDES.length);

      const t = setTimeout(() => {
        setIsTransitioning(false);
        setPrevIndex(null);
      }, 1200); // Cross-fade duration
      return () => clearTimeout(t);
    }, SLIDE_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex]);

  return (
    <div className="auth-fullscreen-bg" aria-hidden="true">
      {/* Previous image fading out */}
      {prevIndex !== null && (
        <img
          key={`slide-prev-${prevIndex}`}
          src={SLIDES[prevIndex]}
          alt=""
          className="auth-fullscreen-img auth-slide-layer auth-slide-out"
        />
      )}

      {/* Current image fading in */}
      <img
        key={`slide-curr-${currentIndex}`}
        src={SLIDES[currentIndex]}
        alt=""
        className={`auth-fullscreen-img auth-slide-layer ${
          isTransitioning ? "auth-slide-in" : "auth-slide-active"
        }`}
      />

      {/* Crystal-clear clarity overlay */}
      <div className="auth-fullscreen-overlay" />
    </div>
  );
}

export { AuthBackgroundSlideshow };
export default AuthBackgroundSlideshow;
