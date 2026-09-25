import { useState } from "react";
import { ProgressBar } from "react-aria-components";
import { IconButton } from "../controls";
import { formatSize } from "../format";
import { useI18n } from "../i18n";
import { CloseIcon, StopIcon } from "../icons";
import { useLibrary } from "../library/useLibrary";
import { useCancelImport, useImportSettings, useImportStatus } from "./queries";

/** Import progress for the main window's status bar. */
export function ImportProgressBar() {
  const { t } = useI18n();
  const status = useImportStatus().data;
  const cancel = useCancelImport();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const lib = useLibrary();
  const destination = useImportSettings().data?.destinationRoot;

  if (!status || dismissed === status.jobId) {
    // Idle: what is on the device and where it would go.
    return (
      <div className="import-progress">
        {lib.device && (
          <p className="idle-summary">
            <span>{t.idleSummary(lib.all.length, lib.device.label)}</span>
            <span aria-hidden="true">→</span>
            {destination ? <code>{destination}</code> : <span>{t.noDestinationYet}</span>}
          </p>
        )}
      </div>
    );
  }

  const percent = status.bytesTotal > 0 ? Math.round((status.bytesDone / status.bytesTotal) * 100) : 100;
  let text: string;
  switch (status.state) {
    case "running":
      text = t.progressRunning(status.filesDone, status.filesTotal, percent);
      break;
    case "completed":
      text = t.progressCompleted(status.filesDone, formatSize(status.bytesDone));
      break;
    case "cancelled":
      text = t.progressCancelled(status.filesDone, status.filesTotal);
      break;
    case "failed":
      text = t.progressFailed(status.error ?? t.unknownError);
      break;
  }

  return (
    <div className="import-progress" role="status" aria-label={t.importStatus} aria-live="polite">
      <ProgressBar className="progress" data-state={status.state} value={percent} aria-label={t.importProgress}>
        {({ percentage }) => (
          <div className="progress-track">
            <div className="progress-fill" style={{ transform: `scaleX(${(percentage ?? 0) / 100})` }} />
          </div>
        )}
      </ProgressBar>
      <span className="import-progress-text">{text}</span>
      {status.state === "running" && status.currentFile && (
        <span className="import-progress-file">{status.currentFile}</span>
      )}
      {status.state === "running" ? (
        <IconButton
          label={t.cancelImport}
          icon={<StopIcon />}
          onPress={() => cancel.mutate(status.jobId)}
          isDisabled={cancel.isPending}
        />
      ) : (
        <IconButton label={t.dismiss} icon={<CloseIcon />} onPress={() => setDismissed(status.jobId)} />
      )}
    </div>
  );
}
