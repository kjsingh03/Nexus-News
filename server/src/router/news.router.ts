import { Router } from "express";
import { createNews, getNews } from "../controller/news.controller.js";
import { upload } from "../middlewares/upload.js";

const newsRouter = Router();

newsRouter.post("/", upload.fields([{ name: "thumbnail", maxCount: 1 }, { name: "files", maxCount: 10 }]), createNews);

newsRouter.get("/", getNews);


export default newsRouter;
