import Express from "express";
import { createNews } from "../controller/news.controller.js";
import { upload } from "../middlewares/upload.js";

const newsRouter = Express();

newsRouter.post("/", upload.fields([{ name: "thumbnail", maxCount: 1 }, { name: "files", maxCount: 10 }]), createNews)

export default newsRouter