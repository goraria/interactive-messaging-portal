import {
  Users,
  SquareUser,
  Home,
  LifeBuoy,
  Send,
  History,
  ListVideo,
  Clock,
  ThumbsUp,
  Download,
  Music,
  Rocket,
  Newspaper,
  SportShoe,
  LogIn,
  KeySquare,
  BadgeCheck,
  Bolt,
  Inbox,
  ArchiveX,
  Trash2,
  FileText,
  Bell,
  BellOff,
  CircleMinus,
  Eye,
  File,
  Image,
  Lock,
  MessageCircleOff,
  Pin,
  Search,
  Shield,
  SmilePlus,
  TriangleAlert,
  UserCircle,
  LucideIcon,
  Info,
  AppWindow,
} from "@gorth/primitive/cores/lucide"

export const appGlobal = {
  name: "Interactive Messaging Portal",
  description: "Design by Japtor Gorthenburg",
  title: "Gorth - Interactive Messaging Portal",
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
  copyright: "Copyright © &copy; 2020 - " + new Date().getFullYear() + " Gorth Inc. All rights reserved.",
  pro: "Bản quyền © Gorth Inc. 2020 - " + (new Date().getFullYear()) + " Bảo lưu mọi quyền.",
  copyleft: "Copyright © 2020 - " + new Date().getFullYear() + " Waddles Corp. Powered by Gorth Inc.",
  noob: "Bản quyền © Waddles Corp. 2020 - " + new Date().getFullYear() + " Cung cấp bởi Gorth Inc.",
}

export const visitor = {
  name: "Visitor",
  email: "visitor@gorth.org",
  avatar: "",
}

export interface ChatConversation {
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

export const chatConversations: ChatConversation[] = [
  {
    id: "william-smith",
    roomName: "william-smith",
    url: "/chat/william-smith",
    name: "William Smith",
    email: "williamsmith@example.com",
    subject: "Meeting Tomorrow",
    date: "09:34 AM",
    teaser:
      "Hi team, just a reminder about our meeting tomorrow at 10 AM.\nPlease come prepared with your project updates.",
    createdAt: "2026-07-11T02:34:00.000Z",
  },
  {
    id: "alice-smith",
    roomName: "alice-smith",
    url: "/chat/alice-smith",
    name: "Alice Smith",
    email: "alicesmith@example.com",
    subject: "Re: Project Update",
    date: "Yesterday",
    teaser:
      "Thanks for the update. The progress looks great so far.\nLet's schedule a call to discuss the next steps.",
    createdAt: "2026-07-10T11:00:00.000Z",
  },
  {
    id: "bob-johnson",
    roomName: "bob-johnson",
    url: "/chat/bob-johnson",
    name: "Bob Johnson",
    email: "bobjohnson@example.com",
    subject: "Weekend Plans",
    date: "2 days ago",
    teaser:
      "Hey everyone! I'm thinking of organizing a team outing this weekend.\nWould you be interested in a hiking trip or a beach day?",
    createdAt: "2026-07-09T08:20:00.000Z",
  },
  {
    id: "emily-davis",
    roomName: "emily-davis",
    url: "/chat/emily-davis",
    name: "Emily Davis",
    email: "emilydavis@example.com",
    subject: "Re: Question about Budget",
    date: "2 days ago",
    teaser:
      "I've reviewed the budget numbers you sent over.\nCan we set up a quick call to discuss some potential adjustments?",
    createdAt: "2026-07-09T03:10:00.000Z",
  },
  {
    id: "michael-wilson",
    roomName: "michael-wilson",
    url: "/chat/michael-wilson",
    name: "Michael Wilson",
    email: "michaelwilson@example.com",
    subject: "Important Announcement",
    date: "1 week ago",
    teaser:
      "Please join us for an all-hands meeting this Friday at 3 PM.\nWe have some exciting news to share about the company's future.",
    createdAt: "2026-07-04T10:00:00.000Z",
  },
  {
    id: "sarah-brown",
    roomName: "sarah-brown",
    url: "/chat/sarah-brown",
    name: "Sarah Brown",
    email: "sarahbrown@example.com",
    subject: "Re: Feedback on Proposal",
    date: "1 week ago",
    teaser:
      "Thank you for sending over the proposal. I've reviewed it and have some thoughts.\nCould we schedule a meeting to discuss my feedback in detail?",
    createdAt: "2026-07-03T13:45:00.000Z",
  },
  {
    id: "david-lee",
    roomName: "david-lee",
    url: "/chat/david-lee",
    name: "David Lee",
    email: "davidlee@example.com",
    subject: "New Project Idea",
    date: "1 week ago",
    teaser:
      "I've been brainstorming and came up with an interesting project concept.\nDo you have time this week to discuss its potential impact and feasibility?",
    createdAt: "2026-07-03T07:30:00.000Z",
  },
  {
    id: "olivia-wilson",
    roomName: "olivia-wilson",
    url: "/chat/olivia-wilson",
    name: "Olivia Wilson",
    email: "oliviawilson@example.com",
    subject: "Vacation Plans",
    date: "1 week ago",
    teaser:
      "Just a heads up that I'll be taking a two-week vacation next month.\nI'll make sure all my projects are up to date before I leave.",
    createdAt: "2026-07-02T09:10:00.000Z",
  },
  {
    id: "james-martin",
    roomName: "james-martin",
    url: "/chat/james-martin",
    name: "James Martin",
    email: "jamesmartin@example.com",
    subject: "Re: Conference Registration",
    date: "1 week ago",
    teaser:
      "I've completed the registration for the upcoming tech conference.\nLet me know if you need any additional information from my end.",
    createdAt: "2026-07-02T06:25:00.000Z",
  },
  {
    id: "sophia-white",
    roomName: "sophia-white",
    url: "/chat/sophia-white",
    name: "Sophia White",
    email: "sophiawhite@example.com",
    subject: "Team Dinner",
    date: "1 week ago",
    teaser:
      "To celebrate our recent project success, I'd like to organize a team dinner.\nAre you available next Friday evening? Please let me know your preferences.",
    createdAt: "2026-07-01T12:15:00.000Z",
  },
]

export const messageSidebar = {
  user: visitor,
  brand: {
    name: "Gortheia",
    logo: "/logo/icon.png",
  },
  navMain: [
    {
      title: "Inbox",
      url: "#",
      icon: Inbox,
      isActive: true,
    },
    {
      title: "Drafts",
      url: "#",
      icon: FileText,
      isActive: false,
    },
    {
      title: "Sent",
      url: "#",
      icon: Send,
      isActive: false,
    },
    {
      title: "Junk",
      url: "#",
      icon: ArchiveX,
      isActive: false,
    },
    {
      title: "Trash",
      url: "#",
      icon: Trash2,
      isActive: false,
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
      url: "/settings",
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

export const settingSidebar = {
  user: visitor,
  route: "/",
  role: "main",
  brand: {
    name: "Gortheia",
    logo: "/logo/icon.png",
  },
  // teams: [
  //   {
  //     name: "Gorth Inc.",
  //     logo: GalleryVerticalEnd,
  //     plan: "Enterprise",
  //   },
  //   {
  //     name: "Goraria Corp.",
  //     logo: AudioWaveform,
  //     plan: "Startup",
  //   },
  //   {
  //     name: "Waddles Corp.",
  //     logo: Command,
  //     plan: "Free",
  //   },
  // ],
  navMain: [
    {
      title: "Home",
      url: "/",
      icon: Home,
      isActive: true,
    },
    {
      title: "Your channel",
      url: "/channel",
      icon: SquareUser,
      isActive: true,
    },
    {
      title: "History",
      url: "/history",
      icon: History,
      isActive: true,
    },
    {
      title: "Playlists",
      url: "/playlists",
      icon: ListVideo,
      isActive: true,
    },
    {
      title: "Watch later",
      url: "/playlists?list=later",
      icon: Clock,
      isActive: true,
    },
    {
      title: "Liked videos",
      url: "/playlists?list=like",
      icon: ThumbsUp,
      isActive: true,
    },
    {
      title: "Downloads",
      url: "/downloads",
      icon: Download,
      isActive: true,
    },
    {
      title: "Chat information",
      url: "#",
      icon: Info,
      isActive: true,
      items: [
        {
          title: "View pinned messages",
          url: "#",
          icon: Pin,
          isActive: true,
        },
      ],
    },
    {
      title: "Chat customization",
      url: "#",
      icon: SmilePlus,
      isActive: true,
      items: [
        {
          title: "Change theme",
          url: "#",
          icon: Shield,
          isActive: true,
        },
        {
          title: "Change emoji",
          url: "#",
          icon: SmilePlus,
          isActive: true,
        },
        {
          title: "Edit nicknames",
          url: "#",
          icon: MessageCircleOff,
          isActive: true,
        },
      ],
    },
    {
      title: "Media and files",
      url: "#",
      icon: File,
      isActive: true,
      items: [
        {
          title: "Media",
          url: "#",
          icon: Image,
          isActive: true,
        },
        {
          title: "Files",
          url: "#",
          icon: File,
          isActive: true,
        },
      ],
    },
    {
      title: "Privacy and support",
      url: "#",
      icon: Shield,
      isActive: true,
      items: [
        {
          title: "Mute notifications",
          url: "#",
          icon: BellOff,
          isActive: true,
        },
        {
          title: "Message permissions",
          url: "#",
          icon: Shield,
          isActive: true,
        },
        {
          title: "Disappearing messages",
          url: "#",
          icon: CircleMinus,
          isActive: true,
        },
        {
          title: "Read receipts",
          url: "#",
          icon: Eye,
          isActive: true,
        },
        {
          title: "Verify end-to-end encryption",
          url: "#",
          icon: Lock,
          isActive: true,
        },
        {
          title: "Restrict",
          url: "#",
          icon: MessageCircleOff,
          isActive: true,
        },
        {
          title: "Block",
          url: "#",
          icon: CircleMinus,
          isActive: true,
        },
        {
          title: "Report",
          url: "#",
          icon: TriangleAlert,
          isActive: true,
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Your videos",
      url: "/profile/videos",
      icon: SquareUser,
      isActive: true,
    },
    {
      title: "Support",
      url: "#",
      icon: LifeBuoy,
    },
    {
      title: "Feedback",
      url: "#",
      icon: Send,
    },
  ],
  projects: [
    {
      name: "Music",
      url: "/explore/music",
      icon: Music,
    },
    {
      name: "Gaming",
      url: "/explore/gaming",
      icon: Rocket,
    },
    {
      name: "News",
      url: "/explore/news",
      icon: Newspaper,
    },
    {
      name: "Sports",
      url: "/explore/news",
      icon: SportShoe,
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
      url: "/settings",
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
}

export const infoSidebar = {
  user: visitor,
  route: "/",
  role: "main",
  brand: {
    name: "Gortheia",
    logo: "/logo/icon.png",
  },
  // teams: [
  //   {
  //     name: "Gorth Inc.",
  //     logo: GalleryVerticalEnd,
  //     plan: "Enterprise",
  //   },
  //   {
  //     name: "Goraria Corp.",
  //     logo: AudioWaveform,
  //     plan: "Startup",
  //   },
  //   {
  //     name: "Waddles Corp.",
  //     logo: Command,
  //     plan: "Free",
  //   },
  // ],
  navMain: [
    {
      title: "Chat information",
      url: "#",
      icon: Info,
      isActive: true,
      items: [
        {
          title: "View pinned messages",
          url: "#",
          icon: Pin,
          isActive: true,
        },
      ],
    },
    {
      title: "Chat customization",
      url: "#",
      icon: SmilePlus,
      isActive: true,
      items: [
        {
          title: "Change theme",
          url: "#",
          icon: Shield,
          isActive: true,
        },
        {
          title: "Change emoji",
          url: "#",
          icon: SmilePlus,
          isActive: true,
        },
        {
          title: "Edit nicknames",
          url: "#",
          icon: MessageCircleOff,
          isActive: true,
        },
      ],
    },
    {
      title: "Media and files",
      url: "#",
      icon: File,
      isActive: true,
      items: [
        {
          title: "Media",
          url: "#",
          icon: Image,
          isActive: true,
        },
        {
          title: "Files",
          url: "#",
          icon: File,
          isActive: true,
        },
      ],
    },
    {
      title: "Privacy and support",
      url: "#",
      icon: Shield,
      isActive: true,
      items: [
        {
          title: "Mute notifications",
          url: "#",
          icon: BellOff,
          isActive: true,
        },
        {
          title: "Message permissions",
          url: "#",
          icon: Shield,
          isActive: true,
        },
        {
          title: "Disappearing messages",
          url: "#",
          icon: CircleMinus,
          isActive: true,
        },
        {
          title: "Read receipts",
          url: "#",
          icon: Eye,
          isActive: true,
        },
        {
          title: "Verify end-to-end encryption",
          url: "#",
          icon: Lock,
          isActive: true,
        },
        {
          title: "Restrict",
          url: "#",
          icon: MessageCircleOff,
          isActive: true,
        },
        {
          title: "Block",
          url: "#",
          icon: CircleMinus,
          isActive: true,
        },
        {
          title: "Report",
          url: "#",
          icon: TriangleAlert,
          isActive: true,
        },
      ],
    },
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
      url: "/admin/users",
      icon: Users,
      isActive: true,
    },
    {
      title: "Applications",
      url: "/admin/apps",
      icon: AppWindow,
      isActive: true,
    },
    {
      title: "Settings",
      url: "/settings",
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
      url: "/settings",
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
