import type { Dictionary } from "./en";

/** German — a touch more formal in tone, per the brand voice rules. */
export const de: Partial<Dictionary> = {
  appName: "Klar",
  tagline: "Verstehe jeden deutschen Behördenbrief.",

  nav: {
    letters: "Briefe",
    deadlines: "Fristen",
    scan: "Scannen",
    documents: "Dokumente",
    me: "Ich",
  },

  letters: {
    title: "Briefe",
    emptyTitle: "Noch nichts hier.",
    emptyBody:
      "Wenn das Amt das nächste Mal etwas Unverständliches schickt, schick es mir.",
    nextDeadline: "Nächste Frist",
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
