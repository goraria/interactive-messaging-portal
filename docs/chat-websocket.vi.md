# Chat: Hono WebSocket + ws, Message UI và call lifecycle

Ngày kiểm tra: 11/11/2026. Phạm vi chỉnh sửa chỉ trong Chat.

**Cập nhật Vercel:** đã thêm adapter `@vercel/functions` qua Hono và hai Route Handler socket; proxy dùng loopback riêng cho local/self-host. Fluid compute bật trong `vercel.json`, socket có giới hạn 300 giây và reconnect sau 270 giây. Hướng dẫn triển khai, cấu hình và các bước nghiệm thu còn lại ở [vercel-deployment.vi.md](./vercel-deployment.vi.md). Các ghi chú adapter chưa được triển khai ở các lần kiểm tra cũ bên dưới đã được thay thế bởi cập nhật này.

## Runtime và HTTP API

- Chat dùng Hono Node WebSocket Helper kết hợp `WebSocketServer` từ `ws`, với `noServer: true`, payload tối đa 1 KiB và tắt compression.
- Native adapter `@hono/node-server` trong Chat theo [Hono docs](https://hono.dev/docs/helpers/websocket). Không dùng adapter deprecated `@hono/node-ws` hoặc `hono/bun`.
- `package.json`: `dev = next dev --port 3030`, `start = next start`. Không launcher script, custom Next server hay process realtime con. Đã bỏ `bunfig.toml` ép Bun runtime.
- `instrumentation.register()` chờ listener sẵn sàng trong cùng process Node của Next. Cache cả promise startup để không bind lặp khi hook gọi đồng thời.
- Listener chỉ bind `127.0.0.1:3037`. `proxy.ts` chuyển tiếp đúng hai đường socket tới Hono bằng `NextResponse.rewrite`; browser vẫn dùng public origin của Chat. Dừng process Next dừng cả listener.
- `overrideGlobalObjects: false` giữ nguyên Request/Response của Next và auth. Không thay genericOAuth, callback, sign-in/out, token refresh, middleware xác thực hay schema.
- User đã cài dependency; nhiệm vụ này không cài package, chỉnh node_modules hoặc ghi lockfile. Các service/app khác và SSO không bị chỉnh sửa.
- `next.config.ts` giữ đúng mẫu tối giản người dùng yêu cầu: không có root detection, rewrite, filesystem import hoặc cấu hình Turbopack riêng. Build dùng Turbopack mặc định. Dependency cần được cài trong project; symlink ra ngoài root không được hỗ trợ với cấu hình tối giản này.

```text
Browser ─ HTTP ─ Next/Hono API ─ PostgreSQL chat_event/chat_delivery
   │                                     │
   ├─ WS message ─ Next proxy ─── Hono + ws┘
   └─ WS incoming call ────────── Hono + ws ─ call metadata
                                  cùng process Next
```

## Xác thực và quyền

- Socket tin nhắn: `/chat/conversation/:id/realtime/socket`.
- Socket cuộc gọi đến: `/chat/realtime/call/socket`, danh tính luôn lấy từ session đã xác minh, không nhận userId do browser yêu cầu.
- Cả hai kiểm tra exact Origin và dùng nguyên `requireAuth()`. Browser dùng cookie HttpOnly; không đưa OAuth/session token vào URL hoặc JavaScript.
- Session được xác minh lại định kỳ 15 giây. Mỗi nhịp message kiểm tra membership và user status; incoming call dùng service hiện có, có kiểm tra membership, block và expiry.
- WebSocket subscribe-only. Frame ngoài heartbeat pong bị từ chối; mọi mutation vẫn qua HTTP API.
- Tối đa 500 socket/process, 5 socket/user/process; đây không phải quota toàn hệ thống. Heartbeat, timeout query, giới hạn send buffer và hard terminate sau close timeout bảo vệ tài nguyên.
- Hook không mở listener trong build worker, Edge hoặc Vercel managed functions. Dùng literal guard `process.env.NEXT_RUNTIME === "nodejs"` theo tài liệu Next để compiler loại import Node khỏi Edge graph. Đây là ngoại lệ dành riêng cho marker compile-time của framework trong instrumentation; cấu hình ứng dụng vẫn đọc tại `utils/environment.ts`. Alias import và guard global Edge trước đây không loại được dependency Node ở thời điểm build.

## Publish, replay và HTTP recovery

- Dispatcher vẫn dùng outbox bền vững, lease, SKIP LOCKED và retry/backoff.
- Publish realtime là cập nhật `chat_delivery.delivered_at` bằng đúng lease. Mất lease không được ACK thay dispatcher khác.
- Message socket đọc high-water mark trực tiếp từ `chat_event` đã commit, không chờ outbox đánh dấu delivered. Sau HTTP mutation thành công, request context đánh thức đúng conversation ngay trước khi trả response; chỉ lưu ID conversation trong context, không gửi nội dung/credential. Request lỗi không đánh thức socket.
- Socket đọc lại quyền và sequence ngay khi được đánh thức; wakeup đến trong lúc query đang chạy được gộp và chạy tiếp ngay, không đợi timer. Cleanup gỡ subscription. Outbox, lease/retry và replay vẫn giữ nguyên.
- Wakeup trong RAM chỉ áp dụng trong cùng process Next/Hono. Nhịp kiểm tra database mỗi giây vẫn là đường dự phòng cho instance khác hoặc wakeup bị lỡ. Chưa triển khai broker/LISTEN-NOTIFY xuyên instance; không cam kết độ trễ bằng 0 hay push tức thời giữa các process.
- Tin đến được đánh dấu read khi conversation đang hiển thị; quay lại tab/focus cũng kiểm tra ngay, không cần chờ có message mới. Chọn tin cuối của đối phương kể cả khi sau nó có tin của mình. Vẫn chỉ hiển thị read thật đã được server ghi nhận.
- Restart Next sau thay đổi listener/connection; HMR không thay các closure đang được listener dài hạn giữ lại. Chưa đo độ trễ qua hai tài khoản thật; độ trễ database/network và HTTP replay vẫn tồn tại.
- Frame message chỉ chứa conversationId và sequence; không gửi text, attachment URL, SDP hoặc ICE.
- Browser dùng HTTP replay có quyền để tải entity mới. Mỗi entity chỉ tải một lần trong một batch event, dù có nhiều receipt/reaction.
- WebSocket khỏe thì không polling HTTP message. Recovery timer 15 giây chỉ chạy khi socket unavailable và tab đang hiển thị. Mất quyền dừng retry HTTP tự động.
- Kết nối lại có backoff, preflight HTTP và replay. API cũ `.../realtime/token` giữ đường dẫn nhưng trả descriptor WebSocket, không trả token Ably.

## Cuộc gọi: không polling REST khi chat rảnh

- Incoming call được đẩy qua socket riêng. Một subscription dùng chung giữa header và incoming alert cho mỗi tài khoản.
- Snapshot chỉ chứa tối đa 10 cuộc gọi ringing được phép, không có SDP/ICE hoặc credentials. Browser kiểm tra schema và tách cache theo account.
- Incoming UI và header không gọi `/call/incoming` hoặc danh sách call theo interval.
- Lịch sử call chỉ tải HTTP khi người dùng mở phần lịch sử. ICE configuration chỉ tải khi setup một cuộc gọi.
- Polling signaling chỉ chạy khi có call active; cleanup dừng timer và media khi kết thúc hoặc rời conversation.
- Các HTTP API call vẫn giữ để tương thích. WebSocket không làm mất quyền kiểm tra tại mutation/read HTTP.
- Listener vẫn thực hiện database polling cho subscription. Không gọi REST API không có nghĩa là không có chi phí database.

## Message UI

Dùng public export Primitive, không chỉnh thư viện hoặc component UI mặc định:

```text
Message
├─ MessageAvatar → custom Avatar → AvatarImage / AvatarFallback
└─ MessageContent
   ├─ MessageHeader (accessible label)
   ├─ BubbleGroup
   │  └─ Bubble → BubbleContent + BubbleReactions
   └─ MessageFooter
```

- Tin gửi/nhận dùng align end/start và variant default/muted.
- Avatar size-9, bubble một dòng min-h-9 và min-w-9; đều rounded-md. Nội dung nhiều dòng được tăng chiều cao.
- Không dùng NavIdentity/NavID trong message.
- Attachment và tombstone vẫn nằm trong Message/Bubble, giữ HTTP URL có kiểm tra quyền.
- Tailwind animate-in/opacity/translate và transition cho xuất hiện/xóa; có motion-reduce. Pending và tin đã commit dùng clientMessageId làm key để tránh remount khi ACK.
- Giữ edit, delete, report, reaction và trạng thái gửi/đọc. Message grouping ưu tiên user ID, tránh gộp hai người cùng display name.
- Dùng custom/message-scroller đầy đủ Provider/Root/Viewport/Content/Item/Button. Nút xuống cuối có accessible label; giữ logic restore khi tải tin cũ.
- Không tạo trạng thái typing giả.

## Chạy và cấu hình

```sh
bun run dev --port 3030
bun run build
bun run start --port 3030
```

Bun dùng để chạy project script; Next vẫn có thể chạy trên Node bằng CLI chuẩn. CLI mặc định là port 3000, nên truyền port để khớp origin/callback đã đăng ký.

```dotenv
NEXT_WEBSOCKET_PORT=3030
```

WebSocket không cần secret hay OAuth client mới. Listener private của local/self-host không mở ra Internet; reverse proxy phải giữ Origin/cookie và hỗ trợ Upgrade. Trên Vercel hai Route Handler dùng adapter native, không dùng loopback.

### Cổng 3030 và triển khai Vercel

- `NEXT_WEBSOCKET_PORT=3030` hợp lệ: khi port trùng port của `NEXT_PUBLIC_APP_URL`, Next vẫn sở hữu port public, helper dùng listener loopback 3037 (3038 nếu HTTP đã là 3037). Proxy và Hono dùng cùng helper, không bind hai listener vào một port. Nếu cấu hình port khác HTTP, port đó được dùng làm listener riêng.
- Browser dùng `ws://localhost:3030/chat/.../socket` qua Next proxy. Không đọc lại tên env cũ; không cần thay đổi auth/callback. Bản sửa không đọc/sửa `.env.local`.
- Giữ lệnh Next CLI chuẩn thì giữ listener nội bộ khác cổng. Đưa Hono vào cùng TCP listener cần server tích hợp có quyền xử lý upgrade; Next không cung cấp API upgrade chuẩn cho Route Handler.
- Vercel hiện hỗ trợ WebSocket và yêu cầu bật Fluid compute. Chat dùng `upgradeWebSocket` từ `@vercel/functions` 3.11.1 do người dùng cài, bọc bằng Hono helper để giữ các kiểm tra session/Origin/member hiện có.
- Trên Vercel proxy chuyển tiếp nội bộ đến Route Handler cùng origin, không rewrite loopback. Không mở cổng 3037 trên Vercel và không chỉ đổi biến port để deploy.
- Dùng HTTPS/WSS, cấu hình origin/callback production tại SSO, giữ trạng thái bền vững trong database và reconnect/replay khi function hết thời gian chạy. Đặt thời gian chạy theo giới hạn của gói Vercel; không giả định kết nối tồn tại vô hạn.

Nguồn: [Next instrumentation](https://nextjs.org/docs/app/guides/instrumentation), [Vercel WebSockets](https://vercel.com/docs/functions/websockets).

## Kiểm chứng

- Cập nhật adapter Vercel: **273 test / 47 file thường, 23 test cloud, TypeScript và production build Turbopack đều qua**. Cloud suite kiểm tra cleanup fixture/schema auth. Lint có 0 lỗi và 1 cảnh báo unused import có sẵn. Build đã xuất cả hai socket Route Handler. Chưa có nghiệm thu trên Vercel và hai tài khoản thật.

- Kết quả mới nhất sau khi người dùng cài Primitive `0.0.0-alpha.8`: **244 test / 43 file qua; `bun run typecheck` qua; lint phần sửa qua**. Các lỗi dependency/typecheck và placeholder mô tả bên dưới là kết quả lịch sử, đã được giải quyết bằng lần cài lại này.
- `next.config.ts` đúng mẫu tối giản; không có rewrite, root detection, alias hoặc cấu hình Turbopack riêng. `proxy.ts` chỉ thêm điều kiện chuyển tiếp hai socket path tới listener hiện có; không thay logic đăng nhập.
- Next dev thực với config tối giản đã khởi động, upgrade qua `proxy.ts` trả 401 khi thiếu session và 403 khi sai Origin. Node listener/transport có kiểm thử thực; chưa nghiệm thu hai tài khoản thật.
- Build Turbopack với alpha.8 không còn lỗi import/font nhưng chưa hoàn tất: worker PostCSS bị `EPERM` khi bind cổng IPC nội bộ trong môi trường kiểm tra. Đã thử chạy lại với quyền mở rộng và gặp cùng lỗi. Không sửa config/đổi bundler/tắt TypeScript để che lỗi; cần chạy `bun run build` ở terminal có quyền tạo worker và bind port để xác nhận production build.

### Lịch sử kiểm chứng trước khi cài Primitive alpha.8

- Sau đơn giản hóa Next config: `bun run build` đã chạy Turbopack nhưng bị chặn do dependency đang symlink ra ngoài project (`@gorth-io/*`, React, React DOM...), và không tải được Google Fonts trong môi trường kiểm tra. Không thêm root/alias hoặc tắt TypeScript để che lỗi. Cần cài lại dependency trước khi kiểm chứng build và WebSocket qua Next thực với proxy mới; chưa chứng nhận build thành công.
- Sau khi người dùng cài lại dependency: symlink đã hết; build với quyền mạng không còn lỗi font nhưng vẫn báo 113 lỗi import Primitive. Package thực tế là `0.0.0-stage`, `stub: true`, không có code/exports; `bun.lock` cũng trỏ tới stage. Registry có `0.0.0-alpha.8` với exports và tarball chứa Message, Bubble, MessageScroller. Cần cài đúng bản thật thay placeholder trước khi kết luận build. Không tự chỉnh node_modules/lockfile.
- Vitest sau lần cài lại: 40 file qua / 234 test qua; 3 suite UI không khởi chạy vì Primitive placeholder. Các lần test thành công trước đó dùng dependency symlink cũ, không được coi là bằng chứng cho dependency hiện tại.
- Sau đổi sang `NEXT_WEBSOCKET_PORT=3030`: **242 test / 43 file qua**, lint phần sửa qua. Chạy `bun run dev` thực khởi động thành công; Next 3030 và listener Hono loopback 3037 cùng process, WebSocket upgrade qua 3030 trả 401 khi chưa đăng nhập. Không đọc/sửa `.env.local`; tên biến cũ được loại khỏi source/test/example/docs đang duy trì.
- Vitest toàn bộ: **228 test / 41 file qua**, chạy lại sau sửa runtime guard. Lần chạy trong sandbox qua 227 test, transport bị EPERM khi bind; chạy lại với quyền loopback qua đủ 228 test.
- Chạy Next dev thực sau sửa: biên dịch instrumentation Node và Edge, không còn cảnh báo Node API trong Edge của log báo lỗi; listener 3037 và Next 3030 cùng process. HTTP `/chat/user/me` và WebSocket upgrade `/chat/realtime/call/socket` qua 3030 trả 401 khi thiếu session.
- Node/Hono/ws transport thực: hai client nhận invalidation, membership revoke đóng code 4403; fixture không dùng cloud hoặc account thật.
- Through-Next thật: cả message socket và call socket trả 401 khi không có session, 403 với Origin khác. HTTP preflight trả 401 khi không có session.
- UI render test dùng component Message/Bubble/Avatar thật: slots, alignment, h-14, rounded-md, tombstone và attachment.
- Call client: chia sẻ kết nối, không REST request khi idle, tách account, heartbeat, reconnect và validate frame.
- Unit lifecycle: startup đồng thời, bind failure/retry, cleanup client/socket/listener, build/Edge/Vercel guards.
- Lint phần sửa và git diff whitespace check: **qua sau format**.
- Through-Next: message/call socket đều trả **401** khi thiếu session và **403** khi sai Origin. Cổng public 3030 và loopback 3037 cùng process Node.
- TypeScript toàn project còn **10 diagnostic** do dependency không đồng nhất: Hono giữa Chat/Principle (cả app API và realtime app), Better Auth giữa app/Structure và Postgres/Drizzle. Không cast để che lỗi hoặc sửa auth. Không có lỗi TypeScript ở Message UI, call client hoặc Node listener mới. Chưa chạy migration/cloud, chưa nghiệm thu giao diện và WebRTC bằng hai browser/account thật.
