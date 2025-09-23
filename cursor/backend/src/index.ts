import express, { Request, Response } from "express";
import rngRouter from "./routes/rng";

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.send("Backend server is running!");
});

app.use("/rng", rngRouter);

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
