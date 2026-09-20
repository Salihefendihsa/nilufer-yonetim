import "dotenv/config";
import app from "./app";
import { startRecurringJobsCron, startReminderCrons } from "./lib/cron";
import { initErrorReporting } from "./lib/errorReporting";

initErrorReporting();

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  startRecurringJobsCron();
  startReminderCrons();
});
