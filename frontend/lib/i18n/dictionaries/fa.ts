import type { Dictionary } from "./en";

/** Persian (Farsi) — right-to-left. Used to validate the RTL hero pass. */
export const fa: Partial<Dictionary> = {
  appName: "کلار",
  tagline: "هر نامه‌ی اداری آلمانی را بفهم.",

  nav: {
    letters: "نامه‌ها",
    deadlines: "مهلت‌ها",
    scan: "اسکن",
    documents: "اسناد",
    me: "من",
  },

  letters: {
    title: "نامه‌ها",
    emptyTitle: "هنوز چیزی اینجا نیست.",
    emptyBody:
      "دفعه‌ی بعد که اداره چیزی فرستاد که نمی‌توانی بخوانی، برایم بفرست.",
    nextDeadline: "مهلت بعدی",
  },

  processing: {
    reading: "دارم نامه‌ات را می‌خوانم.",
    ready: "این واقعاً یعنی این.",
  },

  detail: {
    whatYouNeedToDo: "چه کاری باید بکنی",
    deadline: "مهلت",
    remindMe: "یادم بینداز",
    ifYouIgnore: "اگر نادیده‌اش بگیری",
    seeOriginal: "متن اصلی آلمانی را ببین",
    hideOriginal: "پنهان کردن متن اصلی",
    generateReply: "پاسخم را بنویس",
    fillForm: "این فرم را برایم پر کن",
    handled: "کلار. انجام شد.",
    markHandled: "علامت‌گذاری به‌عنوان انجام‌شده",
    confidenceLow: "کاملاً مطمئن نیستم که درست خوانده باشم.",
  },

  paywall: {
    title: "خروجی آماده‌ات را باز کن",
    once: "برای این نامه یک‌بار پرداخت کن",
    subscribe: "بوروکراسی‌فلت",
    confirm: "ادامه به پرداخت",
  },

  output: {
    download: "دانلود",
    share: "اشتراک‌گذاری",
    markSent: "علامت‌گذاری به‌عنوان ارسال‌شده",
  },

  errors: {
    unreadable:
      "نتوانستم آن را واضح بخوانم. با نور خوب عکس واضح‌تری بگیر.",
    offline: "آفلاین هستی. این کار به اینترنت نیاز دارد.",
    generic: "مشکلی پیش آمد. کمی بعد دوباره تلاش کن.",
  },

  common: {
    retry: "دوباره تلاش کن",
    cancel: "لغو",
    back: "بازگشت",
    skip: "رد کردن",
  },
};
