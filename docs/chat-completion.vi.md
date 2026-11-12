# GorCer Chat — triển khai và kiểm chứng

> Realtime update (2026-11-07): Chat đã thay Ably bằng Hono WebSocket. Cấu hình/các kết quả Ably trong lịch sử kiểm chứng phía dưới không mô tả runtime hiện tại. Xem [Hono WebSocket: vận hành và kiểm thử](./chat-websocket.vi.md).

> Update 2026-11-11: Runtime hiện dùng Hono Node + `ws`, tự khởi tạo qua Next instrumentation với lệnh `next dev/start` thuần. Message UI dùng Primitive Message/Bubble/custom Avatar/MessageScroller. Cuộc gọi đến dùng WebSocket, không còn polling REST khi chat rảnh; lịch sử chỉ tải khi mở, signaling chỉ chạy trong cuộc gọi active.

> Runtime update (2026-11-06): standalone workers have been replaced by Vercel Queues. Worker-specific instructions below are historical. Use `bun dev` and the setup in [Managed background processing](https://github.com/gorth-io/ecosystem/blob/main/docs/managed-background-en.md), including Queue credentials and Cron recovery. Existing cross-service OAuth grants still apply.

Ngày: 28/10/2026. Phạm vi mã nguồn: Chat, cùng API bổ sung trong Media, Discovery và Insight. Notify, Resource, Payment và Billing được dùng qua API hiện có. Không sửa mã nguồn Task hoặc app khác; không chỉnh luồng đăng nhập/SSO/session của Chat.

## 1. Những luồng đã triển khai

| Năng lực | Hành vi hiện tại | Mã nguồn chính |
| --- | --- | --- |
| Hội thoại | Tạo direct hai người hoặc group trong transaction; dedupe direct khi tạo đồng thời; owner và thành viên được thêm cùng lúc. | `services/chat-conversations.ts`, `components/conversation/new-group.tsx` |
| Thành viên | Phân cấp owner/admin/member, thêm/loại/rời nhóm, chuyển owner, không cho admin quản lý owner hoặc tự nâng quyền. Kiểm tra membership sau khi khóa conversation; rejoin chỉ đọc lịch sử từ lần tham gia mới. | `services/helper.ts`, `services/chat-conversations.ts` |
| Tin nhắn | Gửi có client message UUID và fingerprint chống retry khác payload; ghi message + event/outbox cùng transaction. Sửa bằng optimistic version; xóa thành tombstone và không trả nội dung/metadata/attachment đã xóa. | `services/chat-messages.ts` |
| Realtime | Hono WebSocket chỉ phát `chat.changed` với conversation/sequence, không phát text, URL asset, SDP hoặc ICE. Handshake dùng session hiện có, membership kiểm tra mỗi nhịp đọc, session kiểm tra lại định kỳ. | `lib/realtime/`, `services/realtime.ts`, `services/chat-delivery.ts` |
| Replay | Event log có sequence; client bù event khi online trở lại, phân trang event và tải lại entity hiện tại. Polling DB-backed API tiếp tục hoạt động khi socket lỗi; không khóa nút gửi theo trạng thái socket. | `hooks/use-realtime-chat.tsx` |
| Lịch sử | Cursor theo timestamp có microsecond + UUID; không dùng offset cho message. Tìm text trong conversation; giữ vị trí viewport khi prepend trang cũ. | `services/chat-messages.ts`, `utils/chat-policy.ts`, `components/conversation/broadcast.tsx` |
| Đồng bộ nhiều thiết bị | Merge theo message version và event sequence dạng bigint string, tránh response reaction/receipt cũ ghi đè state mới. Editor giữ version lúc bắt đầu sửa để phát hiện draft cũ. | `utils/messenger.ts`, `components/conversation/message.tsx` |
| Attachment | Chọn file → tạo upload qua Media → browser PUT có tiến độ/hủy/timeout → complete tại Media → xác minh owner/private/ready/conversation → gắn asset vào message trong transaction. Không nhận URL file tùy ý từ browser. | `services/chat-media.ts`, `services/client/messenger.ts` |
| Kiểm tra file | Giới hạn MIME/25 MiB/10 asset; Media đối chiếu HEAD size/type và chữ ký byte cơ bản cho attachment Chat. SVG/HTML/JS không nằm trong danh sách MIME. Không coi sniffing này là antivirus. | `media-storage/utils/chat-media.ts`, `media-storage/services/media.ts` |
| Tải file | Chat kiểm tra membership, thời điểm tham gia và tombstone; chỉ ký asset đã bind đúng conversation. Media trả URL download 60 giây; browser không nhận storage credentials. | `services/chat-media.ts`, `media-storage/services/chat.ts` |
| Giọng nói | Browser MediaRecorder xin quyền microphone theo thao tác người dùng, hỗ trợ format trình duyệt cung cấp, dừng track khi xong/rời trang và upload như attachment. Giới hạn ghi âm 5 phút và giới hạn file chung. | `components/conversation/broadcast.tsx` |
| Reaction | Thêm/bỏ emoji theo người đang xác thực, unique key chống trùng; response và replay giữ đúng state. | `services/chat-messages.ts`, `components/conversation/message.tsx` |
| Read/unread | Receipt không lùi từ read về delivered; last-read cursor không lùi khi thiết bị khác ACK tin cũ. Unread chỉ tính tin của người khác sau mốc đọc và sau lần join hiện tại. | `services/chat-messages.ts`, `services/chat-conversations.ts` |
| Gọi | WebRTC **1:1** audio/video; signaling bền vững có quyền, trạng thái ringing/active/ended/rejected, timeout, dedupe và giới hạn gửi. Có incoming banner, accept/reject/end, mute mic, ICE restart phía caller và lịch sử cuộc gọi gần nhất. | `services/chat-calls.ts`, `components/conversation/call-controls.tsx`, `lib/webrtc/signaling.ts` |
| Block | Chặn giao tiếp hai chiều, kết thúc call liên quan; vẫn cho thao tác quản trị/rời nhóm/mute phù hợp để block không khóa cứng người quản lý. | `services/chat-conversations.ts` |
| Report | Kiểm tra quyền message trước khi gửi report bằng token người dùng tới Resource; không tạo report table trong Chat. | `services/chat-reports.ts` |
| Rate limit | Giới hạn bền vững theo người gửi: 30 message/phút, 5 conversation/phút, 5 call/phút. Khóa theo actor + conversation cho mutation liên quan. Không mô tả bộ giới hạn theo tiến trình là giới hạn toàn hệ. | `services/chat-conversations.ts`, `services/chat-messages.ts`, `services/chat-calls.ts` |
| Notification | Outbox gửi Notify event có dedup key; lọc thành viên hiện tại, mute và block. Preview chung không chứa text. Preference và endpoint đã xác minh do Notify quản lý; delivery email/push nằm ở worker Notify. | `services/chat-delivery.ts`, `/setting/notification` |
| Vận hành | Lease token, `SKIP LOCKED`, retry exponential, ACK có fence, độc lập từng destination. Sau 20 lần lỗi, manager xem trạng thái và retry từ conversation info. | `services/chat-delivery.ts`, `services/chat-delivery-status.ts`, `services/background.ts` |
| UI | Thay menu mail/video template bằng Inbox, Groups, Archived, Notification, Billing. Có tạo nhóm, quản lý thành viên, search, mute/block và trạng thái delivery trong conversation info. | `utils/constant.ts`, `components/conversation/*` |

Endpoint room tự tạo/tự join và endpoint nhận raw attachment URL đã được gỡ. Các controller/service CRUD cũ không còn sử dụng cũng được gỡ, tránh vô tình khôi phục đường truy cập đó. Route Handler giữ tên API riêng trước dynamic page `/chat/[id]`.

## 2. Dùng đúng 7 service

| Service | Chat dùng để làm gì | Dữ liệu không sao chép vào Chat |
| --- | --- | --- |
| Resource | Report message bằng identity người báo cáo. | Report/moderation report store. |
| Notify | Event notification, dedup, preferences, verified endpoints, delivery queue/provider. | Notification, endpoint, delivery và preference tables. |
| Discovery | Đồng bộ private message index bằng revision; endpoint riêng chỉ nhận Chat machine grant và trả ID theo conversation/cutoff. Chat kiểm tra lại membership, tombstone và nội dung hiện tại trước khi trả kết quả. Search công khai hiện có vẫn loại private documents. | Search index/document/facet tables. |
| Media | Upload/session/object verification/storage profile, asset, ký download và xử lý file. Endpoint Chat bổ sung chỉ inspect/sign asset thuộc application Chat và conversation tương ứng. | Media asset, upload session, bucket và provider credentials metadata. |
| Insight | Event idempotent với tên hành động và ID; không chuyển text, filename, SDP, ICE, URL ký hoặc key vào analytics. | Analytics/audit/moderation/risk tables. |
| Billing | Catalog, subscription, invoice và entitlement tại `/billing`. | Product/plan/subscription/invoice/entitlement tables. |
| Payment | Hosted checkout hoặc Stripe Payment Element, xem trạng thái và reconcile invoice qua Billing. Số tiền lấy từ invoice ở backend. | Payment intent/transaction/provider ledger. |

Media, Discovery và Insight có endpoint `/.../chat/...` riêng. Endpoint/scope của Task vẫn giữ nguyên; không chuyển Task qua controller Chat hoặc thay verifier/user-auth của service.

## 3. Database và migration cloud

Migration: `database/migrations/20261028-chat-completion.sql`.

- Thêm `message.client_message_id`, `message.version`, unique/cursor indexes.
- Thêm `message_attachment.media_asset_id` để lưu **binding** tới Media asset; không lưu object credential.
- Thêm 5 bảng nghiệp vụ Chat: `chat_event`, `chat_delivery`, `chat_block`, `chat_call`, `chat_signal`.
- Event/outbox lưu giao dịch nguồn của Chat; không thay thế queue gửi mail/push hoặc dữ liệu analytics của các service.
- Reaction/receipt/attachment binding tables đã có của Chat được giữ lại; không tạo thêm bản sao bảng nghiệp vụ của 7 service.
- Không drop/reset bảng, không đổi bảng/cột auth. Script kiểm tra metadata cột auth trước/sau trong transaction và rollback nếu khác.

Migration đã được chạy trên cloud hiện có. Script có thể chạy lại để bổ sung index mới mà không reset dữ liệu:

```sh
pnpm db:migrate-chat
pnpm test:cloud
```

Test cloud chỉ tạo user/conversation UUID riêng của lượt test, chỉ dọn các UUID đó; HTTP tới platform/provider được giả lập. Không gửi email/push, upload S3 hoặc thu tiền thật trong test này.

## 4. Cấu hình triển khai

### Chat backend

Giữ nguyên cấu hình đăng nhập hiện có. Thêm/cấu hình **một confidential backend client đã có**, dùng chung cho mọi tác vụ server-to-server của Chat:

```dotenv
NEXT_OAUTH_CLIENT_ID=<existing-chat-confidential-client>
NEXT_OAUTH_CLIENT_SECRET=<existing-client-secret>
NEXT_OAUTH_TOKEN_ENDPOINT_AUTH_METHOD=client_secret_basic
```

Phương thức phải khớp đăng ký hiện tại (`client_secret_basic` hoặc `client_secret_post`). Không dùng `NEXT_PUBLIC_OAUTH_CLIENT_ID` hoặc session secret thay cho confidential credentials; không tạo client riêng cho từng worker/endpoint. Nếu chưa có confidential backend client thật, cần cấp tại SSO; không thể suy ra secret từ public client ID.

Server URL/resource của 7 service vẫn là `NEXT_OAUTH_*_AUDIENCE` trong `.env.example`; production dùng HTTPS và cùng issuer SSO đang phát token. Không đưa token hoặc URL private upstream vào browser. Public app client phải có resource/scope cần thiết cho thao tác người dùng tại Media/Resource/Billing/Payment; session đã cấp trước đó có thể cần đăng nhập/consent lại sau khi operator cập nhật registry. Code đăng nhập không bị chỉnh để tự thêm/bỏ kiểm tra resource.

| Caller | Resource/audience | Machine scope | TTL tối đa |
| --- | --- | --- | --- |
| Chat backend | `NEXT_OAUTH_AUDIENCE` hiện tại | `chat:dispatch` | 600 giây |
| Chat backend | Origin Notify | `chat:notification:publish` | 600 giây |
| Chat backend | Origin Discovery | `chat:discovery:write` | 600 giây |
| Chat backend | Origin Media | `chat:media:delegate` | 600 giây |
| Chat backend | Origin Insight | `chat:insight:publish` | 600 giây |
| Media backend hiện có | URL đầy đủ `https://<chat-host>/internal/storage/credential` | `storage:chat:credential` | 120 giây |

Cấp `client_credentials`, `client_credentials_scopes`, `allowedScopes` và link resource trên các client/resource hiện có tại SSO. **Chỉ Media được cấp scope lấy storage credentials của Chat.** Resource report dùng token người dùng; không cần bịa thêm machine scope report. Không sửa registry SSO thật hoặc tạo client/secret trong đợt này.

### Storage do Chat sở hữu

```dotenv
AWS_ENDPOINT_URL_S3=<https-storage-origin>
AWS_ACCESS_KEY_ID=<private-key>
AWS_SECRET_ACCESS_KEY=<private-secret>
AWS_REGION=ap-southeast-1
AWS_BUCKET=<actual-bucket>
```

Đăng ký storage profile application Chat trong registry Media qua API quản trị hiện có: endpoint/region/bucket khớp env Chat, `credentialsUrl=https://<chat-host>/internal/storage/credential`. Metadata không chứa key. Tạo Media bucket private của Chat, cho phép type cần dùng và giới hạn file phù hợp. Cấu hình CORS storage cho browser PUT từ origin Chat. Không hardcode bucket thật trong code.

Media tiếp tục dùng confidential client hiện có qua `NITRO_OAUTH_CLIENT_ID`, `NITRO_OAUTH_CLIENT_SECRET`, `NITRO_OAUTH_TOKEN_ENDPOINT_AUTH_METHOD`. Không chép secret của Media sang Chat; không cần AWS SDK trong Chat.

Attachment legacy chưa có Media asset ID không được tự động mở raw URL chưa xác minh; cần ánh xạ/migrate qua Media nếu có dữ liệu cũ. File được complete nhưng chưa gửi thành message cần retention/cleanup phù hợp tại Media/bucket; không có cam kết antivirus hoặc tự động lưu trữ vĩnh viễn.

### Realtime, call và worker

```dotenv
NEXT_WEBSOCKET_PORT=3030
NEXT_CHAT_ICE_SERVERS_JSON=[]
```

`NEXT_CHAT_ICE_SERVERS_JSON` là danh sách ICE server theo WebRTC (`urls`, và TURN username/credential khi provider yêu cầu). Đây là cấu hình cho browser kết nối media, không phải storage credentials. Cấu hình TURN phù hợp để gọi qua các NAT/network khác nhau; không có provider TURN/SFU được tự đăng ký trong đợt này.

```sh
bun dev
# Tiến trình riêng, gọi HTTP app hiện có; không mở port mới.
# Queue consumer runs with bun dev; no separate worker command.
# Một lượt drain phục vụ scheduler/process manager:
# Queue consumer runs with bun dev; no separate worker command.
```

Worker dùng OAuth SSO, cache token ngắn hạn và drain outbox. Không có cron password/HMAC shared secret. HTTP cron chỉ gọi URL sẽ không tự xin OAuth token: dùng worker hoặc scheduler có client-credentials support. Chạy worker Notify/Media tương ứng khi dùng delivery/processing của chúng. Không khởi chạy worker production chỉ để kiểm thử cú pháp.

## 5. Threat model và giới hạn

- **Không cam kết E2EE.** Message được lưu ở Chat, private search có nội dung tại Discovery, object nằm trong storage của app qua Media. Backend/infrastructure được tin cậy để xử lý nội dung; production dùng HTTPS. Trang `/privacy` và sidebar công bố rõ điều này, bỏ badge “Encrypted” sai trước đây.
- Không tự thiết kế mật mã, device key exchange hoặc encrypted recovery. Nếu sản phẩm chuyển sang E2EE, cần giao thức được thẩm định, vòng đời thiết bị/khôi phục và thiết kế lại server search/attachment/notification tương ứng.
- Gọi hiện là WebRTC 1:1, không phải group SFU/conference. ICE/signaling ordering và trạng thái được test; camera/microphone, TURN, Safari/mobile và mạng thật chưa được nghiệm thu bằng browser. Lịch sử call hiện lấy 30 cuộc gần nhất.
- Membership revoke chặn truy cập API mới, không thu hồi dữ liệu đã tải/copy. URL storage đã ký có thể còn dùng được tối đa 60 giây. Native peer đang giữ dữ liệu không được mô tả là bị thu hồi từ xa.
- Giữ vị trí khi tải thêm tin cũ; chưa cung cấp đồng bộ vị trí cuộn qua thiết bị hoặc khôi phục toàn bộ viewport lịch sử sau reload.
- Danh sách conversation/contact dùng cửa sổ hiện tại; message history có cursor riêng. Chưa có kiểm thử tải lớn/SLO, spam ML, antivirus hoặc bảo đảm độ sẵn sàng production.
- Index và thông báo nhất quán theo outbox/worker. Search conversation trực tiếp vẫn kiểm tra DB hiện tại; indexed search kiểm tra lại quyền và nội dung sau khi nhận ID từ Discovery.
- Billing/Payment có code và contract tests/provider mocks, chưa phải bằng chứng giao dịch sandbox thành công. Email/push cần provider và endpoint đã xác minh; UI preference không thay thế bước cấu hình đó.
- Không đọc/sửa `.env.local` hoặc in secret. Script migration/test dùng env loader tại runtime để kết nối database được cho phép; không xuất connection string.
- Không cài thêm thư viện, không sửa lockfile/node_modules/default UI, không deploy ứng dụng hoặc sửa app khác.

## 6. Kiểm chứng

Các bộ kiểm tra gồm JWT ký thật qua verifier Better Auth, HTTP contract có identity giả lập ở test boundary, WebRTC peer giả lập, provider mock và SQL/transaction thật trên cloud. Các mức bằng chứng này được phân biệt; không gọi tất cả chúng là live browser E2E.

```sh
pnpm exec vitest run --configLoader native --no-cache --no-fsModuleCache
pnpm exec tsc --noEmit --incremental false
pnpm test:cloud
pnpm exec next build --webpack
```

Kết quả kiểm chứng ngày 28/10/2026:

| Bộ kiểm tra | Kết quả | Phạm vi bằng chứng |
| --- | --- | --- |
| Chat Vitest | **153/153**, 26 file | Domain, hợp đồng HTTP, actor binding, native OAuth verification/JWT, cursor, merge và WebRTC signaling giả lập; gồm test auth đã có. |
| Chat cloud Vitest | **23/23** | SQL/transaction trên Neon thật: quyền nhiều tài khoản, owner/member lifecycle, concurrent retry/edit, cursor microsecond, tombstone, reaction/read/unread, block, archive, call, Media binding, rate limit, outbox retry và lease fencing. Provider/platform HTTP được mock. |
| Notify | **51/51** | Hồi quy service hiện có. |
| Resource | **85/85** | Hồi quy service hiện có. |
| Discovery | **44/44** | Hồi quy và private Chat search. |
| Payment | **44/44** | Hồi quy; không thu tiền thật. |
| Billing | **40/40** | Hồi quy service hiện có. |
| Media | **80/80** | Hồi quy, Chat delegation, byte signature và xác nhận đường upload Task vẫn giữ hành vi cũ. |
| Insight | **51/51** | Hồi quy và giới hạn Chat event ingestion. |
| Task Vitest | **156/156**, 26 file | Kiểm tra hồi quy tích hợp, không sửa source Task. |
| TypeScript | **Qua** | Chat và cả 7 service; service có kiểm tra thêm cấu hình TypeScript cho test. |
| ESLint và script | **Qua** | Các file Chat được thêm/sửa: ESLint với `--max-warnings 0`; kiểm tra cú pháp worker, migration và cloud runner. |
| Production build Chat | **Qua** | Next.js Webpack compile, TypeScript, prerender và build traces. Còn cảnh báo dynamic dependency từ `Ably → got → cacheable-request → keyv`; không sửa dependency hoặc lockfile để che cảnh báo. |
| Auth được bảo vệ | **20/20 file giữ nguyên SHA-256** | Login/session/proxy/SSO/auth database source trước và sau. Script cloud kiểm tra metadata cột auth giữ nguyên. |

HTTP test dùng identity giả lập ở middleware boundary để kiểm tra bảo vệ route; đây không phải bằng chứng đăng nhập OAuth production bằng browser. Test machine OAuth riêng dùng JWT ký thật với verifier native. Không chạy worker gửi thông báo hoặc giao dịch provider thật để lấy kết quả test.

Tài liệu giao thức tham khảo: [W3C WebRTC](https://www.w3.org/TR/webrtc/), [Ably REST publish/idempotency](https://ably.com/docs/api/rest-api), [Better Auth resource verification](https://better-auth.com/docs/plugins/oauth-provider#verification), [Stripe.js Payment Element](https://docs.stripe.com/js/payment_intents/confirm_payment).

## Cập nhật độ trễ local — 06/11/2026

Luồng trước đây chờ response để hiện tin ở người gửi; người nhận chờ Queue phát invalidation rồi đọc event và đọc message bằng hai HTTP request nối tiếp. Event/outbox còn được ghi bằng nhiều câu SQL nối tiếp tới DB.

- Hiện preview riêng với trạng thái `Sending…` trong lúc POST đang chờ. Preview không chạy receipt/edit/delete/reaction, không phát callback như message đã lưu, và được thay bằng dữ liệu server. Nếu gửi lỗi, bỏ preview và giữ draft/idempotency key để thử lại.
- Sau response mutation thành công, `after()` chạy dispatch **chỉ realtime** song song với enqueue Queue. Fast path dùng đúng lease/fence/backoff của outbox; Queue tiếp tục retry và xử lý notification/discovery/insight.
- Invalidation Ably thêm `entityId`, không chứa nội dung hoặc URL attachment. Client lấy message ngay qua API có kiểm tra quyền; replay và polling 3 giây vẫn phục hồi khoảng trống khi mất realtime.
- Ghi event và đầy đủ destination bằng một data-modifying CTE trong transaction hiện có, giảm bốn lượt DB của message-created. Giữ nguyên membership lock, kiểm tra asset, rate limit và tính idempotent.

Kiểm tra local bằng native SDK/SQL compiler và fixture; chưa đo latency hai browser đăng nhập thật. Nếu Ably chưa hoạt động, log `[background] realtime_deferred` và UI vẫn có thể dựa vào polling; cần kiểm tra cấu hình Ably của app, không cần khởi chạy worker riêng.

Typecheck và **172 test Chat** đạt. Build Turbopack trong môi trường agent vẫn bị chặn bind port của worker CSS (`EPERM`), không đổi build flag/framework để né lỗi.
