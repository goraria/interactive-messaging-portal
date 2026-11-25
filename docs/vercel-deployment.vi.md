# Triển khai Chat trên Vercel

> OAuth update — 2026-11-13: all confidential SSO token exchanges use fixed `client_secret_basic` in code; there is no auth-method environment selector. Business APIs keep `Bearer` tokens. Public PKCE clients keep `none`. A registered Post client needs a native Basic replacement and coordinated ID/secret/binding cutover.

Ngày cập nhật: 11/11/2026. Phạm vi: Chat. Không thay genericOAuth, đăng nhập, schema auth, SSO hay các app/service khác.

## Bốn vấn đề của lần đánh giá

| Hạng mục              | Thay đổi                                                                                                                                    | Trạng thái nghiệm thu                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| WebSocket trên Vercel | Hai Route Handler Node dùng `upgradeWebSocket` của `@vercel/functions` 3.11.1 qua Hono helper; proxy không rewrite về loopback trên Vercel. | Adapter và transport SDK/ws thực đã qua kiểm thử local; chưa chạy trên Vercel thật.               |
| Cron và gói tài khoản | `fluid: true`, socket `maxDuration = 300`, rotation sau 270 giây. Cron recovery mỗi ngày. Queue vẫn phục vụ giao nhận bình thường.          | Người dùng xác nhận gói Hobby; lịch đã phù hợp. Chưa nghiệm thu Cron trên project cloud.          |
| Cấu hình production   | Thêm `bun run check:deployment`; Vercel chạy kiểm tra trước build. Chỉ báo tên biến lỗi, không in giá trị/secret.                           | Kiểm tra cú pháp không chứng minh credentials, quyền truy cập hay registry SSO đã đúng.           |
| Preview và luồng thực | Giữ test hồi quy, thêm test adapter, payload, reconnect/cleanup và cấu hình deployment.                                                     | Chưa có preview URL và nghiệm thu hai tài khoản/provider thật; CLI chưa truy cập được API Vercel. |

## Runtime

- Local/self-host vẫn dùng `next dev --port 3030` / `next start`, instrumentation khởi động Hono + `ws` ở loopback. `NEXT_WEBSOCKET_PORT` chỉ áp dụng tại đây.
- Vercel dùng catch-all Route Handler cùng origin cho `/socket/:id/chat`, `/socket/:id/call` và `/socket/:id/token`. `id` là conversation ID; catch-all đặt `maxDuration = 300`. Không mở cổng riêng, không cần dịch vụ Ably hay custom Next server.
- Adapter dùng cùng `createRealtimeApp`: exact Origin, session native, kiểm tra thành viên, quota mỗi instance, heartbeat, kiểm tra lại session và replay cũ. Không cấp quyền chỉ vì handshake thành công.
- SDK dùng `ws`, giới hạn frame 1 KiB. Frame binary và mutation qua socket bị từ chối. HTTP API vẫn là đường ghi dữ liệu.
- Function có thời hạn. Socket chủ động đóng code 1012 sau 270 giây; client có backoff và phục hồi từ dữ liệu bền vững. Chưa chứng minh lifecycle này trên Vercel thật.
- Wakeup trong RAM chỉ tác dụng cùng instance. Instance khác vẫn đọc sequence trong database mỗi giây; không cam kết push tức thì giữa các instance hoặc chi phí database thấp ở tải lớn.

`next.config.ts` giữ mẫu tối giản; không thêm rewrite, cấu hình bundler hoặc launcher. Không cài package hay ghi lockfile trong lần thay đổi này.

## Cấu hình project và domain

1. Chọn project Chat với framework Next.js, root repository hiện tại và Node runtime được Next/Vercel hỗ trợ. Dùng Bun theo `packageManager`. `vercel.json` đã bật Fluid compute.
2. Chọn **origin đầy đủ và ổn định**, ví dụ `https://<ten-project>.vercel.app`, rồi cấu hình `NEXT_PUBLIC_APP_URL` đúng origin này. `.vercel.app` riêng lẻ chưa phải URL cấu hình được.
3. Dùng client production đã đăng ký; SSO phải cho phép chính xác `<origin>/auth/callback/gorth` và logout về origin tương ứng. Không dùng client `-local`, wildcard callback hoặc tự chọn origin từ Host header.
4. Nếu cần đăng nhập ở Preview, dùng alias branch ổn định và cấu hình Preview riêng. Đăng ký callback của alias đó ở SSO trước; URL ngẫu nhiên của từng deployment không tự được chấp nhận.
5. `NEXT_OAUTH_AUDIENCE` là định danh resource đã đăng ký: giữ đúng registry, không tự đổi theo domain deploy. Bảy biến service audience cũng là upstream trong ứng dụng nên phải dùng HTTPS origin có thể truy cập từ Vercel, đồng thời khớp registry/policy SSO.

Thay đổi registry SSO chưa được thực hiện trong nhiệm vụ này. Cần biết domain cụ thể trước khi đề nghị cập nhật callback/resource.

## Biến và dịch vụ bên ngoài

| Nhóm              | Cấu hình cần có                                                                                                                                                                                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Đăng nhập/session | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_AUTH_URL`, `NEXT_OAUTH_CLIENT_ID`, `NEXT_OAUTH_COOKIE_PREFIX`, `NEXT_OAUTH_AUDIENCE`, `NEXT_SESSION_SECRET` ít nhất 32 byte.                                                                                                                                                                           |
| Bảy service       | `NEXT_OAUTH_NOTIFY_AUDIENCE`, `NEXT_OAUTH_RESOURCE_AUDIENCE`, `NEXT_OAUTH_DISCOVERY_AUDIENCE`, `NEXT_OAUTH_PAYMENT_AUDIENCE`, `NEXT_OAUTH_BILLING_AUDIENCE`, `NEXT_OAUTH_MEDIA_AUDIENCE`, `NEXT_OAUTH_INSIGHT_AUDIENCE`; đúng HTTPS origin và client/resource/scope tại SSO.                                                               |
| Database          | `DATABASE_URL` PostgreSQL cloud, migration nghiệp vụ/auth đã áp theo quy trình hiện có; pool nhỏ qua `PG_POOL_MAX`. Không chạy migration trong build.                                                                                                                                                                                      |
| Backend OAuth     | Confidential client hiện có qua `NEXT_OAUTH_CLIENT_ID`, `NEXT_OAUTH_CLIENT_SECRET`, `client_secret_basic`. Cần các scope giao nhận Notification/Discovery/Insight, Media delegate và dispatch mà code đang dùng.                                                                                                                           |
| Upload            | Giữ nguyên `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_BUCKET`. Media cần confidential client có quyền `storage:chat:credential` lấy credentials qua endpoint bảo vệ hiện có. Cấu hình CORS bucket cho origin Chat và upload trực tiếp qua signed URL; không đưa file lớn qua Vercel Function. |
| Queue/Cron        | Queue topic `chat-outbox`, trigger `queue/v2beta`; OIDC do Vercel cung cấp. `CRON_SECRET` ít nhất 32 byte để bảo vệ recovery. Cron chỉ chạy theo lịch ở production.                                                                                                                                                                        |
| Call              | `NEXT_CHAT_ICE_SERVERS_JSON` đúng định dạng. STUN hoặc danh sách rỗng không bảo đảm gọi xuyên NAT; cần TURN đã kiểm chứng trên hai mạng khác nhau. Credential ICE sẽ được cấp cho người dùng call theo luồng hiện có.                                                                                                                      |

Không commit file cấu hình riêng tư. Đặt secret trong đúng environment Preview/Production của project; không gửi qua chat. `VERCEL`/`VERCEL_REGION` do nền tảng cung cấp. Không cần cấu hình cổng WebSocket trên Vercel.

Cron mỗi ngày là watchdog, không bảo đảm recovery trong một phút. Nếu enqueue thất bại và không có mutation thành công tiếp theo, outbox có thể đợi đến lần Cron ngày. Với Pro, thay `schedule` bằng `* * * * *` nếu cần recovery mỗi phút. Không có bước nâng gói tự động.

Local/self-host chạy bằng `next dev/start` dùng worker trong cùng process, đọc outbox Postgres trực tiếp; không gửi Queue cloud và không cần OIDC Vercel. Worker khôi phục pending/lease khi khởi động, gom các wakeup đồng thời và đặt timer theo `available_at`/`lease_until`; database lỗi sẽ retry sau 15 giây. Timer chỉ đánh thức worker, dữ liệu công việc vẫn nằm trong DB. Trên Vercel giữ Queue native và Cron như trên. Chỉ mutation tạo Chat event đã commit mới đánh thức background delivery; proxy tới platform service không tạo job Chat.

HTTP trả `Server-Timing` cho `session`, `identity_db`, `revocation`, `auth`, `actor`, `chat_db`, `total` khi các bước tương ứng chạy. `auth` bao gồm các bước session nên không cộng tất cả số đo lại với nhau. Header chỉ có nhãn và thời gian, không có token/nội dung/URL. Danh sách và chi tiết conversation không polling định kỳ; vẫn refetch khi invalidation, reconnect/focus và mutation. Replay HTTP 15 giây chỉ dùng khi socket không hoạt động.

## Kiểm chứng trước khi phát hành

Kết quả lần sửa này: **273 test / 47 file thường qua; 23 test database cloud qua; TypeScript và build production Turbopack qua**. Cloud suite xác nhận cleanup fixture và schema auth không đổi. Lint không có lỗi; còn một cảnh báo unused import có sẵn tại `tests/identity-cache.test.ts:7`. Build liệt kê đúng hai socket Route Handler. Chạy production build bằng `next start --port 3030` thực tế: cả hai socket qua Next proxy trả 401 khi không có session, 403 khi sai Origin; process kiểm tra đã dừng. Những kết quả này không thay thế nghiệm thu deployment/provider/browser thật.

```sh
bun run check:deployment
bun run test
bun run typecheck
bun run lint
bun run build
bun run test:cloud
```

`check:deployment` chỉ kiểm tra cú pháp và sự hiện diện, không gọi provider. Chạy trên cấu hình local hiện tại sẽ thất bại với localhost/client local và các trường upload/Cron chưa cấu hình; đây không phải bằng chứng về environment trên Vercel. TURN chưa cấu hình chỉ tạo cảnh báo vì nhắn tin không phụ thuộc TURN.

`test:cloud` dùng `vitest.database.config.ts` riêng; chỉ chọn `tests/cloud`, không trộn test thường. Suite tạo/xóa fixture UUID của chính nó, so sánh schema auth trước/sau và giả lập các provider bên ngoài. Không coi suite database là nghiệm thu provider hay browser thật.

Nghiệm thu trên preview sau khi target/cấu hình sẵn sàng:

1. Hai tài khoản đăng nhập/logout qua SSO, callback đúng alias; không hiển thị dữ liệu tài khoản trước.
2. Mở conversation ở hai browser, gửi/nhận/read; đo độ trễ cả cùng instance và khác instance.
3. Ngắt mạng, gửi lại với cùng idempotency key, reconnect/replay; không mất hoặc nhân đôi tin. Giữ socket hơn 270 giây để kiểm tra rotation và tiếp tục nhận.
4. Sai Origin, thiếu session và thành viên đã bị loại phải bị từ chối. Thử thu hồi session khi socket đang mở.
5. Upload thật qua Media/S3, xem/tải attachment đúng quyền; kiểm tra signed URL hết hạn và quyền sau khi bị loại khỏi nhóm.
6. Theo dõi Queue xử lý outbox và retry; gọi recovery có/không có bearer Cron, đối chiếu các delivery sau sự cố. Preview không tự chạy production Cron.
7. Call giữa hai mạng dùng TURN; xác nhận quyền camera/microphone và kết thúc call dừng signaling.

## Nguồn

- [Vercel WebSockets](https://vercel.com/docs/functions/websockets): hỗ trợ WebSocket, Next adapter và yêu cầu Fluid compute.
- [Vercel Cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing): Hobby mỗi ngày, Pro mỗi phút.
- [Vercel Queue quickstart](https://vercel.com/docs/queues/quickstart): trigger và xác thực tự động.
- [Hono WebSocket helper](https://hono.dev/docs/helpers/websocket).
