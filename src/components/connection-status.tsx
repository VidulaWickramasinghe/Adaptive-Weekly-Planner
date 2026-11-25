"use client";
import { useEffect, useState } from "react";
export function ConnectionStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return !online ? (
    <p role="status" className="error">
      You’re offline. Changes are not queued. Reconnect, reload the latest
      records, and retry any failed save.
    </p>
  ) : null;
}
