import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getThumbnail, listAssets, listDevices, setRating, type AssetView, type RatingUpdate } from "../api";

export const queryKeys = {
  devices: ["devices"] as const,
  assets: (deviceId: string) => ["assets", deviceId] as const,
  thumbnail: (assetId: string) => ["thumbnail", assetId] as const,
};

export function useDevices() {
  return useQuery({ queryKey: queryKeys.devices, queryFn: listDevices });
}

export function useAssets(deviceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.assets(deviceId ?? ""),
    queryFn: () => listAssets(deviceId!),
    enabled: deviceId !== undefined,
  });
}

/** Thumbnails do not change while the device is connected, so keep them. */
export function useThumbnail(assetId: string) {
  return useQuery({
    queryKey: queryKeys.thumbnail(assetId),
    queryFn: () => getThumbnail(assetId),
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
  });
}

/** Sets ratings and merges the returned assets into the cached list. */
export function useSetRating(deviceId: string | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (update: RatingUpdate) => setRating(update),
    onSuccess: (updated) => {
      if (deviceId === undefined) return;
      const byId = new Map(updated.map((a) => [a.id, a]));
      client.setQueryData<AssetView[]>(queryKeys.assets(deviceId), (old) =>
        old?.map((a) => byId.get(a.id) ?? a),
      );
    },
  });
}
