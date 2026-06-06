import type { Dictionary } from "./en";

/** German — a touch more formal in tone, per the brand voice rules. */
export const de: Partial<Dictionary> = {
  appName: "Klar",
  tagline: "Verstehe jeden deutschen Behördenbrief.",

  nav: {
    letters: "Briefe",
    deadlines: "Fristen",
    scan: "Scannen",
    scanCta: "Brief scannen",
    documents: "Dokumente",
    me: "Ich",
  },

  letters: {
    title: "Briefe",
    emptyTitle: "Noch nichts hier.",
    emptyBody:
      "Wenn das Amt das nächste Mal etwas Unverständliches schickt, schick es mir.",
    nextDeadline: "Nächste Frist",
    yourNextDeadline: "Deine nächste Frist",
    openThis: "Diesen Brief öffnen",
  },

  home: {
    heading: "Das wartet auf dich",
    needAction: "Zu erledigen",
    overdue: "Überfällig",
    handled: "Erledigt",
    needsAction: "Zu erledigen",
    handledSection: "Erledigt",
    outstanding: "Offener Betrag",
  },

  letterCard: {
    toDo: "offen",
    due: "Fällig",
  },

  categories: {
    health_insurance: "Krankenversicherung",
    other_insurance: "Versicherung",
    banking: "Bank",
    tax: "Steuern",
    immigration: "Aufenthalt",
    education: "Bildung",
    housing: "Wohnen",
    utilities: "Versorgung",
    employment: "Arbeit",
    government_benefits: "Sozialleistungen",
    pension: "Rente",
    broadcast_fee: "Rundfunkbeitrag",
    civic: "Behörden",
    legal_debt: "Recht / Inkasso",
    other: "Sonstiges",
  },

  processing: {
    reading: "Ich lese deinen Brief.",
    ready: "Das bedeutet er wirklich.",
  },

  detail: {
    whatYouNeedToDo: "Was du tun musst",
    deadline: "Frist",
    remindMe: "Erinnere mich",
    ifYouIgnore: "Wenn du das ignorierst",
    seeOriginal: "Das deutsche Original ansehen",
    hideOriginal: "Original ausblenden",
    generateReply: "Antwort erstellen",
    fillForm: "Formular für mich ausfüllen",
    handled: "Klar. Erledigt.",
    markHandled: "Als erledigt markieren",
    confidenceLow: "Ich bin nicht ganz sicher, ob ich das richtig gelesen habe.",
    fullExplanation: "Ausführliche Erklärung",
    consequenceTitle: "Wenn du das ignorierst",
    whyThisRisk: "Warum diese Einstufung",
    checklistTitle: "Diese Unterlagen mitbringen",
    citationsTitle: "Rechtsgrundlagen",
    draftReplyTitle: "Vorgefertigte Antwort (Deutsch)",
    readMore: "Mehr anzeigen",
    showLess: "Weniger anzeigen",
  },

  paywall: {
    title: "Schalte deine fertige Lösung frei",
    once: "Einmalig für diesen Brief zahlen",
    subscribe: "Bürokratie-Flat",
    confirm: "Weiter zur Zahlung",
  },

  output: {
    download: "Herunterladen",
    share: "Teilen",
    markSent: "Als gesendet markieren",
  },

  errors: {
    unreadable:
      "Das konnte ich nicht klar lesen. Versuch ein schärferes Foto bei gutem Licht.",
    offline: "Du bist offline. Dafür brauchst du eine Verbindung.",
    generic: "Etwas ist schiefgelaufen. Versuch es gleich noch einmal.",
  },

  common: {
    retry: "Erneut versuchen",
    cancel: "Abbrechen",
    back: "Zurück",
    skip: "Überspringen",
  },
};
