import { useState, useEffect } from "react";

export function useBreakpoint() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const isMobile = width < 640;

  return {
    isMobile,
    cols2: isMobile ? "1fr" : "1fr 1fr",
    cols3: isMobile ? "1fr" : "1fr 1fr 1fr",
    colsAuto: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(220px, 1fr))",
    gap: isMobile ? 10 : 18,
    gap2: isMobile ? 8 : 14,
  };
}
