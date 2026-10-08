import { useSyncExternalStore } from 'react';

// Whether the browser thinks it has a network connection.
//
// The browser fires "online" / "offline" events when this changes.
// useSyncExternalStore is React's tool for reading a value that lives
// outside React (here: navigator.onLine) and re-rendering when it changes.
//
// Note: "online" only means the device has a network. It does not prove our
// server is reachable, so a request can still fail while this is true.

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);

  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

const getSnapshot = () => navigator.onLine;

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
