"use client";

import type { TicketCategory } from "@prisma/client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type DraftReport = {
  step: 1 | 2 | 3;
  category: TicketCategory | null;
  title: string;
  description: string;
  locationText: string;
};

type DraftReportStore = DraftReport & {
  setDraft: (patch: Partial<DraftReport>) => void;
  clearDraft: () => void;
};

export const emptyDraft: DraftReport = {
  step: 1,
  category: null,
  title: "",
  description: "",
  locationText: "",
};

export const useDraftReportStore = create<DraftReportStore>()(
  persist(
    (set) => ({
      ...emptyDraft,
      setDraft: (patch) => set(patch),
      clearDraft: () => set(emptyDraft),
    }),
    {
      name: "vela-report-draft-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ step, category, title, description, locationText }) => ({
        step,
        category,
        title,
        description,
        locationText,
      }),
    },
  ),
);
