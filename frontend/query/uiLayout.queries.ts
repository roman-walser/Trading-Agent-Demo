// frontend/query/uiLayout.queries.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchUiLayout,
  patchUiLayout,
  type UiLayoutPayloadDto,
  type UiLayoutStateDto
} from '../api/routes/uiLayout.api.js';
import {
  getUiLayoutSnapshot,
  hydrateUiLayoutFromSnapshot,
  restoreUiLayoutSnapshot,
  setPanelLayout
} from '../state/store.js';

const UI_LAYOUT_QUERY_KEY = ['ui-layout'];

type UiLayoutMutationContext = {
  previousSnapshot: UiLayoutStateDto;
};

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
  return useMutation<UiLayoutStateDto, Error, UiLayoutPayloadDto, UiLayoutMutationContext>({
    mutationFn: (payload: UiLayoutPayloadDto) => patchUiLayout(payload),
    onMutate: (payload) => {
      const previousSnapshot = getUiLayoutSnapshot();
      for (const [panelId, layout] of Object.entries(payload.panels)) {
        setPanelLayout(panelId, layout, false);
      }
      return { previousSnapshot };
    },
    onError: (_error, _payload, context) => {
      if (!context?.previousSnapshot) return;
      restoreUiLayoutSnapshot(context.previousSnapshot);
      client.setQueryData(UI_LAYOUT_QUERY_KEY, context.previousSnapshot);
    },
    onSuccess: (data) => {
      client.setQueryData(UI_LAYOUT_QUERY_KEY, data);
      hydrateUiLayoutFromSnapshot(data);
    }
  });
};
