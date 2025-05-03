import { Request } from "express";

export interface CustomRequest extends Request {
    files: {
        thumbnail?: Express.Multer.File[];
        files?: Express.Multer.File[];
    };
}
