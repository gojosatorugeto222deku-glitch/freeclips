export const MOBILE_WARNING_BYTES = 60 * 1024 * 1024; // 60 MB

/**
 * Detects mobile/tablet browsers (Android, iPhone, iPad) safely on client only.
 */
export function isMobileBrowser(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const navWithUAData = navigator as Navigator & {
    userAgentData?: { mobile?: boolean };
  };
  if (typeof navWithUAData.userAgentData?.mobile === "boolean") {
    if (navWithUAData.userAgentData.mobile) return true;
  }

  const ua = navigator.userAgent || "";
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }

  // Catch iPadOS Safari reporting desktop MacIntel UA with touch points
  return navigator.maxTouchPoints > 1 && window.innerWidth <= 1024;
}

export function formatFileSizeMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}
