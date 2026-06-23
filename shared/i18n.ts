/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

/**
 * Internationalization (i18n) for Norwegian Bokmål and English
 * This file contains all UI text translations for the application
 */

export type Language = "no" | "en";

export const translations = {
  no: {
    // Common
    loading: "Laster...",
    save: "Lagre",
    cancel: "Avbryt",
    delete: "Slett",
    edit: "Rediger",
    copy: "Kopier",
    close: "Lukk",
    back: "Tilbake",
    next: "Neste",
    submit: "Send inn",
    error: "Feil",
    success: "Suksess",
    
    // Auth
    login: "Logg inn",
    logout: "Logg ut",
    signup: "Registrer deg",
    email: "E-post",
    password: "Passord",
    forgotPassword: "Glemt passord?",
    
    // Navigation
    home: "Hjem",
    dashboard: "Dashbord",
    generate: "Generer",
    myPosts: "Mine innlegg",
    voiceTraining: "Stemmetrening",
    subscription: "Abonnement",
    settings: "Innstillinger",
    
    // Landing Page
    heroTitle: "Skap profesjonelt innhold på sekunder",
    heroSubtitle: "Med din egen stemme",
    heroDescription: "Innlegg er din AI-drevne innholdsassistent som hjelper deg med å transformere råe ideer til profesjonelle innlegg klare for sosiale medier.",
    getStarted: "Kom i gang gratis",
    learnMore: "Lær mer",
    
    // Features
    featuresTitle: "Hvorfor Innlegg?",
    feature1Title: "Smart innholdsgenerering",
    feature1Description: "Konverter ideer til profesjonelle innlegg for LinkedIn, Twitter, Instagram og Facebook.",
    feature2Title: "Din egen stemme",
    feature2Description: "Tren assistenten på dine egne skriveeksempler for personlig tone.",
    feature3Title: "Spar tid",
    feature3Description: "Generer innhold på sekunder, ikke timer.",
    
    // Pricing
    pricingTitle: "Enkel prising",
    freeTrial: "Gratis prøveperiode",
    freeTrialDescription: "5 gratis innlegg uten kredittkort",
    monthlyPlan: "Månedlig abonnement",
    monthlyPlanPrice: "199 kr/måned",
    monthlyPlanDescription: "100 innlegg per måned",
    subscribe: "Abonner nå",
    
    // Generator
    generateTitle: "Generer nytt innlegg",
    rawIdea: "Din idé eller råtekst",
    rawIdeaPlaceholder: "Skriv inn ideen din her...",
    selectPlatform: "Velg plattform",
    selectTone: "Velg tone",
    generateButton: "Generer innlegg",
    generatedContent: "Generert innhold",
    copyToClipboard: "Kopier til utklippstavle",
    copiedSuccess: "Kopiert!",
    
    // Platforms
    linkedin: "LinkedIn",
    twitter: "Twitter/X",
    instagram: "Instagram",
    facebook: "Facebook",
    
    // Tones
    professional: "Profesjonell",
    friendly: "Vennlig",
    motivational: "Motiverende",
    educational: "Pedagogisk",
    
    // Dashboard
    dashboardTitle: "Velkommen tilbake",
    recentPosts: "Nylige innlegg",
    postsGenerated: "Innlegg generert",
    postsRemaining: "Innlegg gjenstående",
    noPostsYet: "Ingen innlegg ennå",
    createFirstPost: "Opprett ditt første innlegg",
    
    // Voice Training
    voiceTrainingTitle: "Tren din stemme",
    voiceTrainingDescription: "Legg til eksempler på din egen skriving slik at AI kan lære din unike stil og tone.",
    addSample: "Legg til eksempel",
    sampleText: "Eksempeltekst",
    samplePlaceholder: "Lim inn et eksempel på din egen skriving...",
    yourSamples: "Dine eksempler",
    noSamplesYet: "Ingen eksempler ennå",
    
    // Subscription
    subscriptionTitle: "Ditt abonnement",
    currentPlan: "Nåværende plan",
    trialStatus: "Gratis prøveperiode",
    activeStatus: "Aktiv",
    cancelledStatus: "Kansellert",
    expiredStatus: "Utløpt",
    upgradeNow: "Oppgrader nå",
    manageSubscription: "Administrer abonnement",
    payWithVipps: "Betal med Vipps",
    
    // Settings
    settingsTitle: "Innstillinger",
    language: "Språk",
    norwegian: "Norsk",
    english: "English",
    profile: "Profil",
    name: "Navn",
    
    // Errors
    errorGeneral: "Noe gikk galt. Vennligst prøv igjen.",
    errorAuth: "Autentiseringsfeil. Vennligst logg inn igjen.",
    errorNetwork: "Nettverksfeil. Sjekk internettforbindelsen din.",
    errorLimit: "Du har nådd grensen for gratis innlegg. Vennligst oppgrader.",
    
    // Success messages
    postGenerated: "Innlegg generert!",
    postSaved: "Innlegg lagret!",
    postDeleted: "Innlegg slettet!",
    sampleAdded: "Eksempel lagt til!",
    settingsUpdated: "Innstillinger oppdatert!",
  },
  
  en: {
    // Common
    loading: "Loading...",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    copy: "Copy",
    close: "Close",
    back: "Back",
    next: "Next",
    submit: "Submit",
    error: "Error",
    success: "Success",
    
    // Auth
    login: "Log in",
    logout: "Log out",
    signup: "Sign up",
    email: "Email",
    password: "Password",
    forgotPassword: "Forgot password?",
    
    // Navigation
    home: "Home",
    dashboard: "Dashboard",
    generate: "Generate",
    myPosts: "My Posts",
    voiceTraining: "Voice Training",
    subscription: "Subscription",
    settings: "Settings",
    
    // Landing Page
    heroTitle: "Create professional content in seconds",
    heroSubtitle: "With your own voice",
    heroDescription: "Innlegg is your AI-powered content assistant that helps you transform raw ideas into professional posts ready for social media.",
    getStarted: "Get started free",
    learnMore: "Learn more",
    
    // Features
    featuresTitle: "Why Innlegg?",
    feature1Title: "Smart content generation",
    feature1Description: "Convert ideas into professional posts for LinkedIn, Twitter, Instagram, and Facebook.",
    feature2Title: "Your own voice",
    feature2Description: "Train the assistant on your own writing examples for a personal tone.",
    feature3Title: "Save time",
    feature3Description: "Generate content in seconds, not hours.",
    
    // Pricing
    pricingTitle: "Simple pricing",
    freeTrial: "Free trial",
    freeTrialDescription: "5 free posts without credit card",
    monthlyPlan: "Monthly subscription",
    monthlyPlanPrice: "199 NOK/month",
    monthlyPlanDescription: "100 posts per month",
    subscribe: "Subscribe now",
    
    // Generator
    generateTitle: "Generate new post",
    rawIdea: "Your idea or raw text",
    rawIdeaPlaceholder: "Enter your idea here...",
    selectPlatform: "Select platform",
    selectTone: "Select tone",
    generateButton: "Generate post",
    generatedContent: "Generated content",
    copyToClipboard: "Copy to clipboard",
    copiedSuccess: "Copied!",
    
    // Platforms
    linkedin: "LinkedIn",
    twitter: "Twitter/X",
    instagram: "Instagram",
    facebook: "Facebook",
    
    // Tones
    professional: "Professional",
    friendly: "Friendly",
    motivational: "Motivational",
    educational: "Educational",
    
    // Dashboard
    dashboardTitle: "Welcome back",
    recentPosts: "Recent posts",
    postsGenerated: "Posts generated",
    postsRemaining: "Posts remaining",
    noPostsYet: "No posts yet",
    createFirstPost: "Create your first post",
    
    // Voice Training
    voiceTrainingTitle: "Train your voice",
    voiceTrainingDescription: "Add examples of your own writing so the AI can learn your unique style and tone.",
    addSample: "Add sample",
    sampleText: "Sample text",
    samplePlaceholder: "Paste an example of your own writing...",
    yourSamples: "Your samples",
    noSamplesYet: "No samples yet",
    
    // Subscription
    subscriptionTitle: "Your subscription",
    currentPlan: "Current plan",
    trialStatus: "Free trial",
    activeStatus: "Active",
    cancelledStatus: "Cancelled",
    expiredStatus: "Expired",
    upgradeNow: "Upgrade now",
    manageSubscription: "Manage subscription",
    payWithVipps: "Pay with Vipps",
    
    // Settings
    settingsTitle: "Settings",
    language: "Language",
    norwegian: "Norwegian",
    english: "English",
    profile: "Profile",
    name: "Name",
    
    // Errors
    errorGeneral: "Something went wrong. Please try again.",
    errorAuth: "Authentication error. Please log in again.",
    errorNetwork: "Network error. Check your internet connection.",
    errorLimit: "You've reached the free post limit. Please upgrade.",
    
    // Success messages
    postGenerated: "Post generated!",
    postSaved: "Post saved!",
    postDeleted: "Post deleted!",
    sampleAdded: "Sample added!",
    settingsUpdated: "Settings updated!",
  },
};

export function t(lang: Language, key: keyof typeof translations.no): string {
  return translations[lang][key] || key;
}