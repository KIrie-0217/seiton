import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelImport,
  getImportSettings,
  getImportStatus,
  setImportSettings,
  startImport,
  type ImportRequest,
  type ImportSettings,
} from "../api";

export const importQueryKeys = {
  settings: ["importSettings"] as const,
  status: ["importStatus"] as const,
};

export function useImportSettings() {
  return useQuery({ queryKey: importQueryKeys.settings, queryFn: getImportSettings, staleTime: Infinity });
}

/** Saves settings optimistically (the form updates immediately). */
export function useSaveImportSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (settings: ImportSettings) => setImportSettings(settings),
    onMutate: (settings) => {
      client.setQueryData(importQueryKeys.settings, settings);
    },
    onError: () => void client.invalidateQueries({ queryKey: importQueryKeys.settings }),
  });
}

/** Current / last job; kept up to date by `importProgress` messages. */
export function useImportStatus() {
  return useQuery({ queryKey: importQueryKeys.status, queryFn: getImportStatus, staleTime: Infinity });
}

export function useStartImport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: ImportRequest) => startImport(request),
    onSuccess: (progress) => client.setQueryData(importQueryKeys.status, progress),
  });
}

export function useCancelImport() {
  return useMutation({ mutationFn: (jobId: string) => cancelImport(jobId) });
}
