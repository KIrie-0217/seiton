import { ListBox, ListBoxItem, Text } from "react-aria-components";
import type { DeviceView } from "../api";
import { useI18n } from "../i18n";

interface DeviceListProps {
  devices: DeviceView[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

/** Connected cameras and cards; exactly one is selected. */
export function DeviceList({ devices, selectedId, onSelect }: DeviceListProps) {
  const { t } = useI18n();
  return (
    <ListBox
      className="device-list"
      aria-label={t.devices}
      items={devices}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={selectedId ? [selectedId] : []}
      onSelectionChange={(keys) => {
        const [first] = keys === "all" ? [] : [...keys];
        if (first !== undefined) onSelect(String(first));
      }}
      renderEmptyState={() => <p className="hint">{t.noDevices}</p>}
    >
      {(d) => (
        <ListBoxItem id={d.id} className="device-item" textValue={d.label}>
          <Text slot="label" className="device-label">
            {d.label}
          </Text>
          <Text slot="description" className="device-meta">
            {t.transport[d.transport]} · {d.profileName} · {t.shotCount(d.assetCount)}
          </Text>
        </ListBoxItem>
      )}
    </ListBox>
  );
}
