import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { useWorkerI18n } from "../i18n";

export default function OfflineSyncStatus({ syncState, onFlushQueue }) {
  const { t } = useWorkerI18n();
  const pending = syncState?.pending || 0;
  const isOnline = syncState?.isOnline !== false;
  const syncing = Boolean(syncState?.syncing);

  if (isOnline && pending === 0 && !syncing) {
    return null;
  }

  return (
    <div className={`worker-sync-strip ${isOnline ? "is-online" : "is-offline"}`}>
      <div className="worker-sync-copy">
        {isOnline ? <Wifi size={17} aria-hidden="true" /> : <CloudOff size={17} aria-hidden="true" />}
        <span>
          {syncing
            ? t("sync.syncing")
            : isOnline
            ? t("sync.pending", { count: pending })
            : t("sync.offline", { count: pending })}
        </span>
      </div>
      {isOnline && pending > 0 ? (
        <button type="button" className="worker-sync-btn" onClick={onFlushQueue} disabled={syncing}>
          <RefreshCw size={15} aria-hidden="true" />
          <span>{t("sync.retry")}</span>
        </button>
      ) : null}
    </div>
  );
}
