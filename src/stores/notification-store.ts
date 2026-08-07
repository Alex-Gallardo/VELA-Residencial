import { create } from "zustand";

type NotificationState = {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
};

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  incrementUnread: () =>
    set((state) => ({ unreadCount: state.unreadCount + 1 })),
}));
