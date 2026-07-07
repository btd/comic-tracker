import { useRegisterSW } from 'virtual:pwa-register/react';

export default function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;
  return (
    <div className="pwa-toast" role="alert">
      <span>New version available.</span>
      <button className="toast-action" onClick={() => updateServiceWorker(true)}>Reload</button>
      <button className="toast-close" aria-label="Dismiss" onClick={() => setNeedRefresh(false)}>×</button>
    </div>
  );
}
