// frontend/query/uiLayout.queries.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchUiLayout,
  patchUiLayout,
  type UiLayoutPayloadDto,
  type UiLayoutStateDto
} from '../api/routes/uiLayout.api.js';
import { hydrateUiLayoutFromSnapshot } from '../state/store.js';

const UI_LAYOUT_QUERY_KEY = ['ui-layout'];

export const useUiLayoutQuery = (enabled = true, initialData?: UiLayoutStateDto) =>
  useQuery<UiLayoutStateDto>({
    queryKey: UI_LAYOUT_QUERY_KEY,
    queryFn: fetchUiLayout,
    refetchOnWindowFocus: false,
    retry: false,
    enabled,
    initialData,
    onSuccess: (snapshot) => {
      hydrateUiLayoutFromSnapshot(snapshot);
    }
  });

export const usePatchUiLayout = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: UiLayoutPayloadDto) => patchUiLayout(payload),
    onSuccess: (data) => {
      client.setQueryData(UI_LAYOUT_QUERY_KEY, data);
      hydrateUiLayoutFromSnapshot(data);
    }
  });
};
