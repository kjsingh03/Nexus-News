import Express from "express";
import cors from "cors"
import newsRouter from "./router/news.router";
import mongoose from "mongoose";
import { errorHandler } from "./middlewares/ErrorHandler";

const PORT = process.env.PORT

const app = Express();

(async () => {
    await mongoose.connect(process.env.MONGO_URL ?? "")
})()

app.use(cors())
    .use("/news", newsRouter)
    .use(errorHandler as Express.ErrorRequestHandler)

app.listen(PORT, () => {
    console.log(`Server is working at http://localhost:${PORT}`);
})