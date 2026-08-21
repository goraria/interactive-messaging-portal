import { NextResponse, type NextRequest } from "next/server"

const sharedRoutes = new Set(["/", "/demo", "/lab"])
const appSessionCookie = "gorth.session_app"

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const sessionCookie = request.cookies.get(appSessionCookie)?.value
  const isSharedRoute = sharedRoutes.has(path)
  const isAuthRoute = path.startsWith("/auth/")
  const isAuthMetadataRoute = path.startsWith("/.well-known/")
  const isSharedApiRoute = path === "/demo/call"

  if (path === "/" && sessionCookie) {
    return NextResponse.redirect(new URL("/chat", request.url))
  }

  if (
    !sessionCookie &&
    !isSharedRoute &&
    !isSharedApiRoute &&
    !isAuthRoute &&
    !isAuthMetadataRoute
  ) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    // "/setting/:path*", "/account/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

// import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// const isPublicRoute = createRouteMatcher(['/sign-in(.*)'])

// export default clerkMiddleware(async (auth, req) => {
//   if (!isPublicRoute(req)) {
//     await auth.protect()
//   }
// })

// export const config = {
//   matcher: [
//     // Skip Next.js internals and all static files, unless found in search params
//     '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
//     // Always run for API routes
//     '/(api|trpc)(.*)',
//   ],
// }
