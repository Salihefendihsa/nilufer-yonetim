import "./instrument"; // Sentry.init — diğer tüm import'lardan ÖNCE (bkz. instrument.ts)
import app from "./app";
import { startRecurringJobsCron, startReminderCrons } from "./lib/cron";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  startRecurringJobsCron();
  startReminderCrons();
});
