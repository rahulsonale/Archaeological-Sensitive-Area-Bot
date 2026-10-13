import express from "express";
import cors from "cors";
import { router } from "./routes";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "archaeological-sensitive-area-bot" });
});

app.use("/api", router);

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`Bot server listening at http://localhost:${port}`);
});
