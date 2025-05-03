import { Request, Response } from "express";
import { PinataSDK } from "pinata-web3";
import { File } from "node:buffer";
import { catchAsync } from "../utils/catchAsyncHandler.js";
import { AppError } from "../utils/appErrors.js";

export const createNews = catchAsync(async (req: Request, res: Response) => {
    const files = req.files as { thumbnail?: Express.Multer.File[]; files?: Express.Multer.File[] };
    const newsData = req.body;

    const pinataApiKey = process.env.PINATA_JWT;
    if (!pinataApiKey) {
        throw new AppError("Pinata JWT not set", 500);
    }

    const pinata = new PinataSDK({ pinataJwt: pinataApiKey });

    const mainFileCids: string[] = [];
    if (files.files && files.files.length > 0) {
        for (const file of files.files) {
            const nodeFile = new File([file.buffer], file.originalname, { type: file.mimetype });
            const result = await pinata.upload.file(nodeFile, {
                metadata: { name: file.originalname },
            });
            mainFileCids.push(result.IpfsHash);
        }
    }

    let thumbnailCid: string | null = null;
    if (files.thumbnail && files.thumbnail.length > 0) {
        const thumbFile = files.thumbnail[0];
        const thumbNodeFile = new File([thumbFile.buffer], thumbFile.originalname, { type: thumbFile.mimetype });
        const thumbResult = await pinata.upload.file(thumbNodeFile, {
            metadata: { name: thumbFile.originalname },
        });
        thumbnailCid = thumbResult.IpfsHash;
    }

    newsData.files = mainFileCids;
    newsData.thumbnail = thumbnailCid;

    console.log(newsData)

    res.status(201).json({
        success: true,
        message: "News created successfully",
        newsData,
    });
});