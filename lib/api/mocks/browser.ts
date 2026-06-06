import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

/** The browser-side MSW worker that serves the contract fixtures in mock mode. */
export const worker = setupWorker(...handlers);
