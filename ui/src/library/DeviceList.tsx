import type { DeviceView, TransportView } from "../api";

const TRANSPORT_LABEL: Record<TransportView, string> = {
  mtp: "USB 接続",
  massStorage: "SD カード",
  vendor: "メーカー SDK",
};

interface DeviceListProps {
  devices: DeviceView[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

export function DeviceList({ devices, selectedId, onSelect }: DeviceListProps) {
  if (devices.length === 0) {
    return <p>カメラまたは SD カードを接続してください。</p>;
  }
  return (
    <nav aria-label="デバイス">
      <ul className="device-list">
        {devices.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              aria-current={d.id === selectedId ? "true" : undefined}
              className={d.id === selectedId ? "current" : undefined}
              onClick={() => onSelect(d.id)}
            >
              <span className="device-label">{d.label}</span>
              <span className="device-meta">
                {TRANSPORT_LABEL[d.transport]} · {d.profileName} · {d.assetCount} 件
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
