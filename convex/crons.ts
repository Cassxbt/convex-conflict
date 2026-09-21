import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// 02:00 UTC, after the register's overnight update window.
crons.daily("re-screen unreviewed records against the current matter history", { hourUTC: 2, minuteUTC: 0 }, internal.recheck.sweep);

export default crons;
