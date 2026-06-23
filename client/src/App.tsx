/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { Suspense, lazy } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

// Critical pages loaded immediately
import Home from "./pages/Home";
import Landing from "./pages/Landing";

// Lazy load all other pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Generate = lazy(() => import("./pages/Generate"));
const Posts = lazy(() => import("./pages/Posts"));
const Settings = lazy(() => import("./pages/Settings"));
const Coach = lazy(() => import("./pages/Coach"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const CookiePolicy = lazy(() => import("./pages/CookiePolicy"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const FAQ = lazy(() => import("@/pages/FAQ"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const Contact = lazy(() => import("./pages/Contact"));
const BlogAdmin = lazy(() => import("./pages/BlogAdmin"));
const Trends = lazy(() => import("./pages/Trends"));
const VoiceTraining = lazy(() => import("./pages/VoiceTraining"));
const AuroraDemo = lazy(() => import("./pages/AuroraDemo"));
const SubscriptionSuccess = lazy(() => import("./pages/SubscriptionSuccess"));
const SubscriptionCancel = lazy(() => import("./pages/SubscriptionCancel"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const Examples = lazy(() => import("./pages/Examples"));
const ContentCalendar = lazy(() => import("./pages/ContentCalendar"));
const BestTime = lazy(() => import("./pages/BestTime"));
const ContentRepurpose = lazy(() => import("./pages/ContentRepurpose"));
const TelegramBot = lazy(() => import("./pages/TelegramBot"));
const TelegramPosts = lazy(() => import("./pages/TelegramPosts"));
const CompetitorRadar = lazy(() => import("./pages/CompetitorRadar"));
const ContentSeries = lazy(() => import("./pages/ContentSeries"));
const ABTesting = lazy(() => import("./pages/ABTesting"));
const WeeklyReport = lazy(() => import("./pages/WeeklyReport"));
const EngagementHelper = lazy(() => import("./pages/EngagementHelper"));
const IdeaBank = lazy(() => import("./pages/IdeaBank"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Pricing = lazy(() => import("./pages/Pricing").then(m => ({ default: m.Pricing })));
const BillingPage = lazy(() => import("./pages/Billing").then(m => ({ default: m.BillingPage })));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess").then(m => ({ default: m.PaymentSuccess })));
const PaymentFailure = lazy(() => import("./pages/PaymentFailure"));
const PaymentCancel = lazy(() => import("./pages/PaymentCancel").then(m => ({ default: m.PaymentCancel })));
const LoginPage = lazy(() => import("./pages/Login").then(m => ({ default: m.LoginPage })));
const Analytics = lazy(() => import("./pages/Analytics").then(m => ({ default: m.Analytics })));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const MemberMonitoring = lazy(() => import("./pages/MemberMonitoring"));
const Progress = lazy(() => import("./pages/Progress"));
const Profile = lazy(() => import("./pages/Profile"));
const AdminMonitoring = lazy(() => import("./pages/AdminMonitoring"));
const UsersManagement = lazy(() => import("./pages/UsersManagement").then(m => ({ default: m.UsersManagement })));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard").then(m => ({ default: m.AdminDashboard })));
const SupportTickets = lazy(() => import("./pages/SupportTickets").then(m => ({ default: m.SupportTickets })));
const AdminSupport = lazy(() => import("./pages/AdminSupport").then(m => ({ default: m.AdminSupport })));
const AdminHub = lazy(() => import("./pages/AdminHub").then(m => ({ default: m.AdminHub })));

import CookieConsent from "@/components/CookieConsent";
import OpenAIConsentBanner from "@/components/OpenAIConsentBanner";
import PageLayout from "@/components/PageLayout";

// Loading component for lazy-loaded routes
function RouteLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Suspense fallback={<RouteLoader />}>
      <Switch>
        <Route path={"/login"} component={LoginPage} />
        <Route path={"/"} component={Home} />
        <Route path={"/landing"} component={Landing} />
        <Route path={"/aurora"} component={AuroraDemo} />
        <Route path={"/dashboard"} component={Dashboard} />
        <Route path={"/generate"} component={Generate} />
        <Route path={"/posts"} component={Posts} />
        <Route path={"/coach"} component={Coach} />
        <Route path={"/settings"} component={Settings} />
        <Route path={"/privacy-policy"} component={PrivacyPolicy} />
        <Route path={"/terms-of-service"} component={TermsOfService} />
        <Route path={"/privacy"} component={Privacy} />
        <Route path={"/terms"} component={Terms} />
        <Route path={"/cookie-policy"} component={CookiePolicy} />
        <Route path={"/about-us"} component={AboutUs} />
        <Route path={"/faq"} component={FAQ} />
        <Route path={"/blog"} component={Blog} />
        <Route path={"/blog/:slug"} component={BlogPost} />
        <Route path={"/account-settings"} component={AccountSettings} />
        <Route path={"/contact"} component={Contact} />
        <Route path={"/admin/blog"} component={BlogAdmin} />
        <Route path={"/trends"} component={Trends} />
        <Route path={"/voice-training"} component={VoiceTraining} />
        <Route path={"/subscription/success"} component={SubscriptionSuccess} />
        <Route path={"/subscription/cancel"} component={SubscriptionCancel} />
        <Route path={"/admin/analytics"} component={AdminAnalytics} />
        <Route path={"/admin/settings"} component={AdminSettings} />
        <Route path={"/admin/members"} component={MemberMonitoring} />
        <Route path={"/examples"} component={Examples} />
        <Route path={"/kalender"} component={Calendar} />
        <Route path={"/kalender-old"} component={ContentCalendar} />
        <Route path={"/best-time"} component={BestTime} />
        <Route path={"/pricing"} component={Pricing} />
        <Route path={"/settings/billing"} component={BillingPage} />
        <Route path={"/payment/success"} component={PaymentSuccess} />
        <Route path={"/payment/failure"} component={PaymentFailure} />
        <Route path={"/payment/cancel"} component={PaymentCancel} />
        <Route path={"/admin/analytics"} component={Analytics} />
        <Route path={"/progress"} component={Progress} />
        <Route path={"/profile"} component={Profile} />
        <Route path="/admin/monitoring" component={AdminMonitoring} />
        <Route path="/admin/dashboard" component={AdminDashboard} />
        <Route path="/admin/users" component={UsersManagement} />
        <Route path="/support/tickets" component={SupportTickets} />
        <Route path="/admin/support" component={AdminSupport} />
        <Route path="/admin" component={AdminHub} />
        <Route path={"/repurpose"} component={ContentRepurpose} />
        <Route path={"/telegram-bot"} component={TelegramBot} />
        <Route path={"/telegram-posts"} component={TelegramPosts} />
        <Route path={"/competitor-radar"} component={CompetitorRadar} />
        <Route path={"/content-series"} component={ContentSeries} />
        <Route path={"/ab-testing"} component={ABTesting} />
        <Route path={"/weekly-report"} component={WeeklyReport} />
        <Route path={"/engagement-helper"} component={EngagementHelper} />
        <Route path={"/idea-bank"} component={IdeaBank} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <CookieConsent />
          <OpenAIConsentBanner />
          <PageLayout>
            <Router />
          </PageLayout>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;