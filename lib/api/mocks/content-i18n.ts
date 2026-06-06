import type { Lang, Letter } from "@/types";

/**
 * Mock-side content localization. The real backend is meant to localize
 * human-readable fields from the request's ?lang= — this emulates that so the
 * multilingual feature is demonstrable in mock mode.
 *
 * Translated: summary + each action's title/description/steps. NOT translated:
 * institution and document_type (German proper nouns) and evidence_span (the
 * exact German source quote — it must stay verbatim). de + fa are provided;
 * other languages fall back to the English base.
 */

interface ActionT {
  title?: string;
  description?: string;
  steps?: string[];
}
interface LetterT {
  summary: string;
  actions: ActionT[];
}

// Seed ids + the "fresh" upload share these keys.
type Key =
  | "ltr_strafzettel"
  | "ltr_rundfunk"
  | "ltr_jobcenter"
  | "ltr_auslander"
  | "ltr_finanzamt"
  | "ltr_krankenkasse"
  | "ltr_anmeldung"
  | "fresh";

const DE: Record<Key, LetterT> = {
  ltr_strafzettel: {
    summary:
      "Ein Bußgeld von 60 €. Die Einspruchsfrist ist bereits seit zwei Tagen abgelaufen – handle jetzt, um die Kosten gering zu halten.",
    actions: [
      {
        title: "Die 60 € zahlen oder Einspruch einlegen",
        description:
          "Die zweiwöchige Einspruchsfrist ist abgelaufen. Wer jetzt zahlt, vermeidet Mahngebühren und Vollstreckung.",
        steps: [
          "Entscheiden: zahlen (60 €) oder das Bußgeld anfechten",
          "Bei Anfechtung Akteneinsicht (Messprotokoll) verlangen",
          "Über das Aktenzeichen zahlen, um weitere Gebühren zu stoppen",
        ],
      },
    ],
  },
  ltr_rundfunk: {
    summary:
      "Der Beitragsservice fordert 110,40 € ausstehende Rundfunkbeiträge. Wer BAföG bezieht, kann sich befreien lassen.",
    actions: [
      {
        title: "110,40 € zahlen oder Befreiung beantragen",
        description:
          "Studierende mit BAföG können sich vom Rundfunkbeitrag befreien lassen.",
        steps: [
          "Prüfen, ob du Anspruch auf Befreiung hast (z. B. BAföG)",
          "Befreiungsantrag mit Nachweis einreichen",
          "Andernfalls 110,40 € auf das angegebene Konto überweisen",
        ],
      },
    ],
  },
  ltr_jobcenter: {
    summary:
      "Das Jobcenter benötigt drei Unterlagen von dir, damit deine Leistungen weiterlaufen. Reiche sie innerhalb der Woche ein.",
    actions: [
      {
        title: "Mietbescheinigung, Kontoauszüge und Verdienstbescheinigung einreichen",
        description: "Erforderlich, um deine Leistungen weiter zu bearbeiten.",
        steps: [
          "Aktuelle Mietbescheinigung vom Vermieter holen",
          "Kontoauszüge der letzten drei Monate herunterladen",
          "Aktuelle Verdienstbescheinigung beilegen",
          "Alles mit deiner BG-Nummer hochladen oder per Post senden",
        ],
      },
    ],
  },
  ltr_auslander: {
    summary:
      "Dein Aufenthaltstitel läuft bald ab. Die Ausländerbehörde hat dir einen Termin zur Verlängerung gegeben – bring die genannten Unterlagen mit.",
    actions: [
      {
        title: "Mit allen Unterlagen zum Termin erscheinen",
        description:
          "Wenn du das verpasst, riskierst du eine Lücke in deinem legalen Aufenthaltsstatus.",
        steps: [
          "Gültiger Reisepass",
          "Immatrikulationsbescheinigung",
          "Nachweis der Krankenversicherung",
          "Sperrkonto-Nachweis (Finanzierungsnachweis)",
          "Aktuelles biometrisches Foto",
        ],
      },
    ],
  },
  ltr_finanzamt: {
    summary:
      "Das Finanzamt hat 412 € für 2024 festgesetzt. Du kannst innerhalb eines Monats Einspruch einlegen, falls die Zahlen falsch sind.",
    actions: [
      {
        title: "412 € zahlen oder Einspruch einlegen",
        steps: [
          "Den Bescheid mit deinen Unterlagen abgleichen",
          "Bei Fehlern innerhalb eines Monats schriftlich Einspruch einlegen",
          "Andernfalls 412 € fristgerecht zahlen",
        ],
      },
    ],
  },
  ltr_krankenkasse: {
    summary:
      "Deine Krankenkasse hat deinen Monatsbeitrag neu berechnet. Ist dein Einkommen gesunken, kannst du Widerspruch einlegen und ihn senken lassen.",
    actions: [
      {
        title: "Den neuen Beitrag akzeptieren oder mit Einkommensnachweis widersprechen",
        steps: [
          "Den neuen Betrag mit deinem aktuellen Einkommen vergleichen",
          "Wenn niedriger, innerhalb eines Monats Widerspruch mit Nachweis senden",
        ],
      },
    ],
  },
  ltr_anmeldung: {
    summary:
      "Das ist deine Anmeldebestätigung – der Nachweis, dass du offiziell unter deiner Adresse gemeldet bist. Gut aufbewahren.",
    actions: [
      {
        title: "Eine Kopie für deine Unterlagen speichern",
        steps: ["Eine digitale und eine Papierkopie aufbewahren"],
      },
    ],
  },
  fresh: {
    summary:
      "Der Ausländerbehörde fehlen Unterlagen aus deiner Aufenthaltsakte; sie sollen innerhalb von 14 Tagen nachgereicht werden.",
    actions: [
      {
        title: "Die fehlenden Unterlagen innerhalb von 14 Tagen einreichen",
        description: "Dein Antrag ruht, bis diese eingehen.",
        steps: [
          "Aktuelle Immatrikulationsbescheinigung",
          "Nachweis der Krankenversicherung",
          "Sperrkonto-Nachweis",
        ],
      },
    ],
  },
};

const FA: Record<Key, LetterT> = {
  ltr_strafzettel: {
    summary:
      "یک جریمه‌ی پارک ۶۰ یورویی. مهلت اعتراض دو روز پیش تمام شده — همین حالا اقدام کن تا هزینه بیشتر نشود.",
    actions: [
      {
        title: "۶۰ یورو را بپرداز یا اعتراض ثبت کن",
        description:
          "مهلت دو هفته‌ای اعتراض گذشته است. پرداخت فوری از جریمه‌ی دیرکرد و اجرائیات جلوگیری می‌کند.",
        steps: [
          "تصمیم بگیر: پرداخت (۶۰ یورو) یا اعتراض به جریمه",
          "در صورت اعتراض، درخواست دسترسی به پرونده (صورت‌جلسه‌ی اندازه‌گیری) بده",
          "با شماره‌ی پرونده پرداخت کن تا هزینه‌های بیشتر متوقف شود",
        ],
      },
    ],
  },
  ltr_rundfunk: {
    summary:
      "سرویس حق پخش ۱۱۰٫۴۰ یورو هزینه‌ی معوق رادیو/تلویزیون می‌خواهد. اگر BAföG می‌گیری می‌توانی درخواست معافیت بدهی.",
    actions: [
      {
        title: "۱۱۰٫۴۰ یورو بپرداز یا درخواست معافیت بده",
        description: "دانشجویانی که BAföG می‌گیرند می‌توانند از حق پخش معاف شوند.",
        steps: [
          "بررسی کن که آیا واجد شرایط معافیت هستی (مثلاً BAföG)",
          "درخواست معافیت را همراه مدرک ارسال کن",
          "در غیر این صورت ۱۱۰٫۴۰ یورو به حساب اعلام‌شده واریز کن",
        ],
      },
    ],
  },
  ltr_jobcenter: {
    summary:
      "اداره‌ی کار به سه مدرک از تو نیاز دارد تا کمک‌هزینه‌ات ادامه یابد. ظرف یک هفته ارسالشان کن.",
    actions: [
      {
        title: "گواهی اجاره، صورت‌حساب بانکی و گواهی درآمد را ارسال کن",
        description: "برای ادامه‌ی بررسی کمک‌هزینه‌ات لازم است.",
        steps: [
          "گواهی اجاره‌ی جدید از صاحبخانه بگیر",
          "صورت‌حساب سه ماه اخیر بانک را دانلود کن",
          "آخرین گواهی درآمد را اضافه کن",
          "همه را با شماره‌ی پرونده‌ات (BG-Nummer) بارگذاری یا پست کن",
        ],
      },
    ],
  },
  ltr_auslander: {
    summary:
      "اجازه‌ی اقامتت به‌زودی منقضی می‌شود. اداره‌ی اتباع خارجی برای تمدید به تو وقت داده — مدارک خواسته‌شده را بیاور.",
    actions: [
      {
        title: "با همه‌ی مدارک در قرار حاضر شو",
        description: "از دست دادن این قرار خطر ایجاد وقفه در اقامت قانونی‌ات را دارد.",
        steps: [
          "گذرنامه‌ی معتبر",
          "گواهی ثبت‌نام دانشگاه",
          "مدرک بیمه‌ی درمانی",
          "صورت‌حساب حساب مسدود (Sperrkonto)",
          "عکس بیومتریک جدید",
        ],
      },
    ],
  },
  ltr_finanzamt: {
    summary:
      "اداره‌ی مالیات برای سال ۲۰۲۴ مبلغ ۴۱۲ یورو تعیین کرده است. اگر ارقام اشتباه است می‌توانی ظرف یک ماه اعتراض کنی.",
    actions: [
      {
        title: "۴۱۲ یورو بپرداز یا اعتراض (Einspruch) ثبت کن",
        steps: [
          "برگه‌ی تعیین مالیات را با اسناد خودت مقایسه کن",
          "در صورت اشتباه، ظرف یک ماه به‌صورت کتبی اعتراض کن",
          "در غیر این صورت ۴۱۲ یورو را سر موعد بپرداز",
        ],
      },
    ],
  },
  ltr_krankenkasse: {
    summary:
      "بیمه‌ی درمانی‌ات حق بیمه‌ی ماهانه را دوباره محاسبه کرده است. اگر درآمدت کم شده می‌توانی اعتراض کنی تا کاهش یابد.",
    actions: [
      {
        title: "حق بیمه‌ی جدید را بپذیر یا با مدرک درآمد اعتراض کن",
        steps: [
          "مبلغ جدید را با درآمد فعلی‌ات مقایسه کن",
          "اگر کمتر است، ظرف یک ماه اعتراض همراه مدرک بفرست",
        ],
      },
    ],
  },
  ltr_anmeldung: {
    summary:
      "این تأییدیه‌ی ثبت محل سکونت توست — سندی که نشان می‌دهد رسماً در آدرست ثبت شده‌ای. آن را خوب نگه دار.",
    actions: [
      {
        title: "یک نسخه برای بایگانی خودت ذخیره کن",
        steps: ["یک نسخه‌ی دیجیتال و یک نسخه‌ی کاغذی نگه دار"],
      },
    ],
  },
  fresh: {
    summary:
      "اداره‌ی اتباع خارجی مدارکی از پرونده‌ی اقامتت کم دارد و آن‌ها را ظرف ۱۴ روز می‌خواهد.",
    actions: [
      {
        title: "مدارک ناقص را ظرف ۱۴ روز ارسال کن",
        description: "تا رسیدن این مدارک، درخواستت متوقف است.",
        steps: [
          "گواهی ثبت‌نام دانشگاه (جدید)",
          "مدرک بیمه‌ی درمانی",
          "صورت‌حساب حساب مسدود",
        ],
      },
    ],
  },
};

const TABLES: Partial<Record<Lang, Record<Key, LetterT>>> = { de: DE, fa: FA };

function keyFor(letterId: string): Key {
  return letterId.startsWith("ltr_upload_") ? "fresh" : (letterId as Key);
}

/** Localize a letter's human-readable fields for the given language. */
export function localizeLetter(letter: Letter, lang: Lang): Letter {
  const table = TABLES[lang];
  if (!table) return letter;
  const t = table[keyFor(letter.id)];
  if (!t) return letter;
  return {
    ...letter,
    summary_en: t.summary,
    actions: letter.actions.map((a, i) => {
      const at = t.actions[i];
      if (!at) return a;
      return {
        ...a,
        title: at.title ?? a.title,
        description: at.description ?? a.description,
        steps: at.steps ?? a.steps,
      };
    }),
  };
}

/** Localized title for a single action row (GET /actions). */
export function localizeActionTitle(
  letterId: string,
  index: number,
  fallback: string,
  lang: Lang,
): string {
  return TABLES[lang]?.[keyFor(letterId)]?.actions[index]?.title ?? fallback;
}
