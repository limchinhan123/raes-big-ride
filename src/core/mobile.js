// Keep touch laptops on the desktop path. `mobileqa=1` exists only so the
// mobile branch can be exercised from a desktop browser during local QA.
export function isMobileRuntime() {
  const ua = navigator.userAgent || '';
  return new URLSearchParams(location.search).has('mobileqa')
    || navigator.userAgentData?.mobile === true
    || /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
    || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}
