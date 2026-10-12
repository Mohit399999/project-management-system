import "dotenv/config"; 
import app from "./app.js";
import connectDB from "./db/index.js";

const port = process.env.PORT || 3000;
let server;

connectDB()
  .then(() => {
    server = app.listen(port, () => {
      console.log(`app listening on port http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error ", err);
    process.exit(1);
  });


const shutdown = (code) => {
  if (server) server.close(() => process.exit(code));
  else process.exit(code);
  setTimeout(() => process.exit(code), 10000).unref(); // force exit after 10s
};

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  shutdown(1);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  shutdown(1);
});
process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));