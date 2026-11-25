export default function ChatPrivacy() {
  return (
    <article className="mx-auto max-w-3xl space-y-5 p-6">
      <h1 className="text-2xl font-bold">GorCer privacy and security</h1>
      <p>
        GorCer uses server-side authorization and HTTPS in production. Messages
        and uploaded files are not end-to-end encrypted. Authorized
        infrastructure processes message content to store, deliver, search and
        handle abuse reports.
      </p>
      <p>
        Private message search is restricted to current conversation members and
        their membership period. Public search never includes private messages.
        Notifications use generic previews, and analytics events exclude message
        text, filenames, credentials and media URLs.
      </p>
      <p>
        Removing a member stops new API access. Already downloaded messages and
        files cannot be recalled. A previously issued storage download URL can
        remain usable for up to 60 seconds. Calls use browser WebRTC transport;
        device identity verification and encrypted recovery backups are not
        implemented.
      </p>
      <p>
        Block prevents new communication between the affected participants,
        including shared conversations. Reports are stored in the Resource
        service for moderation. Only the sender may edit or delete their message
        through the conversation API.
      </p>
    </article>
  );
}
