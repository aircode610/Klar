/**
 * English dictionary. This is the canonical key set — every other language is a
 * Partial<Dictionary> and falls back here for any missing key.
 */
export const en = {
  appName: "Klar",
  tagline: "Understand any German official letter.",

  nav: {
    letters: "Letters",
    deadlines: "Deadlines",
    scan: "Scan",
    scanCta: "Scan a letter",
    documents: "Documents",
    me: "Me",
  },

  letters: {
    title: "Letters",
    emptyTitle: "Nothing here yet.",
    emptyBody:
      "Next time the Amt sends something you cannot read, send it to me.",
    nextDeadline: "Next deadline",
    yourNextDeadline: "Your next deadline",
    openThis: "Open this letter",
  },

  home: {
    heading: "Here's what needs you",
    needAction: "Need action",
    overdue: "Overdue",
    handled: "Handled",
    needsAction: "Needs action",
    handledSection: "Handled",
    outstanding: "Outstanding",
  },

  letterCard: {
    toDo: "to do",
    due: "Due",
  },

  categories: {
    health_insurance: "Health insurance",
    other_insurance: "Insurance",
    banking: "Banking",
    tax: "Tax",
    immigration: "Immigration",
    education: "Education",
    housing: "Housing",
    utilities: "Utilities",
    employment: "Employment",
    government_benefits: "Benefits",
    pension: "Pension",
    broadcast_fee: "Broadcast fee",
    civic: "Civic",
    legal_debt: "Legal / debt",
    other: "Other",
  },

  processing: {
    reading: "Reading your letter.",
    ready: "Here is what this actually means.",
  },

  detail: {
    whatYouNeedToDo: "What you need to do",
    deadline: "Deadline",
    remindMe: "Remind me",
    ifYouIgnore: "If you ignore this",
    seeOriginal: "See the original German",
    hideOriginal: "Hide the original",
    generateReply: "Generate my reply",
    fillForm: "Fill this form for me",
    handled: "Klar. Handled.",
    markHandled: "Mark as handled",
    confidenceLow: "I am not fully sure I read this correctly.",
    // Long-form sections (gated behind "Read more"):
    fullExplanation: "Full explanation",
    consequenceTitle: "If you ignore this",
    whyThisRisk: "Why this score",
    checklistTitle: "Bring these documents",
    citationsTitle: "Legal references",
    draftReplyTitle: "Pre-drafted reply (German)",
    readMore: "Read more",
    showLess: "Show less",
  },

  paywall: {
    title: "Unlock your done-for-you output",
    once: "Pay once for this letter",
    subscribe: "Bürokratie-Flat",
    confirm: "Continue to payment",
  },

  output: {
    download: "Download",
    share: "Share",
    markSent: "Mark as sent",
  },

  errors: {
    unreadable:
      "I could not read that one clearly. Try a sharper photo in good light.",
    offline: "You are offline. This needs a connection.",
    generic: "Something went wrong. Try again in a moment.",
  },

  common: {
    retry: "Try again",
    cancel: "Cancel",
    back: "Back",
    skip: "Skip",
  },
};

export type Dictionary = typeof en;
