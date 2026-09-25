import { useState } from "react";
import { formatSize } from "../format";
import { CloseIcon, IconButton, StopIcon } from "../icons";
import { useCancelImport, useImportStatus } from "./queries";

/** Import progress for the main window's status bar. */
export function ImportProgressBar() {
  const status = useImportStatus().data;
  const cancel = useCancelImport();
  const [dismissed, setDismissed] = useState<string | null>(null);

  if (!status || dismissed === status.jobId) return <div className="import-progress" />;

  const percent = status.bytesTotal > 0 ? Math.round((status.bytesDone / status.bytesTotal) * 100) : 100;
  const counts = `${status.filesDone} / ${status.filesTotal} ファイル`;
  let text: string;
  switch (status.state) {
    case "running":
      text = `取り込み中 ${counts}（${percent}%）${status.currentFile ? ` ${status.currentFile}` : ""}`;
      break;
    case "completed":
      text = `取り込み完了: ${status.filesDone} ファイル（${formatSize(status.bytesDone)}）`;
      break;
    case "cancelled":
      text = `取り込みを中止しました（${counts}）`;
      break;
    case "failed":
      text = `取り込みに失敗しました: ${status.error ?? "不明なエラー"}`;
      break;
  }

  return (
    <div className="import-progress" role="status" aria-label="取り込みの状況" aria-live="polite">
      <progress
        max={100}
        value={percent}
        aria-label="取り込みの進行状況"
        className={`state-${status.state}`}
      />
      <span className="import-progress-text">{text}</span>
      {status.state === "running" ? (
        <IconButton
          label="取り込みを中止"
          icon={<StopIcon />}
          onClick={() => cancel.mutate(status.jobId)}
          disabled={cancel.isPending}
        />
      ) : (
        <IconButton label="表示を消す" icon={<CloseIcon />} onClick={() => setDismissed(status.jobId)} />
      )}
    </div>
  );
}
