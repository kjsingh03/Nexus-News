import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ValidationError } from "../utils/appErrors.js"
import mongoose from "mongoose";

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ValidationError) {
        res.status(err.statusCode).json({ status: false, message: err.message, errors: err.errors || null });
    } else if (err instanceof ZodError) {
        res.status(400).json({ status: false, message: 'Validation failed', errors: err.errors.map(e => ({ field: e.path.join('.'), message: e.message })) });
    } else if (err instanceof mongoose.Error.ValidationError) {
        res.status(400).json({ status: false, message: 'Validation failed', errors: Object.values(err.errors).map((e: any) => ({ field: e.path ?? "", message: e.message ?? "", })) });
    } else if (err instanceof mongoose.Error || err.name === "MongoError") {
        res.status(500).json({ status: 'error', message: "Database error occurred" });
    } else {
        res.status(500).json({ status: 'error', message: "Internal Server Error", errors: err.message, });
    }
};
