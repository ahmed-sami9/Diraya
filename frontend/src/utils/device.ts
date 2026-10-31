// The parts of `navigator` this reads, so tests can pass a fake one.
type NavigatorLike = {
  userAgent: string;
  maxTouchPoints: number;
  userAgentData?: { mobile: boolean };
};

// Phone or tablet? Decides which WhatsApp a link opens: the app, or WhatsApp Web.
//
// No check is perfect, so: the browser's own answer (Chrome, Edge), then the
// user agent, which also catches tablets that answer "not mobile". iPads claim
// to be a Mac, but a Mac has no touch screen.
export function isMobileDevice(nav: NavigatorLike = navigator as NavigatorLike): boolean {
  if (nav.userAgentData?.mobile) return true;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent)) return true;

  return /Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1;
}
