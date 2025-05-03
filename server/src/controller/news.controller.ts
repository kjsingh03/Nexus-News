import { Request, Response } from "express";
import { News } from "../model";
import { timeStamp } from "console";
import { AppError, ValidationError } from "../utils/appErrors";
import mongoose from "mongoose";
import { catchAsync } from "../utils/catchAsyncHandler";

export const createNews = catchAsync(async (req: Request, res: Response) => {
    const newsData = req.body;

    // const news = new News(newsData)
    
    // await news.save()
    
    console.log(req.body,req.files);

    res.json({ success: true, message: "News created successfully", newsData })
})