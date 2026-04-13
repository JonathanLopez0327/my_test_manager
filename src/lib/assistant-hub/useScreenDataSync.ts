"use client";

import { useEffect, useRef } from "react";
import { useAssistantHub } from "./AssistantHubContext";
import type { ScreenData } from "./types";

/**
 * Syncs screen data into the AssistantHub context so the AI assistant
 * knows what is currently visible on screen. Cleans up on unmount.
 */
export function useScreenDataSync(screenData: ScreenData | undefined) {
  const { actions } = useAssistantHub();
  const prevRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const serialized = JSON.stringify(screenData);
    if (serialized === prevRef.current) return;
    prevRef.current = serialized;
    actions.setScreenData(screenData);

    return () => {
      actions.setScreenData(undefined);
    };
  }, [screenData, actions]);
}
