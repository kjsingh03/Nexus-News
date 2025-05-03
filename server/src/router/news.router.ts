import { Router } from "express";
import { createNews } from "../news.controller.js";
import { upload } from "../middlewares/upload.js";

const newsRouter = Router();

newsRouter.post("/", upload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "files", maxCount: 10 }
]), createNews);

newsRouter.get("/", (req, res) => {
    res.json({ msg: "News route is working" });
});


export default newsRouter;
