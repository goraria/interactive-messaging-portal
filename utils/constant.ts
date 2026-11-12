import {
  Users,
  Home,
  LogIn,
  KeySquare,
  BadgeCheck,
  Bolt,
  Inbox,
  ArchiveX,
  Shield,
  AppWindow,
  Search,
  Bell,
  File,
  Info,
  SmilePlus,
} from "@gorth-io/primitive/cores/lucide"

export const appGlobal = {
  name: "GorCer",
  description: "Design by Japtor Gorthenburg",
  title: "GorCer",
  address: "208 Main St, Hai Bà Trưng, Hà Nội, Việt Nam",
  times: "06:00 - 22:00 (Hằng ngày)",
  opening: "06:00 - 22:00 (GMT+7) (Thứ Hai - Chủ Nhật)",
  phone: "(+84) 123 456 789",
  hotline: "(028) 1876 5439",
  email: "info@gorth.org",
  website: "www.gorth.org",
  currency: "VND",
  locales: "vi-VN",
  zalo: "https://zalo.me/0123456789",
  facebook: "https://www.facebook.com/gorth.org",
  instagram: "https://www.instagram.com/gorth.org",
  twitter: "https://www.twitter.com/gorth.org",
  youtube: "https://www.youtube.com/gorth.org",
  github: "https://www.github.com/gorth.org",
  twitch: "https://www.twitch.tv/gorth.org",
  copyright:
    "Copyright © &copy; 2020 - " +
    new Date().getFullYear() +
    " Gorth Inc. All rights reserved.",
  pro:
    "Bản quyền © Gorth Inc. 2020 - " +
    new Date().getFullYear() +
    " Bảo lưu mọi quyền.",
  copyleft:
    "Copyright © 2020 - " +
    new Date().getFullYear() +
    " Waddles Corp. Powered by Gorth Inc.",
  noob:
    "Bản quyền © Waddles Corp. 2020 - " +
    new Date().getFullYear() +
    " Cung cấp bởi Gorth Inc.",
}

export const visitor = {
  name: "Visitor",
  email: "visitor@gorth.org",
  avatar: "",
}

export interface ChatConversation {
  archived?: boolean
  id: string
  roomName: string
  url: string
  name: string
  avatar?: string | null
  email: string
  subject: string
  date: string
  teaser: string
  createdAt: string
  unread?: boolean
}

export const chatConversations: ChatConversation[] = []

export const messageSidebar = {
  user: visitor,
  brand: {
    name: appGlobal.name,
    logo: "/brand/sidebar.svg",
  },
  navMain: [
    { title: "Inbox", url: "#inbox", icon: Inbox, isActive: true },
    { title: "Groups", url: "#group", icon: Users },
    { title: "Archived", url: "#archived", icon: ArchiveX },
    { title: "Notifications", url: "/setting/notification", icon: Bolt },
    { title: "Plans", url: "/billing", icon: BadgeCheck },
  ],
  navDropdown: [
    {
      title: "Account",
      url: "/account",
      icon: BadgeCheck,
    },
    {
      title: "Settings",
      url: "/setting",
      icon: Bolt,
    },
  ],
  navSignal: [
    {
      title: "Sign In",
      url: "/sign-in",
      icon: LogIn,
    },
    {
      title: "Sign Up",
      url: "/sign-up",
      icon: KeySquare,
    },
  ],
  navMessage: chatConversations,
}

export const infoSidebar = {
  actions: [
    { label: "Members", icon: Users, view: "members" as const },
    { label: "Mute", icon: Bell, view: "settings" as const },
    { label: "Search", icon: Search, view: "search" as const },
  ],
  navMain: [
    {
      title: "Chat Info",
      url: "#",
      icon: Info,
      items: [{ title: "View pinned messages", url: "#todo-pinned" }],
    },
    {
      title: "Customise chat",
      url: "#",
      icon: SmilePlus,
      items: [
        { title: "Change theme", url: "#todo-theme" },
        { title: "Change emoji", url: "#todo-emoji" },
        { title: "Edit nicknames", url: "#todo-nicknames" },
      ],
    },
    {
      title: "Chat members",
      url: "#",
      icon: Users,
      groupOnly: true,
      items: [{ title: "View members", url: "#members" }],
    },
    {
      title: "Media, files and links",
      url: "#",
      icon: File,
      items: [
        { title: "Media", url: "#media" },
        { title: "Files", url: "#files" },
        { title: "Links", url: "#links" },
      ],
    },
  ],
  navSub: [
    {
      title: "Privacy & support",
      url: "#",
      icon: Shield,
      items: [
        { title: "Mute notifications", url: "#mute" },
        { title: "Message permissions", url: "#todo-permissions" },
        { title: "Disappearing Messages", url: "#todo-disappearing" },
        { title: "Read receipts", url: "#todo-receipts" },
        { title: "Verify end-to-end encryption", url: "#todo-encryption" },
        { title: "Restrict", url: "#todo-restrict" },
        { title: "Block", url: "#todo-block" },
        {
          title: "Report",
          url: "#todo-report",
          description: "Give feedback and report the conversation",
        },
      ],
    },
  ],
  navGroup: [
    {
      title: "Privacy & support",
      url: "#",
      icon: Shield,
      items: [
        { title: "Chat notifications", url: "#mute" },
        { title: "Read receipts", url: "#todo-receipts" },
        {
          title: "Report",
          url: "#todo-report",
          description: "Give feedback and report the conversation",
        },
        { title: "Leave group", url: "#todo-leave" },
      ],
    },
  ],
}

export const settingSidebar = {
  user: visitor,
  route: "/",
  role: "main",
  brand: { name: appGlobal.name, logo: "/brand/sidebar.svg" },
  navMain: [
    { title: "Chat", url: "/chat", icon: Inbox },
    { title: "Account", url: "/account", icon: BadgeCheck },
    { title: "Notification", url: "/setting/notification", icon: Bolt },
    { title: "Billing", url: "/billing", icon: AppWindow },
    { title: "Privacy", url: "/privacy", icon: Shield },
  ],
  navSecondary: [],
  projects: [],
  navDropdown: [
    { title: "Account", url: "/account", icon: BadgeCheck },
    { title: "Chat", url: "/chat", icon: Inbox },
  ],
  navSignal: [
    { title: "Sign In", url: "/sign-in", icon: LogIn },
    { title: "Sign Up", url: "/sign-up", icon: KeySquare },
  ],
}

export const sharedNavbar = {
  user: visitor,
  navMain: [
    {
      title: "Administrator",
      url: "/admin",
      icon: BadgeCheck,
      isActive: true,
    },
    {
      title: "Users",
      url: "/admin/user",
      icon: Users,
      isActive: true,
    },
    {
      title: "Applications",
      url: "/admin/app",
      icon: AppWindow,
      isActive: true,
    },
    {
      title: "Settings",
      url: "/setting",
      icon: Bolt,
      isActive: true,
    },
  ],
  navSecondary: [
    {
      title: "Home",
      url: "/",
      icon: Home,
      isActive: true,
    },
  ],
  navDropdown: [
    {
      title: "Account",
      url: "/account",
      icon: BadgeCheck,
    },
    {
      title: "Settings",
      url: "/setting",
      icon: Bolt,
    },
  ],
  navSignal: [
    {
      title: "Sign In",
      url: "/auth/sign-in",
      icon: LogIn,
    },
    {
      title: "Sign Up",
      url: "/auth/sign-up",
      icon: KeySquare,
    },
  ],
}
