import { DetailPanel } from "./DetailPanel";
import { useLibrary } from "./useLibrary";

/** Large preview and details of the shared selection. */
export function PreviewPane() {
  const lib = useLibrary();
  return (
    <div className="pane-body preview-pane">
      <DetailPanel selected={lib.targets} onRate={(r) => lib.setRating(r)} saving={lib.rate.isPending} />
    </div>
  );
}
