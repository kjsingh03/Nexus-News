import { Request, Response } from "express";
import { PinataSDK } from "pinata";
import { File } from "node:buffer";
import { catchAsync } from "./utils/catchAsyncHandler.js";
import { AppError } from "./utils/appErrors.js";

const pinataJwt = process.env.PINATA_JWT;

const gatewayUrl = "https://moccasin-petite-canid-8.mypinata.cloud";

const pinata = new PinataSDK({
    pinataJwt,
    pinataGateway: gatewayUrl
});

export const createNews = catchAsync(async (req: Request, res: Response) => {
    const files = req.files as { thumbnail?: Express.Multer.File[]; files?: Express.Multer.File[] };
    const newsData = req.body;

    if (!pinataJwt) {
        throw new AppError("Pinata JWT not set", 500);
    }

    const mainFileCids: string[] = [];
    if (files.files && files.files.length > 0) {
        for (const file of files.files) {
            const result = await pinata.upload.public.file(new File([file.buffer], file.originalname, { type: file.mimetype }) as any);
            mainFileCids.push(result.cid);
        }
    }

    let thumbnailCid: string | null = null;
    if (files.thumbnail && files.thumbnail.length > 0) {
        const thumbFile = files.thumbnail[0];
        const thumbResult = await pinata.upload.public.file(new File([thumbFile.buffer], thumbFile.originalname, { type: thumbFile.mimetype }) as any);
        thumbnailCid = thumbResult.cid;
    }

    newsData.files = mainFileCids.map((cid) => `${gatewayUrl}/ipfs/${cid}`);
    newsData.thumbnail = thumbnailCid ? `${gatewayUrl}/ipfs/${thumbnailCid}` : null;

    console.log(newsData);

    res.status(201).json({
        success: true,
        message: "News created successfully",
        newsData,
    });
});