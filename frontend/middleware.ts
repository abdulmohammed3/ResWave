import { authMiddleware } from "@clerk/nextjs";
 
// This example protects all routes including api/trpc routes
// Please edit this to allow other routes to be public as needed.
// See https://clerk.com/docs/references/nextjs/auth-middleware for more information about configuring your Middleware
export default authMiddleware({
  // Routes that can be accessed while signed out
  publicRoutes: [
    "/",
    "/pricing",
    "/api/webhook/clerk",
    "/sign-in",
    "/sign-up",
  ],
  // Routes that can always be accessed, and have
  // no authentication information
  ignoredRoutes: [
    "/api/webhooks/clerk",
  ],
});
 
export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};