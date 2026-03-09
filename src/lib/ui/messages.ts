export const uiMessages = {
  common: {
    userFallback: "User",
    noOrganization: "No organization",
    loading: "Loading...",
    status: "Status",
    actions: "Actions",
    active: "Active",
    inactive: "Inactive",
  },
  topbar: {
    editProfile: "Edit profile",
    settings: "Settings",
    signOut: "Sign out",
  },
  users: {
    searchPlaceholder: "Search by email or name...",
    loadingUsers: "Loading users...",
  },
} as const;

export type AppMessageKey = `${keyof typeof uiMessages}.${string}`;
